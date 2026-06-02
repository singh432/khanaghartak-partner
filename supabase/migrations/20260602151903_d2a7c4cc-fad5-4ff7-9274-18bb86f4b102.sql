-- ============================================================
-- KhanaGharTak: Multi-tenant migration
-- ============================================================

-- 2) Rename restaurant -> restaurants and extend
ALTER TABLE public.restaurant RENAME TO restaurants;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS opening_time text DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS closing_time text DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS min_order_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_charges numeric NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Assign existing single restaurant to current admin user
UPDATE public.restaurants
SET owner_id = 'b6a0cdbb-1da8-463b-b7ee-c339c839cd41'
WHERE owner_id IS NULL;

-- 3) Add restaurant_id to dependent tables
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS restaurant_id uuid,
  ADD COLUMN IF NOT EXISTS offer_price numeric,
  ADD COLUMN IF NOT EXISTS is_out_of_stock boolean NOT NULL DEFAULT false;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS restaurant_id uuid;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS restaurant_id uuid;

-- Backfill restaurant_id from the (only) existing restaurant
DO $$
DECLARE _rid uuid;
BEGIN
  SELECT id INTO _rid FROM public.restaurants LIMIT 1;
  IF _rid IS NOT NULL THEN
    UPDATE public.menu_items   SET restaurant_id = _rid WHERE restaurant_id IS NULL;
    UPDATE public.categories   SET restaurant_id = _rid WHERE restaurant_id IS NULL;
    UPDATE public.orders       SET restaurant_id = _rid WHERE restaurant_id IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON public.menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON public.categories(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_owner ON public.restaurants(owner_id);

-- 4) Platform settings (singleton)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee numeric NOT NULL DEFAULT 5,
  default_delivery_charges numeric NOT NULL DEFAULT 25,
  support_phone text,
  support_email text,
  terms text,
  privacy text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_settings TO anon, authenticated;
GRANT ALL ON public.platform_settings TO service_role;
GRANT UPDATE, INSERT ON public.platform_settings TO authenticated;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read platform settings"
  ON public.platform_settings FOR SELECT USING (true);

CREATE POLICY "Super admin write platform settings"
  ON public.platform_settings FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

INSERT INTO public.platform_settings (platform_fee, default_delivery_charges, support_phone, support_email)
SELECT 5, 25, '+91-0000000000', 'support@khanaghartak.in'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- 5) Customer blocks
CREATE TABLE IF NOT EXISTS public.customer_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason text,
  blocked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_blocks TO authenticated;
GRANT ALL ON public.customer_blocks TO service_role;

ALTER TABLE public.customer_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin manages blocks"
  ON public.customer_blocks FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

-- 6) Grant super_admin role to existing owner
INSERT INTO public.user_roles (user_id, role)
VALUES ('b6a0cdbb-1da8-463b-b7ee-c339c839cd41', 'super_admin'::app_role)
ON CONFLICT DO NOTHING;

-- 7) Rewrite RLS policies for multi-tenant + super admin

-- Drop old policies that referenced "restaurant" (now restaurants)
DROP POLICY IF EXISTS "Admin write restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Public read restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Admin write menu" ON public.menu_items;
DROP POLICY IF EXISTS "Admin write categories" ON public.categories;
DROP POLICY IF EXISTS "Admins select all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins update orders" ON public.orders;

-- restaurants
CREATE POLICY "Public read active restaurants"
  ON public.restaurants FOR SELECT USING (true);

CREATE POLICY "Owner manages own restaurant"
  ON public.restaurants FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Super admin manages all restaurants"
  ON public.restaurants FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

-- menu_items
CREATE POLICY "Owner manages own menu"
  ON public.menu_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = menu_items.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Super admin manages all menu"
  ON public.menu_items FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

-- categories
CREATE POLICY "Owner manages own categories"
  ON public.categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = categories.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Super admin manages all categories"
  ON public.categories FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

-- orders
CREATE POLICY "Owner sees own restaurant orders"
  ON public.orders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Owner updates own restaurant orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Super admin sees all orders"
  ON public.orders FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin updates all orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

-- 8) Update place_order to include restaurant_id and check stock + min order
CREATE OR REPLACE FUNCTION public.place_order(
  _items jsonb, _customer_name text, _customer_phone text, _address text,
  _landmark text DEFAULT NULL, _notes text DEFAULT NULL,
  _latitude double precision DEFAULT NULL, _longitude double precision DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _platform_fee numeric;
  _subtotal numeric := 0;
  _total numeric;
  _server_items jsonb := '[]'::jsonb;
  _entry jsonb;
  _item_id uuid;
  _qty int;
  _menu record;
  _order_id uuid;
  _rid uuid;
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

  SELECT platform_fee INTO _platform_fee FROM public.platform_settings LIMIT 1;
  _platform_fee := coalesce(_platform_fee, 5);

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

  SELECT min_order_value INTO _min_order FROM public.restaurants WHERE id = _rid;
  IF _subtotal < coalesce(_min_order, 0) THEN
    RAISE EXCEPTION 'Minimum order value is %', _min_order;
  END IF;

  _total := _subtotal + _platform_fee;

  INSERT INTO public.orders (
    user_id, restaurant_id, customer_name, customer_phone, address, landmark, notes,
    latitude, longitude, items, subtotal, delivery_fee, total, payment_method, status
  ) VALUES (
    _uid, _rid, _customer_name, _customer_phone, _address, nullif(_landmark,''), nullif(_notes,''),
    _latitude, _longitude, _server_items, _subtotal, _platform_fee, _total, 'cod', 'placed'
  ) RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$function$;
