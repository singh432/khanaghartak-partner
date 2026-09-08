DROP FUNCTION IF EXISTS public.super_zone_stats(timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.super_zone_stats(_since timestamp with time zone DEFAULT NULL::timestamp with time zone, _until timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(zone_id uuid, zone_name text, orders_count bigint, delivered_count bigint, cancelled_count bigint, revenue numeric, food_value numeric, delivery_fees numeric, platform_fees numeric, restaurant_payout numeric, rider_payout numeric, net_profit numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  RETURN QUERY
    SELECT z.id,
           z.name,
           count(o.id)::bigint,
           count(o.id) FILTER (WHERE o.status = 'delivered')::bigint,
           count(o.id) FILTER (WHERE o.status IN ('cancelled','rejected'))::bigint,
           coalesce(sum(o.total) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.subtotal) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.delivery_fee) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.platform_fee) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum(o.subtotal * 0.85) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) * 0.60) FILTER (WHERE o.status = 'delivered'), 0),
           coalesce(sum((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) * 0.40) FILTER (WHERE o.status = 'delivered'), 0)
      FROM public.delivery_zones z
      LEFT JOIN public.orders o
        ON o.zone_id = z.id
       AND (_since IS NULL OR o.created_at >= _since)
       AND (_until IS NULL OR o.created_at < _until)
     GROUP BY z.id, z.name
     ORDER BY z.name;
END;
$function$;