DROP POLICY IF EXISTS "Owner manages own restaurant" ON public.restaurants;

CREATE POLICY "Owner reads own restaurant" ON public.restaurants
FOR SELECT TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owner creates own restaurant" ON public.restaurants
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner updates own restaurant" ON public.restaurants
FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

REVOKE DELETE ON public.restaurants FROM authenticated;