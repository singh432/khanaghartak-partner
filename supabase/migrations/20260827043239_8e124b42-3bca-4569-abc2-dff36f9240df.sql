-- 1. Zones
CREATE TABLE public.delivery_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  polygon jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.delivery_zones TO authenticated;
GRANT SELECT ON public.delivery_zones TO anon;
GRANT ALL ON public.delivery_zones TO service_role;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read zones" ON public.delivery_zones
  FOR SELECT USING (true);
CREATE POLICY "Super admin manages zones" ON public.delivery_zones
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER delivery_zones_touch BEFORE UPDATE ON public.delivery_zones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. Zone managers
CREATE TABLE public.zone_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.delivery_zones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (zone_id, user_id)
);
GRANT SELECT ON public.zone_managers TO authenticated;
GRANT ALL ON public.zone_managers TO service_role;
ALTER TABLE public.zone_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager reads own zone link" ON public.zone_managers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admin manages zone managers" ON public.zone_managers
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER zone_managers_touch BEFORE UPDATE ON public.zone_managers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Zone tagging on existing tables (nullable, additive)
ALTER TABLE public.restaurants    ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE public.rider_profiles ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
ALTER TABLE public.orders         ADD COLUMN IF NOT EXISTS zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_zone_idx ON public.orders(zone_id);

