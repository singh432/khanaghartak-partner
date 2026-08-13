ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_error text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS notification_log_provider_sid_idx ON public.notification_log (provider_sid);

CREATE OR REPLACE FUNCTION public.cod_status(_phone text DEFAULT NULL::text)
 RETURNS TABLE(needs_otp boolean, phone_verified boolean, cod_allowed boolean, disabled_until timestamp with time zone, blocked boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
declare
  _p text := app_private.norm_phone(_phone);
  _uid uuid := auth.uid();
  _verified boolean;
begin
  if _uid is null then return; end if;

  _verified := length(coalesce(_p,'')) = 10 and exists (
    select 1 from public.verified_phones v
     where v.user_id = _uid and app_private.norm_phone(v.phone) = _p);

  return query select
    (length(coalesce(_p,'')) = 10 and not _verified),
    _verified,
    not exists (select 1 from public.cod_restrictions c where c.user_id = _uid and c.disabled_until > now()),
    (select c.disabled_until from public.cod_restrictions c where c.user_id = _uid and c.disabled_until > now()),
    (length(coalesce(_p,'')) = 10 and exists (
       select 1 from public.blocked_phones b where app_private.norm_phone(b.phone) = _p));
end;
$function$;