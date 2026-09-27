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
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_fcm_tokens_token_unique UNIQUE (token)
);

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
  ON public.user_fcm_tokens(user_id, role, app_type);

-- 2. (Optional) Enable pg_net if using native Postgres HTTP webhook triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

COMMENT ON TABLE public.user_fcm_tokens IS 'Stores FCM device registration tokens for push notifications on Android';
