
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS delivery_per_km numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_delivery_radius_km numeric NOT NULL DEFAULT 10;

UPDATE public.platform_settings SET platform_fee = 10 WHERE platform_fee < 10;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distance_km numeric;

-- Backfill: legacy orders stored platform fee in delivery_fee column
UPDATE public.orders
  SET platform_fee = delivery_fee, delivery_fee = 0
  WHERE platform_fee = 0 AND delivery_fee > 0 AND distance_km IS NULL;

-- Recreate place_order with distance-based delivery fee + separate platform fee
CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb, _customer_name text, _customer_phone text, _address text,
  _landmark text DEFAULT NULL::text, _notes text DEFAULT NULL::text,
  _latitude double precision DEFAULT NULL::double precision,
  _longitude double precision DEFAULT NULL::double precision
) RETURNS uuid LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _platform_fee numeric;
  _per_km numeric;
  _max_radius numeric;
  _subtotal numeric := 0;
  _delivery_fee numeric := 0;
  _distance_km numeric;
  _total numeric;
  _server_items jsonb := '[]'::jsonb;
  _entry jsonb;
  _item_id uuid;
  _qty int;
  _menu record;
  _order_id uuid;
  _rid uuid;
  _rlat double precision;
  _rlng double precision;
  _min_order numeric := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_blocks WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;
  IF length(coalesce(_customer_name,'')) < 2 OR length(_customer_name) > 80 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _customer_phone !~ '^[0-9+\-\s]{7,15}$' THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF length(coalesce(_address,'')) < 8 OR length(_address) > 300 THEN RAISE EXCEPTION 'Invalid address'; END IF;
  IF _latitude IS NULL OR _longitude IS NULL THEN
    RAISE EXCEPTION 'Please pin your delivery location';
  END IF;

  SELECT platform_fee, delivery_per_km, max_delivery_radius_km
    INTO _platform_fee, _per_km, _max_radius
    FROM public.platform_settings LIMIT 1;
  _platform_fee := coalesce(_platform_fee, 10);
  _per_km := coalesce(_per_km, 10);
  _max_radius := coalesce(_max_radius, 10);

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _item_id := (_entry->>'id')::uuid;
    _qty := (_entry->>'qty')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, coalesce(offer_price, price) AS price, is_available, is_out_of_stock, restaurant_id
      INTO _menu FROM public.menu_items WHERE id = _item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF NOT _menu.is_available OR _menu.is_out_of_stock THEN RAISE EXCEPTION 'Item % is not available', _menu.name; END IF;
    IF _rid IS NULL THEN _rid := _menu.restaurant_id;
    ELSIF _rid <> _menu.restaurant_id THEN RAISE EXCEPTION 'All items must belong to the same restaurant';
    END IF;
    _subtotal := _subtotal + (_menu.price * _qty);
    _server_items := _server_items || jsonb_build_object('id', _menu.id, 'name', _menu.name, 'price', _menu.price, 'qty', _qty);
  END LOOP;

  SELECT min_order_value, latitude, longitude INTO _min_order, _rlat, _rlng
    FROM public.restaurants WHERE id = _rid;
  IF _subtotal < coalesce(_min_order, 0) THEN
    RAISE EXCEPTION 'Minimum order value is %', _min_order;
  END IF;
  IF _rlat IS NULL OR _rlng IS NULL THEN
    RAISE EXCEPTION 'Restaurant location is not set';
  END IF;

  -- Haversine (km) * 1.3 road factor
  _distance_km := 1.3 * (
    2 * 6371 * asin(sqrt(
      power(sin(radians((_latitude - _rlat)/2)), 2) +
      cos(radians(_rlat)) * cos(radians(_latitude)) *
      power(sin(radians((_longitude - _rlng)/2)), 2)
    ))
  );

  IF _distance_km > _max_radius THEN
    RAISE EXCEPTION 'Sorry, this restaurant does not deliver to your selected location.';
  END IF;

  _delivery_fee := round(_distance_km * _per_km);
  _total := _subtotal + _delivery_fee + _platform_fee;

  INSERT INTO public.orders (
    user_id, restaurant_id, customer_name, customer_phone, address, landmark, notes,
    latitude, longitude, items, subtotal, delivery_fee, platform_fee, distance_km, total, payment_method, status
  ) VALUES (
    _uid, _rid, _customer_name, _customer_phone, _address, nullif(_landmark,''), nullif(_notes,''),
    _latitude, _longitude, _server_items, _subtotal, _delivery_fee, _platform_fee,
    round(_distance_km::numeric, 2), _total, 'cod', 'placed'
  ) RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$$;

