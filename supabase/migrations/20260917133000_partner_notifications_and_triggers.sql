-- Partner notifications and triggers for Zone Managers, Restaurant Owners, and Riders

CREATE TABLE IF NOT EXISTS public.partner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.delivery_zones(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_role text NOT NULL CHECK (target_role IN ('zone_manager', 'restaurant', 'rider')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_partner_order_notif UNIQUE (order_id, target_user_id, target_role)
);

CREATE INDEX IF NOT EXISTS idx_partner_notif_target
  ON public.partner_notifications (target_user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_notif_zone
  ON public.partner_notifications (zone_id, created_at DESC);

ALTER TABLE public.partner_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_notifications' AND policyname = 'Users read own partner notifications'
  ) THEN
    CREATE POLICY "Users read own partner notifications"
      ON public.partner_notifications FOR SELECT TO authenticated
      USING (target_user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'partner_notifications' AND policyname = 'Users update own partner notifications'
  ) THEN
    CREATE POLICY "Users update own partner notifications"
      ON public.partner_notifications FOR UPDATE TO authenticated
      USING (target_user_id = auth.uid())
      WITH CHECK (target_user_id = auth.uid());
  END IF;
END $$;

-- Enable Realtime publication on partner_notifications table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'partner_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Trigger to notify Zone Managers and Restaurant Owners for EVERY new order created
CREATE OR REPLACE FUNCTION public.on_order_created_notify_partners()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  _rname text;
  _rzone_id uuid;
  _rowner_id uuid;
  _eff_zone_id uuid;
  _zm record;
  _short_code text;
  _title text := 'New Order Received';
  _body text;
BEGIN
  -- 1. Identify restaurant associated with the order
  SELECT name, zone_id, owner_id INTO _rname, _rzone_id, _rowner_id
    FROM public.restaurants WHERE id = NEW.restaurant_id;

  -- 2. Identify zone using existing zone logic
  _eff_zone_id := COALESCE(NEW.zone_id, _rzone_id);
  IF _eff_zone_id IS NULL AND NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    _eff_zone_id := public.point_in_zone(NEW.latitude, NEW.longitude);
  END IF;

  _short_code := upper(substring(NEW.id::text, 1, 8));
  _body := 'Order #' || _short_code || E'\n' || COALESCE(_rname, 'Restaurant') || E'\nOrder Amount: ₹' || round(NEW.total::numeric, 0);

  -- 3. Notify Zone Manager(s) assigned to this zone
  IF _eff_zone_id IS NOT NULL THEN
    FOR _zm IN
      SELECT user_id FROM public.zone_managers WHERE zone_id = _eff_zone_id
    LOOP
      INSERT INTO public.partner_notifications (
        order_id, zone_id, restaurant_id, target_user_id, target_role, title, body, data
      ) VALUES (
        NEW.id, _eff_zone_id, NEW.restaurant_id, _zm.user_id, 'zone_manager', _title, _body,
        jsonb_build_object(
          'order_id', NEW.id,
          'zone_id', _eff_zone_id,
          'restaurant_name', _rname,
          'total', NEW.total,
          'type', 'new_order',
          'order_code', _short_code
        )
      ) ON CONFLICT (order_id, target_user_id, target_role) DO NOTHING;
    END LOOP;
  END IF;

  -- 4. Notify Restaurant Owner
  IF _rowner_id IS NOT NULL THEN
    INSERT INTO public.partner_notifications (
      order_id, zone_id, restaurant_id, target_user_id, target_role, title, body, data
    ) VALUES (
      NEW.id, _eff_zone_id, NEW.restaurant_id, _rowner_id, 'restaurant', _title, _body,
      jsonb_build_object(
        'order_id', NEW.id,
        'zone_id', _eff_zone_id,
        'restaurant_name', _rname,
        'total', NEW.total,
        'type', 'new_order',
        'order_code', _short_code
      )
    ) ON CONFLICT (order_id, target_user_id, target_role) DO NOTHING;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_partners_on_order ON public.orders;
CREATE TRIGGER trg_notify_partners_on_order
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.on_order_created_notify_partners();