-- 4. Geometry helper: ray-casting point-in-polygon over jsonb [{lat,lng},...]
CREATE OR REPLACE FUNCTION public.point_in_polygon(_lat double precision, _lng double precision, _polygon jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n int; i int; j int;
  xi double precision; yi double precision; xj double precision; yj double precision;
  inside boolean := false;
BEGIN
  IF _lat IS NULL OR _lng IS NULL OR _polygon IS NULL OR jsonb_typeof(_polygon) <> 'array' THEN
    RETURN false;
  END IF;
  n := jsonb_array_length(_polygon);
  IF n < 3 THEN RETURN false; END IF;
  j := n - 1;
  FOR i IN 0..n-1 LOOP
    xi := (_polygon->i->>'lng')::double precision;
    yi := (_polygon->i->>'lat')::double precision;
    xj := (_polygon->j->>'lng')::double precision;
    yj := (_polygon->j->>'lat')::double precision;
    IF xi IS NULL OR yi IS NULL OR xj IS NULL OR yj IS NULL THEN
      j := i; CONTINUE;
    END IF;
    IF ((yi > _lat) <> (yj > _lat))
       AND (_lng < (xj - xi) * (_lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
  END LOOP;
  RETURN inside;
END;
$$;

CREATE OR REPLACE FUNCTION public.point_in_zone(_lat double precision, _lng double precision)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id FROM public.delivery_zones z
   WHERE z.is_active
     AND public.point_in_polygon(_lat, _lng, z.polygon)
   ORDER BY z.created_at
   LIMIT 1
$$;

-- 5. Manager role helpers
CREATE OR REPLACE FUNCTION public.my_zone_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT zm.zone_id FROM public.zone_managers zm WHERE zm.user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_zone_manager_of(_zone_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _zone_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.zone_managers zm
     WHERE zm.user_id = auth.uid() AND zm.zone_id = _zone_id)
$$;

-- 6. place_order: zone-based eligibility instead of restaurant radius
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
  _platform_min numeric := 100;
  _is_open boolean;
  _rstatus text;
  _np text;
  _zone_id uuid;
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

  -- Delivery eligibility is decided by the map zone the customer pinned in.
  _zone_id := public.point_in_zone(_latitude, _longitude);
  IF _zone_id IS NULL THEN
    RAISE EXCEPTION 'Sorry, we don''t deliver to this location yet.';
  END IF;

  SELECT platform_fee, delivery_per_km, max_delivery_radius_km
    INTO _platform_fee, _per_km, _max_radius
    FROM public.platform_settings LIMIT 1;
  _platform_fee := coalesce(_platform_fee, 10);
  _per_km := coalesce(_per_km, 10);

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

  -- distance is only used for pricing / rider ranking, never for eligibility
  IF _rlat IS NULL OR _rlng IS NULL THEN
    _distance_km := 0;
  ELSE
    _distance_km := 1.3 * (
      2 * 6371 * asin(sqrt(
        power(sin(radians((_latitude - _rlat)/2)), 2) +
        cos(radians(_rlat)) * cos(radians(_latitude)) *
        power(sin(radians((_longitude - _rlng)/2)), 2)
      ))
    );
  END IF;

  _delivery_fee := public.compute_delivery_fee(_subtotal, _distance_km);
  _total := _subtotal + _delivery_fee + _platform_fee;

  INSERT INTO public.orders (
    user_id, restaurant_id, customer_name, customer_phone, address, landmark, notes,
    latitude, longitude, items, subtotal, delivery_fee, platform_fee, distance_km, total, payment_method, status, zone_id
  ) VALUES (
    _uid, _rid, _customer_name, _customer_phone, _address, nullif(_landmark,''), nullif(_notes,''),
    _latitude, _longitude, _server_items, _subtotal, _delivery_fee, _platform_fee,
    round(_distance_km::numeric, 2), _total, 'cod', 'placed', _zone_id
  ) RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$function$;

-- 7. Zone manager RPCs
CREATE OR REPLACE FUNCTION public.zone_my_zones()
RETURNS TABLE(id uuid, name text, city text, polygon jsonb, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id, z.name, z.city, z.polygon, z.is_active
    FROM public.delivery_zones z
    JOIN public.zone_managers zm ON zm.zone_id = z.id
   WHERE zm.user_id = auth.uid()
   ORDER BY z.name
$$;

CREATE OR REPLACE FUNCTION public.zone_list_orders(_zone_id uuid, _limit integer DEFAULT 300, _since timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, restaurant_id uuid, restaurant_name text, status text, items jsonb, subtotal numeric,
              delivery_fee numeric, platform_fee numeric, total numeric, distance_km numeric,
              customer_name text, customer_phone text, address text, landmark text,
              rider_id uuid, rider_name text, is_fake boolean, created_at timestamptz, updated_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN RAISE EXCEPTION 'Not a manager of this zone'; END IF;
  RETURN QUERY
    SELECT o.id, o.restaurant_id, r.name, o.status, o.items, o.subtotal, o.delivery_fee, o.platform_fee,
           o.total, o.distance_km, o.customer_name, o.customer_phone, o.address, o.landmark,
           o.rider_id, rp.full_name, o.is_fake, o.created_at, o.updated_at
      FROM public.orders o
      LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
      LEFT JOIN public.rider_profiles rp ON rp.user_id = o.rider_id
     WHERE o.zone_id = _zone_id
       AND (_since IS NULL OR o.created_at >= _since)
     ORDER BY o.created_at DESC
     LIMIT greatest(1, least(coalesce(_limit, 300), 1000));
END;
$$;

CREATE OR REPLACE FUNCTION public.zone_list_restaurants(_zone_id uuid)
RETURNS TABLE(id uuid, name text, status text, is_open boolean, address text, phone text, rating numeric, rating_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN RAISE EXCEPTION 'Not a manager of this zone'; END IF;
  RETURN QUERY
    SELECT r.id, r.name, r.status, r.is_open, r.address, r.phone, r.rating, r.rating_count
      FROM public.restaurants r WHERE r.zone_id = _zone_id ORDER BY r.name;
END;
$$;

CREATE OR REPLACE FUNCTION public.zone_list_riders(_zone_id uuid)
RETURNS TABLE(user_id uuid, full_name text, phone text, status text, is_online boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN RAISE EXCEPTION 'Not a manager of this zone'; END IF;
  RETURN QUERY
    SELECT rp.user_id, rp.full_name, rp.phone, rp.status, rp.is_online
      FROM public.rider_profiles rp WHERE rp.zone_id = _zone_id ORDER BY rp.full_name;
END;
$$;

CREATE OR REPLACE FUNCTION public.zone_list_customers(_zone_id uuid)
RETURNS TABLE(user_id uuid, full_name text, phone text, orders_count bigint, total_spent numeric, last_order_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_zone_manager_of(_zone_id) THEN RAISE EXCEPTION 'Not a manager of this zone'; END IF;
  RETURN QUERY
    SELECT o.user_id,
           max(o.customer_name),
           max(o.customer_phone),
           count(*)::bigint,
           sum(o.total) FILTER (WHERE o.status = 'delivered'),
           max(o.created_at)
      FROM public.orders o
     WHERE o.zone_id = _zone_id
     GROUP BY o.user_id
     ORDER BY max(o.created_at) DESC
     LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.zone_assign_rider(_order_id uuid, _rider_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE _zone uuid;
BEGIN
  SELECT o.zone_id INTO _zone FROM public.orders o WHERE o.id = _order_id;
  IF _zone IS NULL OR NOT public.is_zone_manager_of(_zone) THEN
    RAISE EXCEPTION 'Not a manager of this zone';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.rider_profiles rp
     WHERE rp.user_id = _rider_id AND rp.status = 'approved' AND rp.zone_id = _zone
  ) THEN
    RAISE EXCEPTION 'Rider is not an approved rider of this zone';
  END IF;

  UPDATE public.delivery_offers SET status = 'cancelled', responded_at = now()
   WHERE order_id = _order_id AND status IN ('queued','active');
  INSERT INTO public.delivery_offers (order_id, rider_id, rank, status, offered_at, responded_at)
  VALUES (_order_id, _rider_id, 99, 'accepted', now(), now())
  ON CONFLICT (order_id, rider_id) DO UPDATE SET status = 'accepted', responded_at = now();
  UPDATE public.orders SET rider_id = _rider_id, updated_at = now() WHERE id = _order_id;
END;
$$;

-- 8. Super admin zone-wise report
CREATE OR REPLACE FUNCTION public.super_zone_stats(_since timestamptz DEFAULT NULL, _until timestamptz DEFAULT NULL)
RETURNS TABLE(zone_id uuid, zone_name text, orders_count bigint, delivered_count bigint, cancelled_count bigint,
              revenue numeric, food_value numeric, delivery_fees numeric, platform_fees numeric, net_profit numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  RETURN QUERY
    SELECT z.id,
           z.name,
           count(o.id)::bigint,
           count(o.id) FILTER (WHERE o.status = 'delivered')::bigint,
           count(o.id) FILTER (WHERE o.status IN ('cancelled','rejected'))::bigint,
           coalesce(sum(o.total) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.subtotal) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.delivery_fee) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.platform_fee) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(round(o.subtotal * 0.15) + o.platform_fee + o.delivery_fee) FILTER (WHERE o.status = 'delivered'), 0)
      FROM public.delivery_zones z
      LEFT JOIN public.orders o
        ON o.zone_id = z.id
       AND (_since IS NULL OR o.created_at >= _since)
       AND (_until IS NULL OR o.created_at < _until)
     GROUP BY z.id, z.name
     ORDER BY z.name;
END;
$$;

-- 9. Seed a starter zone covering the current service area and tag existing data
INSERT INTO public.delivery_zones (name, city, polygon, is_active)
VALUES (
  'Shankargarh (starter)',
  'Prayagraj',
  '[{"lat":25.2742,"lng":81.5212},{"lat":25.2742,"lng":81.7212},{"lat":25.0942,"lng":81.7212},{"lat":25.0942,"lng":81.5212}]'::jsonb,
  true
);

UPDATE public.restaurants SET zone_id = (SELECT id FROM public.delivery_zones ORDER BY created_at LIMIT 1) WHERE zone_id IS NULL;
UPDATE public.rider_profiles SET zone_id = (SELECT id FROM public.delivery_zones ORDER BY created_at LIMIT 1) WHERE zone_id IS NULL;
UPDATE public.orders SET zone_id = (SELECT id FROM public.delivery_zones ORDER BY created_at LIMIT 1) WHERE zone_id IS NULL;