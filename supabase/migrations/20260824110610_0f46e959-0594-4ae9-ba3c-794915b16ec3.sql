CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  session_id text not null,
  user_id uuid,
  path text,
  device text,
  restaurant_id uuid,
  item_id text,
  order_id uuid,
  value numeric,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_event_idx ON public.analytics_events (event);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON public.analytics_events (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_session_event_uniq ON public.analytics_events (session_id, event, coalesce(item_id, ''), coalesce(order_id::text, ''));

GRANT INSERT ON public.analytics_events TO anon;
GRANT INSERT, SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can record analytics events" ON public.analytics_events;
CREATE POLICY "anyone can record analytics events"
ON public.analytics_events FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "super admins can read analytics events" ON public.analytics_events;
CREATE POLICY "super admins can read analytics events"
ON public.analytics_events FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));