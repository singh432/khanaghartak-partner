CREATE OR REPLACE FUNCTION public.super_cancel_order(_order_id uuid, _reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT app_private.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Only super admins can cancel orders';
  END IF;

  UPDATE public.orders
     SET status = 'cancelled',
         rejection_reason = COALESCE(NULLIF(trim(_reason), ''), rejection_reason),
         updated_at = now()
   WHERE id = _order_id
     AND status NOT IN ('delivered', 'cancelled', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or already closed';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.super_cancel_order(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.super_cancel_order(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_cancel_order(uuid, text) TO service_role;