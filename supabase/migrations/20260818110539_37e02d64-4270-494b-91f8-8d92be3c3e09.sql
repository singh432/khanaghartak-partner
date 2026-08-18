CREATE OR REPLACE FUNCTION public.free_delivery_status()
RETURNS TABLE(active boolean, remaining integer, starts_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT false, 0, timestamptz '2026-08-15 00:00:00+05:30'
$$;