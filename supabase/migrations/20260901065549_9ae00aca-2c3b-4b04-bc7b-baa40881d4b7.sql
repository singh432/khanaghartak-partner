CREATE OR REPLACE FUNCTION public.zone_list_riders(_zone_id uuid)
 RETURNS TABLE(user_id uuid, full_name text, phone text, status text, is_online boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN RAISE EXCEPTION 'Not a manager of this zone'; END IF;
  RETURN QUERY
    SELECT rp.user_id, rp.full_name, rp.phone, rp.status, rp.is_online
      FROM public.rider_profiles rp WHERE rp.zone_id = _zone_id
     ORDER BY CASE rp.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, rp.full_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.zone_set_rider_status(_user_id uuid, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _zone uuid;
BEGIN
  IF _status NOT IN ('pending','approved','rejected','suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT rp.zone_id INTO _zone FROM public.rider_profiles rp WHERE rp.user_id = _user_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this rider''s zone';
  END IF;
  UPDATE public.rider_profiles SET status = _status, updated_at = now() WHERE user_id = _user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.zone_set_restaurant_open(_restaurant_id uuid, _is_open boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _zone uuid;
BEGIN
  SELECT r.zone_id INTO _zone FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this restaurant''s zone';
  END IF;
  UPDATE public.restaurants SET is_open = _is_open, updated_at = now() WHERE id = _restaurant_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.zone_set_rider_status(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.zone_set_restaurant_open(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.zone_set_rider_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_set_restaurant_open(uuid, boolean) TO authenticated;