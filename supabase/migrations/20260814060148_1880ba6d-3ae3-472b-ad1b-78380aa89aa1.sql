CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer_name text, _customer_phone text, _address text, _landmark text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _latitude double precision DEFAULT NULL::double precision, _longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
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
  _label text;
  _menu record;
  _order_id uuid;
  _rid uuid;
  _rlat double precision;
  _rlng double precision;
  _min_order numeric := 0;
  _platform_min numeric := 250;
  _is_open boolean;
  _rstatus text;
  _promo_start timestamptz := timestamptz '2026-08-15 00:00:00+05:30';
  _promo_free boolean := false;
  _np text;
  _delivered int;
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

  _np := app_private.norm_phone(_customer_phone);
  IF length(coalesce(_np,'')) <> 10 THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_phones b WHERE app_private.norm_phone(b.phone) = _np) THEN
    RAISE EXCEPTION 'This phone number is blocked. Please contact support.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cod_restrictions c WHERE c.user_id = _uid AND c.disabled_until > now()) THEN
    RAISE EXCEPTION 'Cash on Delivery is temporarily disabled for your account. Prepaid orders only — please contact support.';
  END IF;
  SELECT count(*) INTO _delivered FROM public.orders o
    WHERE o.user_id = _uid AND o.status = 'delivered' AND o.is_fake = false;
  -- OTP verification temporarily disabled

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
    IF _portion NOT IN ('full','half','kg','g500','g250','piece') THEN RAISE EXCEPTION 'Invalid portion'; END IF;
    IF _qty IS NULL OR _qty < 1 OR _qty > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, coalesce(offer_price, price) AS price,
           coalesce(half_offer_price, half_price) AS half_price,
           price_kg, price_500g, price_250g, price_piece,
           is_available, is_out_of_stock, restaurant_id
      INTO _menu FROM public.menu_items WHERE id = _item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF NOT _menu.is_available OR _menu.is_out_of_stock THEN RAISE EXCEPTION 'Item % is not available', _menu.name; END IF;

    _label := NULL;
    IF _portion = 'half' THEN
      IF _menu.half_price IS NULL THEN RAISE EXCEPTION 'Half plate is not available for %', _menu.name; END IF;
      _unit_price := _menu.half_price; _label := 'Half';
    ELSIF _portion = 'kg' THEN
      IF _menu.price_kg IS NULL THEN RAISE EXCEPTION '1 kg is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_kg; _label := '1 kg';
    ELSIF _portion = 'g500' THEN
      IF _menu.price_500g IS NULL THEN RAISE EXCEPTION '500 g is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_500g; _label := '500 g';
    ELSIF _portion = 'g250' THEN
      IF _menu.price_250g IS NULL THEN RAISE EXCEPTION '250 g is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_250g; _label := '250 g';
    ELSIF _portion = 'piece' THEN
      IF _menu.price_piece IS NULL THEN RAISE EXCEPTION 'Per piece is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_piece; _label := 'per piece';
    ELSE
      _unit_price := _menu.price;
    END IF;

    IF _rid IS NULL THEN _rid := _menu.restaurant_id;
    ELSIF _rid <> _menu.restaurant_id THEN RAISE EXCEPTION 'All items must belong to the same restaurant';
    END IF;
    _subtotal := _subtotal + (_unit_price * _qty);
    _server_items := _server_items || jsonb_build_object(
      'id', _menu.id,
      'name', CASE WHEN _label IS NULL THEN _menu.name ELSE _menu.name || ' (' || _label || ')' END,
      'portion', _portion,
      'price', _unit_price,
      'qty', _qty);
  END LOOP;

  SELECT min_order_value, latitude, longitude, is_open, status
    INTO _min_order, _rlat, _rlng, _is_open, _rstatus
    FROM public.restaurants WHERE id = _rid;

  IF _rstatus IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'This restaurant is not accepting orders right now.';
  END IF;
  IF _is_open IS NOT TRUE THEN
    RAISE EXCEPTION 'This restaurant is closed right now. Please try again when it reopens.';
  END IF;

  _min_order := greatest(coalesce(_min_order, 0), _platform_min);
  IF _subtotal < _min_order THEN
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

  _promo_free := (now() >= _promo_start)
    AND ((SELECT count(*) FROM public.orders o WHERE o.created_at >= _promo_start) < 50);

  IF _promo_free THEN
    _delivery_fee := 0;
  ELSE
    _delivery_fee := round(_distance_km * _per_km);
  END IF;
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