
-- 1) Lock down user_roles: only admins can insert/update/delete
CREATE POLICY "Admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'restaurant_admin'::app_role));

CREATE POLICY "Admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'restaurant_admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'restaurant_admin'::app_role));

CREATE POLICY "Admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'restaurant_admin'::app_role));

-- 2) Remove orders from realtime publication (not currently used; prevents broadcast leakage)
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;

-- 3) Revoke public execute on the new-user trigger function (only the trigger should call it)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 4) Server-side order placement to prevent client-side price manipulation
CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb,
  _customer_name text,
  _customer_phone text,
  _address text,
  _landmark text DEFAULT NULL,
  _notes text DEFAULT NULL,
  _latitude double precision DEFAULT NULL,
  _longitude double precision DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _delivery_fee numeric := 25;
  _subtotal numeric := 0;
  _total numeric;
  _server_items jsonb := '[]'::jsonb;
  _entry jsonb;
  _item_id uuid;
  _qty int;
  _menu record;
  _order_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF jsonb_array_length(_items) > 50 THEN
    RAISE EXCEPTION 'Too many items';
  END IF;

  IF length(coalesce(_customer_name,'')) < 2 OR length(_customer_name) > 80 THEN
    RAISE EXCEPTION 'Invalid name';
  END IF;
  IF _customer_phone !~ '^[0-9+\-\s]{7,15}$' THEN
    RAISE EXCEPTION 'Invalid phone';
  END IF;
  IF length(coalesce(_address,'')) < 8 OR length(_address) > 300 THEN
    RAISE EXCEPTION 'Invalid address';
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _item_id := (_entry->>'id')::uuid;
    _qty := (_entry->>'qty')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 50 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;
    SELECT id, name, price, is_available INTO _menu
      FROM public.menu_items WHERE id = _item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Menu item not found';
    END IF;
    IF NOT _menu.is_available THEN
      RAISE EXCEPTION 'Item % is not available', _menu.name;
    END IF;
    _subtotal := _subtotal + (_menu.price * _qty);
    _server_items := _server_items || jsonb_build_object(
      'id', _menu.id, 'name', _menu.name, 'price', _menu.price, 'qty', _qty
    );
  END LOOP;

  _total := _subtotal + _delivery_fee;

  INSERT INTO public.orders (
    user_id, customer_name, customer_phone, address, landmark, notes,
    latitude, longitude, items, subtotal, delivery_fee, total,
    payment_method, status
  ) VALUES (
    _uid, _customer_name, _customer_phone, _address,
    nullif(_landmark,''), nullif(_notes,''),
    _latitude, _longitude, _server_items, _subtotal, _delivery_fee, _total,
    'cod', 'placed'
  ) RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, double precision, double precision) TO authenticated;
