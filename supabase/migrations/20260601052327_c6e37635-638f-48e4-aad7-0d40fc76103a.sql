CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER POLICY "Admin write categories"
ON public.categories
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admin write menu"
ON public.menu_items
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admin write restaurant"
ON public.restaurant
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admins select all orders"
ON public.orders
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admins update orders"
ON public.orders
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admins read all profiles"
ON public.profiles
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admins delete roles"
ON public.user_roles
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admins insert roles"
ON public.user_roles
WITH CHECK (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admins update roles"
ON public.user_roles
USING (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Users view own roles"
ON public.user_roles
USING ((auth.uid() = user_id) OR app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admin upload menu images"
ON storage.objects
WITH CHECK ((bucket_id = 'menu-images'::text) AND app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admin update menu images"
ON storage.objects
USING ((bucket_id = 'menu-images'::text) AND app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

ALTER POLICY "Admin delete menu images"
ON storage.objects
USING ((bucket_id = 'menu-images'::text) AND app_private.has_role(auth.uid(), 'restaurant_admin'::public.app_role));

DROP POLICY IF EXISTS "Menu images public read" ON storage.objects;

CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer_name text, _customer_phone text, _address text, _landmark text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _latitude double precision DEFAULT NULL::double precision, _longitude double precision DEFAULT NULL::double precision)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _platform_fee numeric := 5;
  _subtotal numeric := 0;
  _total numeric;
  _server_items jsonb := '[]'::jsonb;
  _entry jsonb;
  _item_id uuid;
  _qty int;
  _menu record;
  _order_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;
  IF length(coalesce(_customer_name,'')) < 2 OR length(_customer_name) > 80 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _customer_phone !~ '^[0-9+\-\s]{7,15}$' THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF length(coalesce(_address,'')) < 8 OR length(_address) > 300 THEN RAISE EXCEPTION 'Invalid address'; END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _item_id := (_entry->>'id')::uuid;
    _qty := (_entry->>'qty')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, price, is_available INTO _menu FROM public.menu_items WHERE id = _item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF NOT _menu.is_available THEN RAISE EXCEPTION 'Item % is not available', _menu.name; END IF;
    _subtotal := _subtotal + (_menu.price * _qty);
    _server_items := _server_items || jsonb_build_object('id', _menu.id, 'name', _menu.name, 'price', _menu.price, 'qty', _qty);
  END LOOP;

  _total := _subtotal + _platform_fee;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, address, landmark, notes,
    latitude, longitude, items, subtotal, delivery_fee, total, payment_method, status
  ) VALUES (
    _uid, _customer_name, _customer_phone, _address, nullif(_landmark,''), nullif(_notes,''),
    _latitude, _longitude, _server_items, _subtotal, _platform_fee, _total, 'cod', 'placed'
  ) RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);