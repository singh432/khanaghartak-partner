-- 1. Restaurants: remove public read access to phone columns
REVOKE SELECT ON public.restaurants FROM anon, authenticated;

GRANT SELECT (id, name, tagline, image_url, banner_url, rating, delivery_time, is_open,
  address, created_at, owner_id, opening_time, closing_time, min_order_value,
  delivery_charges, status, updated_at, latitude, longitude, rating_count)
ON public.restaurants TO anon, authenticated;

-- owners/admins still write; they read phones through gated SECURITY DEFINER RPCs
GRANT INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;

-- 2. Rider locations: explicit per-command ownership checks
DROP POLICY IF EXISTS "Riders manage own live location" ON public.rider_locations;

CREATE POLICY "Riders read own live location"
  ON public.rider_locations FOR SELECT TO authenticated
  USING (rider_id = auth.uid());

CREATE POLICY "Riders insert own live location"
  ON public.rider_locations FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Riders update own live location"
  ON public.rider_locations FOR UPDATE TO authenticated
  USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Riders delete own live location"
  ON public.rider_locations FOR DELETE TO authenticated
  USING (rider_id = auth.uid());