-- Include new immutable fields in owner update guard
CREATE OR REPLACE FUNCTION public.owner_order_update_safe(_old orders, _new orders)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT
    _new.id              IS NOT DISTINCT FROM _old.id
    AND _new.user_id          IS NOT DISTINCT FROM _old.user_id
    AND _new.restaurant_id    IS NOT DISTINCT FROM _old.restaurant_id
    AND _new.rider_id         IS NOT DISTINCT FROM _old.rider_id
    AND _new.items            IS NOT DISTINCT FROM _old.items
    AND _new.subtotal         IS NOT DISTINCT FROM _old.subtotal
    AND _new.delivery_fee     IS NOT DISTINCT FROM _old.delivery_fee
    AND _new.platform_fee     IS NOT DISTINCT FROM _old.platform_fee
    AND _new.distance_km      IS NOT DISTINCT FROM _old.distance_km
    AND _new.total            IS NOT DISTINCT FROM _old.total
    AND _new.payment_method   IS NOT DISTINCT FROM _old.payment_method
    AND _new.customer_name    IS NOT DISTINCT FROM _old.customer_name
    AND _new.customer_phone   IS NOT DISTINCT FROM _old.customer_phone
    AND _new.address          IS NOT DISTINCT FROM _old.address
    AND _new.landmark         IS NOT DISTINCT FROM _old.landmark
    AND _new.notes            IS NOT DISTINCT FROM _old.notes
    AND _new.latitude         IS NOT DISTINCT FROM _old.latitude
    AND _new.longitude        IS NOT DISTINCT FROM _old.longitude
    AND _new.created_at       IS NOT DISTINCT FROM _old.created_at
$$;

CREATE OR REPLACE FUNCTION public.enforce_owner_order_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = NEW.restaurant_id AND r.owner_id = auth.uid()
  ) THEN
    IF NEW.id              IS DISTINCT FROM OLD.id
    OR NEW.user_id         IS DISTINCT FROM OLD.user_id
    OR NEW.restaurant_id   IS DISTINCT FROM OLD.restaurant_id
    OR NEW.rider_id        IS DISTINCT FROM OLD.rider_id
    OR NEW.items           IS DISTINCT FROM OLD.items
    OR NEW.subtotal        IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee    IS DISTINCT FROM OLD.delivery_fee
    OR NEW.platform_fee    IS DISTINCT FROM OLD.platform_fee
    OR NEW.distance_km     IS DISTINCT FROM OLD.distance_km
    OR NEW.total           IS DISTINCT FROM OLD.total
    OR NEW.payment_method  IS DISTINCT FROM OLD.payment_method
    OR NEW.customer_name   IS DISTINCT FROM OLD.customer_name
    OR NEW.customer_phone  IS DISTINCT FROM OLD.customer_phone
    OR NEW.address         IS DISTINCT FROM OLD.address
    OR NEW.landmark        IS DISTINCT FROM OLD.landmark
    OR NEW.notes           IS DISTINCT FROM OLD.notes
    OR NEW.latitude        IS DISTINCT FROM OLD.latitude
    OR NEW.longitude       IS DISTINCT FROM OLD.longitude
    OR NEW.created_at      IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Restaurant owners can only change order status fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
