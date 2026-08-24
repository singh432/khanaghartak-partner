-- Remove the owner's full-row access to orders (exposed customer PII)
DROP POLICY IF EXISTS "Owner sees own restaurant orders" ON public.orders;

-- PII-free order feed for restaurant owners
CREATE OR REPLACE VIEW public.restaurant_orders
WITH (security_invoker = false) AS
SELECT
  o.id,
  o.restaurant_id,
  o.status,
  o.items,
  o.subtotal,
  o.delivery_fee,
  o.platform_fee,
  o.total,
  o.distance_km,
  o.payment_method,
  o.notes,
  o.rejection_reason,
  o.rider_id,
  o.is_fake,
  o.created_at,
  o.updated_at,
  split_part(coalesce(o.customer_name, ''), ' ', 1) AS customer_first_name
FROM public.orders o
JOIN public.restaurants r ON r.id = o.restaurant_id
WHERE r.owner_id = auth.uid();

REVOKE ALL ON public.restaurant_orders FROM anon;
GRANT SELECT ON public.restaurant_orders TO authenticated;
GRANT ALL ON public.restaurant_orders TO service_role;