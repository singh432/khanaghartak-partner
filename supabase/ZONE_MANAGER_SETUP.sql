-- ==============================================================================
-- KHANAGHARTAK: ZONE MANAGER FULL MANAGEMENT FUNCTIONS
-- Provides zone managers with full operational capabilities:
-- 1. Restaurant management (status change, update details, add restaurant)
-- 2. Rider management (status change, add rider, toggle online)
-- 3. Order management (update status, reassign rider)
-- 4. Menu item management (list items, toggle availability/out-of-stock)
-- ==============================================================================

-- 1. Set restaurant status (active, pending, rejected, suspended, inactive)
CREATE OR REPLACE FUNCTION public.zone_set_restaurant_status(_restaurant_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _zone uuid;
BEGIN
  IF _status NOT IN ('active', 'pending', 'rejected', 'suspended', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status: %', _status;
  END IF;
  SELECT r.zone_id INTO _zone FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this restaurant''s zone';
  END IF;
  UPDATE public.restaurants SET status = _status, updated_at = now() WHERE id = _restaurant_id;
END;
$function$;

-- 2. Update restaurant details
CREATE OR REPLACE FUNCTION public.zone_update_restaurant(
  _restaurant_id uuid,
  _name text,
  _phone text,
  _address text,
  _opening_time text,
  _closing_time text,
  _delivery_charges numeric DEFAULT 25,
  _min_order_value numeric DEFAULT 0,
  _tagline text DEFAULT NULL
)
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

  UPDATE public.restaurants
     SET name = COALESCE(NULLIF(TRIM(_name), ''), name),
         phone = COALESCE(NULLIF(TRIM(_phone), ''), phone),
         address = COALESCE(NULLIF(TRIM(_address), ''), address),
         opening_time = COALESCE(_opening_time, opening_time),
         closing_time = COALESCE(_closing_time, closing_time),
         delivery_charges = COALESCE(_delivery_charges, delivery_charges),
         min_order_value = COALESCE(_min_order_value, min_order_value),
         tagline = COALESCE(_tagline, tagline),
         updated_at = now()
   WHERE id = _restaurant_id;
END;
$function$;

-- 3. Add new restaurant into this zone
CREATE OR REPLACE FUNCTION public.zone_add_restaurant(
  _zone_id uuid,
  _name text,
  _phone text,
  _address text,
  _opening_time text DEFAULT '09:00',
  _closing_time text DEFAULT '22:00',
  _delivery_charges numeric DEFAULT 25,
  _min_order_value numeric DEFAULT 0,
  _tagline text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_id uuid;
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN
    RAISE EXCEPTION 'Not a manager of this zone';
  END IF;

  INSERT INTO public.restaurants (
    name,
    tagline,
    phone,
    address,
    status,
    is_open,
    delivery_time,
    delivery_charges,
    min_order_value,
    opening_time,
    closing_time,
    zone_id,
    owner_id
  ) VALUES (
    TRIM(_name),
    NULLIF(TRIM(_tagline), ''),
    NULLIF(TRIM(_phone), ''),
    NULLIF(TRIM(_address), ''),
    'active',
    true,
    '30-40 min',
    COALESCE(_delivery_charges, 25),
    COALESCE(_min_order_value, 0),
    COALESCE(_opening_time, '09:00'),
    COALESCE(_closing_time, '22:00'),
    _zone_id,
    auth.uid()
  ) RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;

-- 4. Add/register new rider into this zone
CREATE OR REPLACE FUNCTION public.zone_add_rider(
  _zone_id uuid,
  _full_name text,
  _phone text,
  _vehicle text DEFAULT 'Motorcycle'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rider_uid uuid;
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN
    RAISE EXCEPTION 'Not a manager of this zone';
  END IF;

  -- Check if rider profile already exists with this phone
  SELECT rp.user_id INTO _rider_uid
    FROM public.rider_profiles rp
   WHERE rp.phone = TRIM(_phone)
   LIMIT 1;

  IF _rider_uid IS NOT NULL THEN
    UPDATE public.rider_profiles
       SET zone_id = _zone_id,
           status = 'approved',
           is_online = true,
           full_name = COALESCE(NULLIF(TRIM(_full_name), ''), full_name),
           vehicle = COALESCE(NULLIF(TRIM(_vehicle), ''), vehicle),
           updated_at = now()
     WHERE user_id = _rider_uid;
    RETURN _rider_uid;
  END IF;

  _rider_uid := gen_random_uuid();

  INSERT INTO public.rider_profiles (
    user_id,
    full_name,
    phone,
    vehicle,
    status,
    is_online,
    zone_id
  ) VALUES (
    _rider_uid,
    TRIM(_full_name),
    TRIM(_phone),
    COALESCE(NULLIF(TRIM(_vehicle), ''), 'Motorcycle'),
    'approved',
    true,
    _zone_id
  );

  RETURN _rider_uid;
END;
$function$;

-- 5. Toggle rider online/offline by zone manager
CREATE OR REPLACE FUNCTION public.zone_set_rider_online(_user_id uuid, _is_online boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _zone uuid;
BEGIN
  SELECT rp.zone_id INTO _zone FROM public.rider_profiles rp WHERE rp.user_id = _user_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this rider''s zone';
  END IF;
  UPDATE public.rider_profiles SET is_online = _is_online, updated_at = now() WHERE user_id = _user_id;
END;
$function$;

-- 6. Update order status (confirm, preparing, ready, out_for_delivery, delivered, cancelled)
CREATE OR REPLACE FUNCTION public.zone_update_order_status(_order_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _zone uuid;
BEGIN
  IF _status NOT IN ('placed', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid order status: %', _status;
  END IF;
  SELECT o.zone_id INTO _zone FROM public.orders o WHERE o.id = _order_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this order''s zone';
  END IF;

  UPDATE public.orders
     SET status = _status,
         cancellation_reason = CASE WHEN _status = 'cancelled' THEN COALESCE(_reason, cancellation_reason, 'Cancelled by Zone Manager') ELSE cancellation_reason END,
         updated_at = now()
   WHERE id = _order_id;
END;
$function$;

-- 7. Toggle restaurant menu item availability
CREATE OR REPLACE FUNCTION public.zone_toggle_menu_item(_item_id uuid, _is_available boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rest_id uuid;
  _zone uuid;
BEGIN
  SELECT mi.restaurant_id INTO _rest_id FROM public.menu_items mi WHERE mi.id = _item_id;
  IF _rest_id IS NULL THEN RAISE EXCEPTION 'Menu item not found'; END IF;
  SELECT r.zone_id INTO _zone FROM public.restaurants r WHERE r.id = _rest_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this restaurant''s zone';
  END IF;

  UPDATE public.menu_items
     SET is_available = _is_available,
         is_out_of_stock = NOT _is_available,
         updated_at = now()
   WHERE id = _item_id;
END;
$function$;

-- 8. List restaurant menu items for zone manager
CREATE OR REPLACE FUNCTION public.zone_list_menu_items(_restaurant_id uuid)
RETURNS TABLE(
  id uuid,
  restaurant_id uuid,
  category_id uuid,
  name text,
  description text,
  price numeric,
  is_veg boolean,
  is_available boolean,
  is_out_of_stock boolean,
  image_url text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _zone uuid;
BEGIN
  SELECT r.zone_id INTO _zone FROM public.restaurants r WHERE r.id = _restaurant_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this restaurant''s zone';
  END IF;

  RETURN QUERY
    SELECT mi.id, mi.restaurant_id, mi.category_id, mi.name, mi.description, mi.price, mi.is_veg,
           COALESCE(mi.is_available, true), COALESCE(mi.is_out_of_stock, false), mi.image_url
      FROM public.menu_items mi
     WHERE mi.restaurant_id = _restaurant_id
     ORDER BY mi.name;
END;
$function$;

-- Grant execute permissions to authenticated
REVOKE ALL ON FUNCTION public.zone_set_restaurant_status(uuid, text) FROM public;
REVOKE ALL ON FUNCTION public.zone_update_restaurant(uuid, text, text, text, text, text, numeric, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.zone_add_restaurant(uuid, text, text, text, text, text, numeric, numeric, text) FROM public;
REVOKE ALL ON FUNCTION public.zone_add_rider(uuid, text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.zone_set_rider_online(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.zone_update_order_status(uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.zone_toggle_menu_item(uuid, boolean) FROM public;
REVOKE ALL ON FUNCTION public.zone_list_menu_items(uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.zone_set_restaurant_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_update_restaurant(uuid, text, text, text, text, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_add_restaurant(uuid, text, text, text, text, text, numeric, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_add_rider(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_set_rider_online(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_update_order_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_toggle_menu_item(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.zone_list_menu_items(uuid) TO authenticated;
