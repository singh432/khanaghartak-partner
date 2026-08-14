ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS template text,
  ADD COLUMN IF NOT EXISTS error_code integer,
  ADD COLUMN IF NOT EXISTS error_title text;
CREATE INDEX IF NOT EXISTS notification_log_provider_sid_idx ON public.notification_log (provider_sid);