CREATE OR REPLACE FUNCTION public.super_zone_stats(_since timestamp with time zone DEFAULT NULL::timestamp with time zone, _until timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS TABLE(zone_id uuid, zone_name text, orders_count bigint, delivered_count bigint, cancelled_count bigint, revenue numeric, food_value numeric, delivery_fees numeric, platform_fees numeric, restaurant_payout numeric, rider_payout numeric, net_profit numeric)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT z.id,
         z.name,
         count(o.id),
         count(o.id) FILTER (WHERE o.status = 'delivered'),
         count(o.id) FILTER (WHERE o.status IN ('cancelled','rejected')),
         COALESCE(sum(GREATEST((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) - COALESCE(o.discount, 0), 0)), 0),
         COALESCE(sum(o.subtotal), 0),
         COALESCE(sum(o.delivery_fee), 0),
         COALESCE(sum(o.platform_fee), 0),
         COALESCE(sum(o.subtotal * 0.85) FILTER (WHERE o.status = 'delivered'), 0),
         COALESCE(sum(GREATEST((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) - COALESCE(o.discount, 0), 0) * 0.60), 0),
         COALESCE(sum(GREATEST((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) - COALESCE(o.discount, 0), 0) * 0.40), 0)
  FROM public.delivery_zones z
  LEFT JOIN public.orders o
    ON o.zone_id = z.id
   AND (_since IS NULL OR o.created_at >= _since)
   AND (_until IS NULL OR o.created_at < _until)
  WHERE app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  GROUP BY z.id, z.name
  ORDER BY z.name;
$function$;

REVOKE ALL ON FUNCTION public.super_zone_stats(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.super_zone_stats(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.super_zone_stats(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_zone_stats(timestamptz, timestamptz) TO service_role;