REVOKE EXECUTE ON FUNCTION public.rider_list_offers() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rider_set_base_location(double precision, double precision) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.super_assign_rider(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.rider_accept_order(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rider_list_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_set_base_location(double precision, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_assign_rider(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rider_accept_order(uuid) TO authenticated;