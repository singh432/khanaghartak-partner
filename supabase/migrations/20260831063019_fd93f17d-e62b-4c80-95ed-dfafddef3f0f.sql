CREATE POLICY "Zone manager updates own zone"
ON public.delivery_zones
FOR UPDATE
TO authenticated
USING (public.is_zone_manager_of(id))
WITH CHECK (public.is_zone_manager_of(id));

GRANT UPDATE ON public.delivery_zones TO authenticated;