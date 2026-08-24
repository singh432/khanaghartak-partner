CREATE OR REPLACE FUNCTION public.owner_update_order_status(_order_id uuid, _status text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE _o record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT o.* INTO _o FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
   WHERE o.id = _order_id AND r.owner_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF NOT (
    (_o.status = 'placed'    AND _status IN ('accepted','rejected'))
    OR (_o.status = 'accepted'  AND _status = 'preparing')
    OR (_o.status = 'preparing' AND _status = 'out_for_delivery')
  ) THEN
    RAISE EXCEPTION 'Invalid status change';
  END IF;

  UPDATE public.orders
     SET status = _status,
         rejection_reason = CASE WHEN _status = 'rejected' THEN nullif(trim(coalesce(_reason,'')),'') ELSE rejection_reason END,
         updated_at = now()
   WHERE id = _order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_update_order_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_update_order_status(uuid, text, text) TO authenticated;