-- ==============================================================================
-- KHANAGHARTAK: PARTNER NOTIFICATIONS & DEVICE TOKENS SETUP
-- Run this in your Supabase Project -> SQL Editor
-- ==============================================================================

-- 1. Create table for storing partner and customer FCM device tokens
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

-- Ensure is_active column exists if table was already created
ALTER TABLE public.user_fcm_tokens ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

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
  VALUES (_user_id, _token, 'partner', _role, _platform, true, now())
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

-- 4. Enable pg_net if using native Postgres HTTP webhook triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 5. Updated dispatcher that does NOT abort when whatsapp is disabled
CREATE OR REPLACE FUNCTION app_private.dispatch_order_notification(_order_id uuid, _event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'app_private'
AS $$
DECLARE
  _cfg record;
BEGIN
  SELECT endpoint_url, shared_secret INTO _cfg FROM app_private.notify_config WHERE id;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM net.http_post(
    url := _cfg.endpoint_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', _cfg.shared_secret),
    body := jsonb_build_object('order_id', _order_id, 'event', _event),
    timeout_milliseconds := 5000
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

COMMENT ON TABLE public.user_fcm_tokens IS 'Stores FCM device registration tokens for push notifications on Android';
