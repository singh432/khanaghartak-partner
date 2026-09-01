REVOKE EXECUTE ON FUNCTION public.super_cancel_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.super_cancel_order(uuid, text) TO authenticated, service_role;