-- ==============================================================================
-- KHANAGHARTAK: PARTNER NOTIFICATIONS DEVICE TOKENS SETUP (FINAL HARDENED)
-- Safe, Concurrency-Hardened, Anti-Hijacking Migration with ROW_COUNT Validation
-- ==============================================================================

-- 1. Create table for storing device FCM registration tokens
CREATE TABLE IF NOT EXISTS public.user_fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  app_type text NOT NULL CHECK (app_type IN ('customer', 'partner')),
  role text NOT NULL CHECK (role IN ('customer', 'restaurant', 'rider', 'zone_manager')),
  platform text NOT NULL DEFAULT 'android',
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_fcm_tokens_token_unique UNIQUE (token)
);

-- Defensive check: ensure is_active column exists
ALTER TABLE public.user_fcm_tokens ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. Row Level Security: users can only view and manage their own device tokens
ALTER TABLE public.user_fcm_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_fcm_tokens' 
      AND policyname = 'Users can manage their own device tokens'
  ) THEN
    CREATE POLICY "Users can manage their own device tokens"
      ON public.user_fcm_tokens FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3. Performance Index on active tokens for fast dispatch lookups
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_role 
  ON public.user_fcm_tokens(user_id, role, app_type)
  WHERE is_active = true;

-- 4. Stored Procedure: Register / Update Partner FCM Token
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
  _clean_token text;
  _clean_role text;
  _clean_platform text;
  _existing_owner uuid;
  _existing_active boolean;
  _rows_affected integer := 0;
BEGIN
  -- Authentication check
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Token validity check
  _clean_token := trim(_token);
  IF _clean_token IS NULL OR _clean_token = '' OR length(_clean_token) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  -- Strict partner role whitelisting
  _clean_role := lower(trim(_role));
  IF _clean_role NOT IN ('restaurant', 'rider', 'zone_manager') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_partner_role');
  END IF;

  -- Platform normalization
  _clean_platform := lower(coalesce(trim(_platform), 'android'));
  IF _clean_platform NOT IN ('android', 'ios', 'web') THEN
    _clean_platform := 'android';
  END IF;

  -- 1. Transaction-level advisory lock serializes concurrent requests for this token
  PERFORM pg_advisory_xact_lock(hashtext(_clean_token));

  -- 2. Inspect existing token owner with row lock
  SELECT user_id, is_active INTO _existing_owner, _existing_active
  FROM public.user_fcm_tokens
  WHERE token = _clean_token
  FOR UPDATE;

  -- 3. Prevent cross-user hijacking
  IF _existing_owner IS NOT NULL AND _existing_owner <> _user_id THEN
    IF _existing_active = true THEN
      -- Active token owned by another user cannot be stolen
      RETURN jsonb_build_object('success', false, 'error', 'token_owned_by_another_user');
    ELSE
      -- Previous owner logged out; reassign device token in-place to the new user
      UPDATE public.user_fcm_tokens
      SET user_id = _user_id,
          role = _clean_role,
          app_type = 'partner',
          platform = _clean_platform,
          is_active = true,
          updated_at = now()
      WHERE token = _clean_token
        AND is_active = false;

      GET DIAGNOSTICS _rows_affected = ROW_COUNT;
      IF _rows_affected = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'token_reassignment_failed');
      END IF;

      RETURN jsonb_build_object('success', true);
    END IF;
  END IF;

  -- 4. Upsert for same owner or brand-new token
  INSERT INTO public.user_fcm_tokens (
    user_id,
    token,
    app_type,
    role,
    platform,
    is_active,
    updated_at
  )
  VALUES (
    _user_id,
    _clean_token,
    'partner',
    _clean_role,
    _clean_platform,
    true,
    now()
  )
  ON CONFLICT (token) DO UPDATE
  SET role = EXCLUDED.role,
      app_type = EXCLUDED.app_type,
      platform = EXCLUDED.platform,
      is_active = true,
      updated_at = now()
  WHERE public.user_fcm_tokens.user_id = EXCLUDED.user_id;

  -- Explicitly verify that a row was actually inserted or updated
  GET DIAGNOSTICS _rows_affected = ROW_COUNT;
  IF _rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_owned_by_another_user');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. Stored Procedure: Deactivate Partner FCM Token on sign-out
CREATE OR REPLACE FUNCTION public.deactivate_partner_fcm_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _clean_token text;
  _rows_affected integer := 0;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  _clean_token := trim(_token);
  IF _clean_token IS NULL OR _clean_token = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  UPDATE public.user_fcm_tokens
  SET is_active = false, updated_at = now()
  WHERE token = _clean_token
    AND user_id = _user_id;

  GET DIAGNOSTICS _rows_affected = ROW_COUNT;
  IF _rows_affected = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'token_not_found_or_unauthorized');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. Permissions: Revoke from anon, Grant to authenticated & service_role
REVOKE ALL ON public.user_fcm_tokens FROM public, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_fcm_tokens TO authenticated;
GRANT ALL ON public.user_fcm_tokens TO service_role;

REVOKE ALL ON FUNCTION public.register_partner_fcm_token(text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.register_partner_fcm_token(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.deactivate_partner_fcm_token(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_partner_fcm_token(text) TO authenticated, service_role;

COMMENT ON TABLE public.user_fcm_tokens IS 'Stores FCM device registration tokens for push notifications on Android';

-- 7. Fix Notify Webhook Endpoint URL to direct custom domain (prevent 302 redirect drop in pg_net)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'app_private' AND table_name = 'notify_config') THEN
    UPDATE app_private.notify_config
    SET endpoint_url = 'https://khanaghartak.in/api/public/notify/whatsapp'
    WHERE id = true;
  END IF;
END $$;

-- 8. Enhanced Dispatcher with detailed logging to notification_log
CREATE OR REPLACE FUNCTION app_private.dispatch_order_notification(_order_id uuid, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'app_private'
AS $$
DECLARE
  _cfg record;
  _net_id bigint;
BEGIN
  SELECT endpoint_url, shared_secret INTO _cfg FROM app_private.notify_config WHERE id;
  IF NOT FOUND THEN
    INSERT INTO public.notification_log (order_id, event, recipient_type, status, error)
    VALUES (_order_id, _event, 'system', 'failed', 'notify_config_not_found');
    RETURN;
  END IF;

  IF NOT COALESCE((SELECT whatsapp_enabled FROM public.platform_settings LIMIT 1), true) THEN
    INSERT INTO public.notification_log (order_id, event, recipient_type, status, error)
    VALUES (_order_id, _event, 'system', 'skipped', 'whatsapp_disabled');
    RETURN;
  END IF;

  SELECT net.http_post(
    url := _cfg.endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', _cfg.shared_secret),
    body := jsonb_build_object('order_id', _order_id, 'event', _event),
    timeout_milliseconds := 8000
  ) INTO _net_id;

  INSERT INTO public.notification_log (order_id, event, recipient_type, status, provider_sid)
  VALUES (_order_id, _event, 'webhook', 'dispatched', _net_id::text);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.notification_log (order_id, event, recipient_type, status, error)
  VALUES (_order_id, _event, 'system', 'exception', SQLERRM);
END;
$$;

-- 9. Zone Manager Policy on public.orders
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

-- 10. Partner Order Details RPC
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

-- 11. Verification Query
SELECT 'user_fcm_tokens table' AS check_item, count(*) AS status_count FROM public.user_fcm_tokens
UNION ALL
SELECT 'app_private.notify_config updated' AS check_item, count(*) FROM app_private.notify_config WHERE endpoint_url LIKE '%khanaghartak.in%';

