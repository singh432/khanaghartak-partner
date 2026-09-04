-- lovable-cron-fallback-reviewed: 2880 runs/day; per-order 2-minute delayed WhatsApp dispatch to the restaurant has no event-driven delay-until provider; customer-facing lock is derived from the timestamp, cron only pushes the notification
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS released_at timestamptz;
UPDATE public.orders SET released_at = created_at WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS orders_held_idx ON public.orders (created_at) WHERE released_at IS NULL;

CREATE OR REPLACE FUNCTION public.notify_order_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.released_at IS NOT NULL THEN
      PERFORM app_private.dispatch_order_notification(NEW.id, 'order_placed');
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.released_at IS NULL AND NEW.released_at IS NOT NULL
       AND NEW.status NOT IN ('cancelled','rejected') THEN
      PERFORM app_private.dispatch_order_notification(NEW.id, 'order_placed');
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'accepted' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'restaurant_accepted');
        PERFORM app_private.dispatch_rider_offers(NEW.id);
      ELSIF NEW.status = 'preparing' THEN
        PERFORM app_private.dispatch_rider_offers(NEW.id);
      ELSIF NEW.status = 'out_for_delivery' AND NEW.rider_id IS NOT NULL THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'rider_picked_up');
      ELSIF NEW.status = 'delivered' THEN
        PERFORM app_private.dispatch_order_notification(NEW.id, 'delivered');
      END IF;
    ELSIF NEW.rider_id IS DISTINCT FROM OLD.rider_id AND NEW.rider_id IS NOT NULL
          AND NEW.status = 'out_for_delivery' THEN
      PERFORM app_private.dispatch_order_notification(NEW.id, 'rider_picked_up');
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.hold_new_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.released_at := NULL;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS trg_hold_new_order ON public.orders;
CREATE TRIGGER trg_hold_new_order BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.hold_new_order();

CREATE OR REPLACE FUNCTION app_private.release_held_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE _n integer;
BEGIN
  WITH released AS (
    UPDATE public.orders
       SET released_at = now(), updated_at = now()
     WHERE released_at IS NULL
       AND created_at <= now() - interval '2 minutes'
       AND status NOT IN ('cancelled','rejected')
    RETURNING id
  )
  SELECT count(*) INTO _n FROM released;
  RETURN _n;
END;
$function$;
REVOKE ALL ON FUNCTION app_private.release_held_orders() FROM PUBLIC, anon, authenticated;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'release-held-orders';
SELECT cron.schedule('release-held-orders', '30 seconds', $$SELECT app_private.release_held_orders()$$);

CREATE OR REPLACE FUNCTION public.customer_cancel_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _o record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id, user_id, status, created_at INTO _o FROM public.orders WHERE id = _order_id;
  IF NOT FOUND OR _o.user_id <> auth.uid() THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF _o.status IN ('cancelled','rejected','delivered','out_for_delivery') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;
  IF _o.created_at < now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'The 2 minute cancellation window has passed. Please call support.';
  END IF;

  UPDATE public.orders
     SET status = 'cancelled',
         rejection_reason = 'Cancelled by customer',
         updated_at = now()
   WHERE id = _order_id;

  UPDATE public.delivery_offers
     SET status = 'cancelled', responded_at = now()
   WHERE order_id = _order_id AND status IN ('queued','active');
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_list_orders(_limit integer DEFAULT 200, _since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(id uuid, restaurant_id uuid, status text, items jsonb, subtotal numeric, delivery_fee numeric, platform_fee numeric, total numeric, distance_km numeric, payment_method text, notes text, rejection_reason text, rider_id uuid, is_fake boolean, created_at timestamp with time zone, updated_at timestamp with time zone, customer_first_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id, o.restaurant_id, o.status, o.items, o.subtotal, o.delivery_fee,
         o.platform_fee, o.total, o.distance_km, o.payment_method, o.notes,
         o.rejection_reason, o.rider_id, o.is_fake, o.created_at, o.updated_at,
         split_part(coalesce(o.customer_name, ''), ' ', 1) AS customer_first_name
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.owner_id = auth.uid()
    AND o.created_at <= now() - interval '2 minutes'
    AND (_since IS NULL OR o.created_at >= _since)
  ORDER BY o.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 200), 1000));
$function$;