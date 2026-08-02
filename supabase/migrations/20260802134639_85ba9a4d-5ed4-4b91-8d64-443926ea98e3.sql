-- 1. Notification log
CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  event text NOT NULL,
  recipient_type text NOT NULL,
  phone text,
  status text NOT NULL DEFAULT 'pending',
  provider_sid text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads notification log"
  ON public.notification_log FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE INDEX notification_log_order_idx ON public.notification_log (order_id, created_at DESC);

-- 2. Settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS whatsapp_from text,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

-- 3. pg_net for fire-and-forget HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4. Config holder for the notify endpoint (service-role only)
CREATE TABLE IF NOT EXISTS app_private.notify_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  endpoint_url text NOT NULL,
  shared_secret text NOT NULL
);
GRANT ALL ON app_private.notify_config TO service_role;

INSERT INTO app_private.notify_config (id, endpoint_url, shared_secret)
VALUES (true, 'https://khanaghartak.lovable.app/api/public/notify/whatsapp', encode(gen_random_bytes(24), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 5. Dispatcher
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
  IF NOT COALESCE((SELECT whatsapp_enabled FROM public.platform_settings LIMIT 1), true) THEN RETURN; END IF;

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

-- 6. Trigger on orders
CREATE OR REPLACE FUNCTION public.notify_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM app_private.dispatch_order_notification(NEW.id, 'order_placed');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'accepted' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'restaurant_accepted');
      ELSIF NEW.status = 'out_for_delivery' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'ready_for_pickup');
      ELSIF NEW.status = 'delivered' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'delivered');
      END IF;
    ELSIF NEW.rider_id IS DISTINCT FROM OLD.rider_id AND NEW.rider_id IS NOT NULL THEN
      PERFORM app_private.dispatch_order_notification(NEW.id, 'rider_picked_up');
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_event_ins ON public.orders;
CREATE TRIGGER trg_notify_order_event_ins
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();

DROP TRIGGER IF EXISTS trg_notify_order_event_upd ON public.orders;
CREATE TRIGGER trg_notify_order_event_upd
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_order_event();