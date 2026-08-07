ALTER FUNCTION public.place_order(jsonb, text, text, text, text, text, double precision, double precision) SECURITY DEFINER;
ALTER FUNCTION public.place_order(jsonb, text, text, text, text, text, double precision, double precision) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, text, text, text, text, text, double precision, double precision) TO authenticated;