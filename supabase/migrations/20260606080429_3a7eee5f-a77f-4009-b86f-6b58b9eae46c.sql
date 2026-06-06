
-- 1) Tighten rider RLS on orders: only see own assigned orders directly
DROP POLICY IF EXISTS "Riders see available and own orders" ON public.orders;
CREATE POLICY "Riders see own assigned orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'rider'::app_role) AND rider_id = auth.uid());

-- 2) Safe summary RPC for riders to browse unassigned deliveries
CREATE OR REPLACE FUNCTION public.rider_list_available_orders()
RETURNS TABLE (
  id uuid,
  restaurant_id uuid,
  restaurant_name text,
  restaurant_address text,
  drop_area text,
  total numeric,
  item_count int,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = auth.uid() AND status = 'approved') THEN
    RAISE EXCEPTION 'Your rider account is not approved yet';
  END IF;
  RETURN QUERY
    SELECT o.id,
           o.restaurant_id,
           r.name AS restaurant_name,
           r.address AS restaurant_address,
           -- area-only drop hint: prefer landmark, else last comma-separated chunk
           COALESCE(NULLIF(o.landmark,''), split_part(o.address, ',', GREATEST(1, array_length(string_to_array(o.address, ','), 1) - 1))) AS drop_area,
           o.total,
           COALESCE(jsonb_array_length(o.items), 0) AS item_count,
           o.created_at
      FROM public.orders o
      LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
     WHERE o.status = 'out_for_delivery' AND o.rider_id IS NULL
     ORDER BY o.created_at DESC
     LIMIT 100;
END;
$$;
REVOKE ALL ON FUNCTION public.rider_list_available_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rider_list_available_orders() TO authenticated;

-- 3) Remove orders from realtime publication (customer PII must not stream)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.orders';
  END IF;
END $$;

-- 4) Enable RLS on realtime.messages (deny-by-default for broadcast/presence)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- 5) Restrict platform_settings SELECT policy to authenticated super admins only
DROP POLICY IF EXISTS "Super admin read platform settings" ON public.platform_settings;
CREATE POLICY "Super admin read platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));
