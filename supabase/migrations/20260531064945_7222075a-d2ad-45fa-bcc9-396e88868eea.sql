-- 1) rejection reason on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason text;

-- 2) Update place_order to use ₹5 platform fee
CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer_name text, _customer_phone text, _address text, _landmark text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _latitude double precision DEFAULT NULL::double precision, _longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
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

-- 3) Storage bucket for menu images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Menu images public read" ON storage.objects;
CREATE POLICY "Menu images public read" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');

DROP POLICY IF EXISTS "Admin upload menu images" ON storage.objects;
CREATE POLICY "Admin upload menu images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'restaurant_admin'));

DROP POLICY IF EXISTS "Admin update menu images" ON storage.objects;
CREATE POLICY "Admin update menu images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'restaurant_admin'));

DROP POLICY IF EXISTS "Admin delete menu images" ON storage.objects;
CREATE POLICY "Admin delete menu images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'menu-images' AND public.has_role(auth.uid(), 'restaurant_admin'));

-- 4) Realtime publication for live updates
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; END IF;
END $$;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='menu_items';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items; END IF;
END $$;