CREATE OR REPLACE FUNCTION public.super_cancel_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can cancel orders';
  END IF;

  UPDATE public.orders
     SET status = 'cancelled',
         rejection_reason = COALESCE(NULLIF(_reason, ''), rejection_reason),
         updated_at = now()
   WHERE id = _order_id
     AND status NOT IN ('delivered', 'cancelled', 'rejected');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or already closed';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.super_cancel_order(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.super_cancel_order(uuid, text) TO authenticated;