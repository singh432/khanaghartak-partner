CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_stale_delivery_offers()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.delivery_offers
    SET status = 'expired', responded_at = now()
    WHERE status IN ('queued', 'active')
      AND COALESCE(offered_at, created_at) < now() - interval '24 hours'
    RETURNING id
  )
  SELECT count(*)::integer FROM updated
$$;

REVOKE ALL ON FUNCTION public.expire_stale_delivery_offers() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_delivery_offers() TO service_role;

SELECT cron.schedule(
  'expire-stale-delivery-offers',
  '0 0 * * *',
  $$SELECT public.expire_stale_delivery_offers();$$
);