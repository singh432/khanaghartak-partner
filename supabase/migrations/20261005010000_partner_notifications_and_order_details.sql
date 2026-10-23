-- Migration: Partner notifications token management, Zone Manager order RLS, and Partner Order Details RPC

-- 1. Ensure is_active column exists on user_fcm_tokens
ALTER TABLE public.user_fcm_tokens ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Ensure RLS is active on user_fcm_tokens
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_fcm_tokens' AND policyname = 'Users can manage their own device tokens'
  ) THEN
    CREATE POLICY "Users can manage their own device tokens"
      ON public.user_fcm_tokens FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_role 
  ON public.user_fcm_tokens(user_id, role, app_type)
  WHERE is_active = true;

-- 2. Stored procedure to register or update partner FCM token
CREATE OR REPLACE FUNCTION public.register_partner_fcm_token(
  _token text,
  _role text,
  _platform text DEFAULT 'android'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  INSERT INTO public.user_fcm_tokens (user_id, token, app_type, role, platform, is_active, updated_at)
  VALUES (_user_id, _token, 'partner', lower(_role), _platform, true, now())
  ON CONFLICT (token) DO UPDATE
  SET user_id = EXCLUDED.user_id,
      role = EXCLUDED.role,
      app_type = EXCLUDED.app_type,
      platform = EXCLUDED.platform,
      is_active = true,
      updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.register_partner_fcm_token(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_partner_fcm_token(text, text, text) TO authenticated, service_role;

-- 3. Stored procedure to deactivate partner FCM token on sign-out
CREATE OR REPLACE FUNCTION public.deactivate_partner_fcm_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.user_fcm_tokens
  SET is_active = false, updated_at = now()
  WHERE token = _token;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_partner_fcm_token(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_partner_fcm_token(text) TO authenticated, service_role;

-- 4. Zone Manager direct SELECT policy on public.orders
DROP POLICY IF EXISTS "Zone managers select zone orders" ON public.orders;
CREATE POLICY "Zone managers select zone orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    public.is_zone_manager_of(zone_id)
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = orders.restaurant_id
        AND public.is_zone_manager_of(r.zone_id)
    )
    OR app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  );

-- 5. Stored procedure to fetch full order details for authorized partners (Zone Manager, Restaurant, Rider, Super Admin)
CREATE OR REPLACE FUNCTION public.get_partner_order_details(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  _uid uuid := auth.uid();
  _order record;
  _can_access boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT o.id, o.status, o.restaurant_id, r.name AS restaurant_name, r.phone AS restaurant_phone,
         o.customer_name, o.customer_phone, o.address, o.landmark,
         o.subtotal, o.delivery_fee, o.platform_fee, o.discount, o.total,
         o.items, o.rider_id, rp.full_name AS rider_name, o.zone_id, r.zone_id AS r_zone_id,
         o.created_at, r.owner_id
    INTO _order
    FROM public.orders o
    LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.rider_profiles rp ON rp.user_id = o.rider_id
   WHERE o.id = _order_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Verify permissions: Super Admin, Zone Manager of this zone, Restaurant Owner, or Assigned Rider
  IF app_private.has_role(_uid, 'super_admin'::public.app_role) THEN
    _can_access := true;
  ELSIF _order.owner_id = _uid THEN
    _can_access := true;
  ELSIF _order.rider_id = _uid THEN
    _can_access := true;
  ELSIF _order.zone_id IS NOT NULL AND public.is_zone_manager_of(_order.zone_id) THEN
    _can_access := true;
  ELSIF _order.r_zone_id IS NOT NULL AND public.is_zone_manager_of(_order.r_zone_id) THEN
    _can_access := true;
  END IF;

  IF NOT _can_access THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _order.id,
    'status', _order.status,
    'restaurant_id', _order.restaurant_id,
    'restaurant_name', _order.restaurant_name,
    'restaurant_phone', _order.restaurant_phone,
    'customer_name', _order.customer_name,
    'customer_phone', _order.customer_phone,
    'address', _order.address,
    'landmark', _order.landmark,
    'subtotal', _order.subtotal,
    'delivery_fee', _order.delivery_fee,
    'platform_fee', _order.platform_fee,
    'discount', _order.discount,
    'total', _order.total,
    'items', _order.items,
    'rider_id', _order.rider_id,
    'rider_name', _order.rider_name,
    'created_at', _order.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_order_details(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_order_details(uuid) TO authenticated, service_role;
