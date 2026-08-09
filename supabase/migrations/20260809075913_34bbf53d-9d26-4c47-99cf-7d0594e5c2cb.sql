REVOKE SELECT (phone) ON public.restaurants FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_restaurant_phone(_restaurant_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE _phone text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role)
     OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _restaurant_id AND r.owner_id = auth.uid())
     OR EXISTS (
        SELECT 1 FROM public.orders o
         WHERE o.restaurant_id = _restaurant_id
           AND o.rider_id = auth.uid()
           AND o.status IN ('preparing','out_for_delivery','accepted')
     )
  THEN
    SELECT phone INTO _phone FROM public.restaurants WHERE id = _restaurant_id;
    RETURN _phone;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_phone(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_phone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.super_list_restaurant_phones()
RETURNS TABLE(id uuid, phone text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  RETURN QUERY SELECT r.id, r.phone FROM public.restaurants r;
END;
$$;

REVOKE ALL ON FUNCTION public.super_list_restaurant_phones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_list_restaurant_phones() TO authenticated;