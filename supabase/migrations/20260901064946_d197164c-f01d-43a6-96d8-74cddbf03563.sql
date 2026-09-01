REVOKE EXECUTE ON FUNCTION public.assign_entities_to_zone(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.zone_reassign_members() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.restaurant_set_zone() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.rider_set_zone() FROM anon, authenticated, public;
