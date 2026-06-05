
-- 1. Remove direct INSERT on orders (must go through place_order RPC)
DROP POLICY IF EXISTS "Users insert own orders" ON public.orders;

-- 2. Restrict platform_settings reads to super admins
DROP POLICY IF EXISTS "Public read platform settings" ON public.platform_settings;
CREATE POLICY "Super admin read platform settings" ON public.platform_settings
  FOR SELECT USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

-- 3. Replace rider UPDATE policy with SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Riders update assignable orders" ON public.orders;

CREATE OR REPLACE FUNCTION public.rider_accept_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;
  UPDATE public.orders
     SET rider_id = auth.uid(), updated_at = now()
   WHERE id = _order_id
     AND status = 'out_for_delivery'
     AND rider_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is not available'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rider_mark_delivered(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;
  UPDATE public.orders
     SET status = 'delivered', updated_at = now()
   WHERE id = _order_id
     AND rider_id = auth.uid()
     AND status = 'out_for_delivery';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is not assigned to you or not in transit'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rider_accept_order(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rider_mark_delivered(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rider_accept_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_mark_delivered(uuid) TO authenticated;

-- 4. Scope menu-image storage to the admin's own restaurant folder
DROP POLICY IF EXISTS "Admin upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete menu images" ON storage.objects;

CREATE POLICY "Admin upload own menu images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND app_private.has_role(auth.uid(), 'restaurant_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = split_part(name, '/', 1)
    )
  );

CREATE POLICY "Admin update own menu images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND app_private.has_role(auth.uid(), 'restaurant_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = split_part(name, '/', 1)
    )
  );

CREATE POLICY "Admin delete own menu images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND app_private.has_role(auth.uid(), 'restaurant_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.owner_id = auth.uid()
        AND r.id::text = split_part(name, '/', 1)
    )
  );
