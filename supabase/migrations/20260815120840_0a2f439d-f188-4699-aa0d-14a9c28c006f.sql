ALTER TABLE public.rider_profiles ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.rider_set_online(_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN RAISE EXCEPTION 'Not a rider'; END IF;
  UPDATE public.rider_profiles SET is_online = _online, updated_at = now() WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Rider profile not found'; END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rider_set_online(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.dispatch_rider_offers(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _rlat double precision;
  _rlng double precision;
  _n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.delivery_offers WHERE order_id = _order_id) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = _order_id AND rider_id IS NOT NULL) THEN RETURN; END IF;

  SELECT r.latitude, r.longitude INTO _rlat, _rlng
    FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id
   WHERE o.id = _order_id;

  INSERT INTO public.delivery_offers (order_id, rider_id, rank, distance_km)
  SELECT _order_id, c.user_id, c.rn, c.dist
  FROM (
    SELECT rp.user_id,
           row_number() OVER (ORDER BY d.dist NULLS LAST) AS rn,
           round(d.dist::numeric, 2) AS dist
      FROM public.rider_profiles rp
      CROSS JOIN LATERAL (
        SELECT CASE
          WHEN _rlat IS NULL OR rp.base_latitude IS NULL THEN NULL
          ELSE 2 * 6371 * asin(sqrt(
            power(sin(radians((rp.base_latitude - _rlat)/2)), 2) +
            cos(radians(_rlat)) * cos(radians(rp.base_latitude)) *
            power(sin(radians((rp.base_longitude - _rlng)/2)), 2)))
        END AS dist
      ) d
     WHERE rp.status = 'approved'
       AND rp.is_online = true
       AND rp.base_latitude IS NOT NULL
       AND rp.base_longitude IS NOT NULL
       AND rp.phone IS NOT NULL
     ORDER BY d.dist NULLS LAST
     LIMIT 3
  ) c;

  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n = 0 THEN
    PERFORM app_private.dispatch_order_notification(_order_id, 'no_rider');
    RETURN;
  END IF;

  PERFORM app_private.activate_offer(_order_id, 1);
END;
$function$;