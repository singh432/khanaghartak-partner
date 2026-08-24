CREATE OR REPLACE FUNCTION public.restaurant_current_status(_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.status FROM public.restaurants r WHERE r.id = _id
$$;

REVOKE ALL ON FUNCTION public.restaurant_current_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_current_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_current_status(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.restaurant_owner_id(_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.owner_id FROM public.restaurants r WHERE r.id = _id
$$;

REVOKE ALL ON FUNCTION public.restaurant_owner_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restaurant_owner_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restaurant_owner_id(uuid) TO service_role;

DROP POLICY IF EXISTS "Owner updates own restaurant" ON public.restaurants;

CREATE POLICY "Owner updates own restaurant"
ON public.restaurants
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND owner_id IS NOT DISTINCT FROM public.restaurant_owner_id(id)
  AND status IS NOT DISTINCT FROM public.restaurant_current_status(id)
);