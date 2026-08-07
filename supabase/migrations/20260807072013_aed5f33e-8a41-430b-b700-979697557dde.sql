ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS half_price numeric,
  ADD COLUMN IF NOT EXISTS half_offer_price numeric;

CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer_name text, _customer_phone text, _address text, _landmark text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _latitude double precision DEFAULT NULL::double precision, _longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
  _portion text;
  _unit_price numeric;
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
    _portion := lower(coalesce(_entry->>'portion', 'full'));
    IF _portion NOT IN ('full','half') THEN RAISE EXCEPTION 'Invalid portion'; END IF;
    IF _qty IS NULL OR _qty < 1 OR _qty > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, coalesce(offer_price, price) AS price,
           coalesce(half_offer_price, half_price) AS half_price,
           is_available, is_out_of_stock, restaurant_id
      INTO _menu FROM public.menu_items WHERE id = _item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF NOT _menu.is_available OR _menu.is_out_of_stock THEN RAISE EXCEPTION 'Item % is not available', _menu.name; END IF;
    IF _portion = 'half' THEN
      IF _menu.half_price IS NULL THEN RAISE EXCEPTION 'Half plate is not available for %', _menu.name; END IF;
      _unit_price := _menu.half_price;
    ELSE
      _unit_price := _menu.price;
    END IF;
    IF _rid IS NULL THEN _rid := _menu.restaurant_id;
    ELSIF _rid <> _menu.restaurant_id THEN RAISE EXCEPTION 'All items must belong to the same restaurant';
    END IF;
    _subtotal := _subtotal + (_unit_price * _qty);
    _server_items := _server_items || jsonb_build_object(
      'id', _menu.id,
      'name', CASE WHEN _portion = 'half' THEN _menu.name || ' (Half)' ELSE _menu.name END,
      'portion', _portion,
      'price', _unit_price,
      'qty', _qty);
  END LOOP;

  SELECT min_order_value, latitude, longitude INTO _min_order, _rlat, _rlng
    FROM public.restaurants WHERE id = _rid;
  IF _subtotal < coalesce(_min_order, 0) THEN
    RAISE EXCEPTION 'Minimum order value is %', _min_order;
  END IF;
  IF _rlat IS NULL OR _rlng IS NULL THEN
    RAISE EXCEPTION 'Restaurant location is not set';
  END IF;

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
$function$;