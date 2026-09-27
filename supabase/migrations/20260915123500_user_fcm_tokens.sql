-- Push notification device tokens for Customer and Partner Android apps
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

CREATE POLICY "Users can insert and update their own device tokens"
  ON public.user_fcm_tokens FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_role 
  ON public.user_fcm_tokens(user_id, role, app_type);
