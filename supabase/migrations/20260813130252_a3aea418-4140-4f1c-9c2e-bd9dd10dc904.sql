DO $do$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='place_order';
  d := replace(d,
    'IF _delivered = 0 AND NOT EXISTS (
      SELECT 1 FROM public.verified_phones v WHERE v.user_id = _uid AND v.phone = _np) THEN
    RAISE EXCEPTION ''Please verify your phone number with the OTP before placing your first order.'';
  END IF;',
    '-- OTP verification temporarily disabled');
  EXECUTE d;
END
$do$;

CREATE OR REPLACE FUNCTION public.cod_status(_phone text DEFAULT NULL)
RETURNS TABLE(needs_otp boolean, phone_verified boolean, cod_allowed boolean, disabled_until timestamptz, blocked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, app_private AS $$
declare _p text := app_private.norm_phone(_phone); _uid uuid := auth.uid();
begin
  if _uid is null then return; end if;
  return query select
    false,
    true,
    not exists (select 1 from public.cod_restrictions c where c.user_id = _uid and c.disabled_until > now()),
    (select c.disabled_until from public.cod_restrictions c where c.user_id = _uid and c.disabled_until > now()),
    (length(coalesce(_p,'')) = 10 and exists (
       select 1 from public.blocked_phones b where app_private.norm_phone(b.phone) = _p));
end;
$$;