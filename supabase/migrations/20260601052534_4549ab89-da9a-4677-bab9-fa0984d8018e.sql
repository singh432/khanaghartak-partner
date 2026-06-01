REVOKE INSERT, UPDATE, DELETE ON public.categories FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.menu_items FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.restaurant FROM anon;

REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.profiles FROM anon;

GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.menu_items TO anon;
GRANT SELECT ON public.restaurant TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant TO authenticated;

GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.menu_items TO service_role;
GRANT ALL ON public.restaurant TO service_role;