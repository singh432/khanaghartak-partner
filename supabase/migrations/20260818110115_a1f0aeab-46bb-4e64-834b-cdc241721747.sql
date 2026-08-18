CREATE OR REPLACE FUNCTION public.public_pricing()
RETURNS TABLE(platform_fee numeric, delivery_per_km numeric, max_delivery_radius_km numeric, delivery_slabs jsonb, delivery_extra_per_km numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.platform_fee, s.delivery_per_km, s.max_delivery_radius_km, s.delivery_slabs, s.delivery_extra_per_km
  FROM public.platform_settings s
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.public_pricing() TO anon, authenticated;