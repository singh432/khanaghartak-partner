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
         COALESCE(sum((o.subtotal * 0.15 + o.platform_fee + o.delivery_fee) * 0.40 - COALESCE(o.discount, 0)) FILTER (WHERE o.status = 'delivered'), 0)
  FROM public.delivery_zones z
  LEFT JOIN public.orders o
    ON o.zone_id = z.id
   AND (_since IS NULL OR o.created_at >= _since)
   AND (_until IS NULL OR o.created_at < _until)
  WHERE app_private.has_role(auth.uid(), 'super_admin'::public.app_role)
  GROUP BY z.id, z.name
  ORDER BY z.name;
$$;

DROP FUNCTION IF EXISTS public.zone_list_orders(uuid, integer, timestamptz);
CREATE FUNCTION public.zone_list_orders(_zone_id uuid, _limit integer DEFAULT 200, _since timestamptz DEFAULT NULL)
RETURNS TABLE(id uuid, restaurant_id uuid, restaurant_name text, status text, items jsonb, subtotal numeric, delivery_fee numeric, platform_fee numeric, discount numeric, total numeric, distance_km numeric, customer_name text, customer_phone text, address text, landmark text, rider_id uuid, rider_name text, is_fake boolean, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.restaurant_id, r.name, o.status, o.items, o.subtotal, o.delivery_fee, o.platform_fee,
         COALESCE(o.discount, 0), o.total, o.distance_km, o.customer_name, o.customer_phone, o.address, o.landmark,
         o.rider_id, rp.full_name, o.is_fake, o.created_at, o.updated_at
  FROM public.orders o
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  LEFT JOIN public.rider_profiles rp ON rp.user_id = o.rider_id
  WHERE o.zone_id = _zone_id
    AND (public.is_zone_manager_of(_zone_id) OR app_private.has_role(auth.uid(), 'super_admin'::public.app_role))
    AND (_since IS NULL OR o.created_at >= _since)
  ORDER BY o.created_at DESC
  LIMIT COALESCE(_limit, 200);
$$;

REVOKE ALL ON FUNCTION public.zone_list_orders(uuid, integer, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.zone_list_orders(uuid, integer, timestamptz) TO authenticated;