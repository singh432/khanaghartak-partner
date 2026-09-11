CREATE OR REPLACE FUNCTION public.super_zone_stats(_since timestamptz DEFAULT NULL, _until timestamptz DEFAULT NULL)
RETURNS TABLE(zone_id uuid, zone_name text, orders_count bigint, delivered_count bigint, cancelled_count bigint, revenue numeric, food_value numeric, delivery_fees numeric, platform_fees numeric, restaurant_payout numeric, rider_payout numeric, net_profit numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id,
         z.name,
         count(o.id),
         count(o.id) FILTER (WHERE o.status = 'delivered'),
         count(o.id) FILTER (WHERE o.status IN ('cancelled','rejected')),
         COALESCE(sum(o.total) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum(o.subtotal) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum(o.delivery_fee) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum(o.platform_fee) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum(o.subtotal * 0.85) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) * 0.60) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) * 0.40) FILTER (WHERE o.status = 'delivered'), 0)
  FROM public.delivery_zones z
  LEFT JOIN public.orders o
    ON o.zone_id = z.id
   AND (_since IS NULL OR o.created_at >= _since)
   AND (_until IS NULL OR o.created_at < _until)
  WHERE app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  GROUP BY z.id, z.name
  ORDER BY z.name;
$$;