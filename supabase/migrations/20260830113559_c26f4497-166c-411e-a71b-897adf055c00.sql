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