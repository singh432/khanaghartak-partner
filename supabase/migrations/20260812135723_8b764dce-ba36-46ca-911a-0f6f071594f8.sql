revoke execute on function public.owns_restaurant_folder(text) from public, anon;
grant execute on function public.owns_restaurant_folder(text) to authenticated, service_role;