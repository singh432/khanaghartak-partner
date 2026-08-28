CREATE OR REPLACE FUNCTION public.super_assign_zone_manager(_email text, _zone_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, app_private
AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  SELECT u.id INTO _uid FROM auth.users u WHERE lower(u.email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'No account found for %', _email; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'zone_manager')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.zone_managers (zone_id, user_id) VALUES (_zone_id, _uid)
    ON CONFLICT (zone_id, user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_remove_zone_manager(_zone_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  DELETE FROM public.zone_managers WHERE zone_id = _zone_id AND user_id = _user_id;
  IF NOT EXISTS (SELECT 1 FROM public.zone_managers WHERE user_id = _user_id) THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'zone_manager';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.super_list_zone_managers()
RETURNS TABLE(zone_id uuid, user_id uuid, email text, full_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, auth, app_private
AS $$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  RETURN QUERY
    SELECT zm.zone_id, zm.user_id, u.email::text, p.full_name
      FROM public.zone_managers zm
      JOIN auth.users u ON u.id = zm.user_id
      LEFT JOIN public.profiles p ON p.id = zm.user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.super_assign_zone_manager(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.super_remove_zone_manager(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.super_list_zone_managers() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.super_assign_zone_manager(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_remove_zone_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_list_zone_managers() TO authenticated;