DROP VIEW IF EXISTS public.restaurant_orders;

CREATE OR REPLACE FUNCTION public.owner_list_orders(_limit integer DEFAULT 200, _since timestamptz DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  status text,
  items jsonb,
  subtotal numeric,
  delivery_fee numeric,
  platform_fee numeric,
  total numeric,
  distance_km numeric,
  payment_method text,
  notes text,
  rejection_reason text,
  rider_id uuid,
  is_fake boolean,
  created_at timestamptz,
  updated_at timestamptz,
  customer_first_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.restaurant_id, o.status, o.items, o.subtotal, o.delivery_fee,
         o.platform_fee, o.total, o.distance_km, o.payment_method, o.notes,
         o.rejection_reason, o.rider_id, o.is_fake, o.created_at, o.updated_at,
         split_part(coalesce(o.customer_name, ''), ' ', 1) AS customer_first_name
  FROM public.orders o
  JOIN public.restaurants r ON r.id = o.restaurant_id
  WHERE r.owner_id = auth.uid()
    AND (_since IS NULL OR o.created_at >= _since)
  ORDER BY o.created_at DESC
  LIMIT greatest(1, least(coalesce(_limit, 200), 1000));
$$;

REVOKE ALL ON FUNCTION public.owner_list_orders(integer, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_list_orders(integer, timestamptz) TO authenticated;