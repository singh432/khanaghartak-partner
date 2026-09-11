REVOKE ALL ON FUNCTION public.super_zone_stats(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_zone_stats(timestamptz, timestamptz) TO authenticated;