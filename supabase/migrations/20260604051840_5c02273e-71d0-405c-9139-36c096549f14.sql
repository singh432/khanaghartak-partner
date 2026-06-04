
CREATE OR REPLACE FUNCTION public.become_rider()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'rider')
  ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.become_rider() TO authenticated;
