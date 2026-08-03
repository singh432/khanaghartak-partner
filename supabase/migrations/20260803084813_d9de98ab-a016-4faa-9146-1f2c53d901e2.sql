-- 1. Rider base location
ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS base_latitude double precision,
  ADD COLUMN IF NOT EXISTS base_longitude double precision;

-- 2. Delivery offers
CREATE TABLE IF NOT EXISTS public.delivery_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  rider_id uuid NOT NULL,
  rank integer NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  distance_km numeric,
  offered_at timestamptz,
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, rider_id)
);

GRANT SELECT ON public.delivery_offers TO authenticated;
GRANT ALL ON public.delivery_offers TO service_role;

ALTER TABLE public.delivery_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders read own offers" ON public.delivery_offers
  FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

CREATE POLICY "Super admin reads all offers" ON public.delivery_offers
  FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX IF NOT EXISTS delivery_offers_active_idx
  ON public.delivery_offers (status, expires_at);
CREATE INDEX IF NOT EXISTS delivery_offers_order_idx
  ON public.delivery_offers (order_id, rank);

-- 3. Offer dispatch
CREATE OR REPLACE FUNCTION app_private.activate_offer(_order_id uuid, _rank integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE _found boolean := false;
BEGIN
  UPDATE public.delivery_offers
     SET status = 'active', offered_at = now(), expires_at = now() + interval '2 minutes'
   WHERE order_id = _order_id AND rank = _rank AND status = 'queued';
  _found := FOUND;
  IF _found THEN
    PERFORM app_private.dispatch_order_notification(_order_id, 'rider_offer');
  END IF;
  RETURN _found;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.dispatch_rider_offers(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION app_private.expire_rider_offers()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE _row record;
BEGIN
  FOR _row IN
    SELECT order_id, rank FROM public.delivery_offers
     WHERE status = 'active' AND expires_at < now()
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.delivery_offers
       SET status = 'expired', responded_at = now()
     WHERE order_id = _row.order_id AND rank = _row.rank AND status = 'active';

    IF NOT app_private.activate_offer(_row.order_id, _row.rank + 1) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.delivery_offers
         WHERE order_id = _row.order_id AND status IN ('queued','active','accepted')
      ) THEN
        PERFORM app_private.dispatch_order_notification(_row.order_id, 'no_rider');
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- 4. Order event trigger: offers start at "preparing"
CREATE OR REPLACE FUNCTION public.notify_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app_private.dispatch_order_notification(NEW.id, 'order_placed');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'accepted' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'restaurant_accepted');
      ELSIF NEW.status = 'preparing' THEN
        PERFORM app_private.dispatch_rider_offers(NEW.id);
      ELSIF NEW.status = 'out_for_delivery' AND NEW.rider_id IS NOT NULL THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'rider_picked_up');
      ELSIF NEW.status = 'delivered' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'delivered');
      END IF;
    ELSIF NEW.rider_id IS DISTINCT FROM OLD.rider_id AND NEW.rider_id IS NOT NULL
          AND NEW.status = 'out_for_delivery' THEN
      PERFORM app_private.dispatch_order_notification(NEW.id, 'rider_picked_up');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_event ON public.orders;
CREATE TRIGGER trg_notify_order_event
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();

-- 5. Rider acceptance now requires a live offer
CREATE OR REPLACE FUNCTION public.rider_accept_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = auth.uid() AND status = 'approved') THEN
    RAISE EXCEPTION 'Your rider account is not approved yet';
  END IF;

  UPDATE public.delivery_offers
     SET status = 'accepted', responded_at = now()
   WHERE order_id = _order_id AND rider_id = auth.uid()
     AND status = 'active' AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'This delivery has already been taken'; END IF;

  UPDATE public.delivery_offers
     SET status = 'cancelled', responded_at = now()
   WHERE order_id = _order_id AND rider_id <> auth.uid() AND status IN ('queued','active');

  UPDATE public.orders
     SET rider_id = auth.uid(), updated_at = now()
   WHERE id = _order_id AND rider_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is not available'; END IF;
END;
$$;

-- 6. Rider's own offers list
CREATE OR REPLACE FUNCTION public.rider_list_offers()
RETURNS TABLE(order_id uuid, restaurant_name text, restaurant_address text, drop_area text,
              total numeric, item_count integer, distance_km numeric, expires_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN RAISE EXCEPTION 'Not a rider'; END IF;
  RETURN QUERY
    SELECT o.id, r.name, r.address,
           COALESCE(NULLIF(o.landmark,''), split_part(o.address, ',', GREATEST(1, array_length(string_to_array(o.address, ','), 1) - 1))),
           o.total, COALESCE(jsonb_array_length(o.items), 0), do_.distance_km, do_.expires_at
      FROM public.delivery_offers do_
      JOIN public.orders o ON o.id = do_.order_id
      LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
     WHERE do_.rider_id = auth.uid() AND do_.status = 'active' AND do_.expires_at > now()
       AND o.rider_id IS NULL
     ORDER BY do_.expires_at ASC;
END;
$$;

-- 7. Rider saves base pin
CREATE OR REPLACE FUNCTION public.rider_set_base_location(_lat double precision, _lng double precision)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Invalid location';
  END IF;
  UPDATE public.rider_profiles
     SET base_latitude = _lat, base_longitude = _lng, updated_at = now()
   WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Rider profile not found'; END IF;
END;
$$;

-- 8. Super admin manual assign
CREATE OR REPLACE FUNCTION public.super_assign_rider(_order_id uuid, _rider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = _rider_id AND status = 'approved') THEN
    RAISE EXCEPTION 'Rider is not approved';
  END IF;
  UPDATE public.delivery_offers
     SET status = 'cancelled', responded_at = now()
   WHERE order_id = _order_id AND status IN ('queued','active');
  INSERT INTO public.delivery_offers (order_id, rider_id, rank, status, offered_at, responded_at)
  VALUES (_order_id, _rider_id, 99, 'accepted', now(), now())
  ON CONFLICT (order_id, rider_id) DO UPDATE SET status = 'accepted', responded_at = now();
  UPDATE public.orders SET rider_id = _rider_id, updated_at = now() WHERE id = _order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_order_event() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rider_list_available_orders() FROM public, anon, authenticated;

-- 9. Scheduler: expire offers every 30 seconds
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('kgt-expire-rider-offers', '30 seconds', $$SELECT app_private.expire_rider_offers();$$);