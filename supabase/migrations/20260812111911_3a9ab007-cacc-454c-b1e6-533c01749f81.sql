ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS phone_alt text;

REVOKE SELECT (phone_alt) ON public.restaurants FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_restaurant_contacts(_restaurant_id uuid)
RETURNS TABLE(phone text, phone_alt text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _restaurant_id AND r.owner_id = auth.uid())
     OR EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.restaurant_id = _restaurant_id
           AND o.rider_id = auth.uid()
           AND o.status IN ('preparing','out_for_delivery','accepted')
     )
  THEN
    RETURN QUERY SELECT r.phone, r.phone_alt FROM public.restaurants r WHERE r.id = _restaurant_id;
  END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_contacts(uuid) TO authenticated;