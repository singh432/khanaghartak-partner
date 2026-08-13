create extension if not exists pgcrypto with schema extensions;

-- ---------- helpers ----------
create or replace function app_private.norm_phone(_p text)
returns text language sql immutable set search_path = public as $$
  select right(regexp_replace(coalesce(_p,''), '[^0-9]', '', 'g'), 10)
$$;

-- ---------- tables ----------
create table if not exists public.phone_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
grant all on public.phone_otps to service_role;
alter table public.phone_otps enable row level security;
create policy "no direct access to otps" on public.phone_otps for select to authenticated using (false);

create table if not exists public.verified_phones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone text not null,
  verified_at timestamptz not null default now(),
  unique (user_id, phone)
);
grant select on public.verified_phones to authenticated;
grant all on public.verified_phones to service_role;
alter table public.verified_phones enable row level security;
create policy "own verified phones" on public.verified_phones for select to authenticated using (user_id = auth.uid());

create table if not exists public.blocked_phones (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  reason text,
  blocked_by uuid,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.blocked_phones to authenticated;
grant all on public.blocked_phones to service_role;
alter table public.blocked_phones enable row level security;
create policy "super admin reads blocked phones" on public.blocked_phones for select to authenticated
  using (app_private.has_role(auth.uid(), 'super_admin'::app_role));
create policy "super admin blocks phones" on public.blocked_phones for insert to authenticated
  with check (app_private.has_role(auth.uid(), 'super_admin'::app_role));
create policy "super admin unblocks phones" on public.blocked_phones for delete to authenticated
  using (app_private.has_role(auth.uid(), 'super_admin'::app_role));

create table if not exists public.cod_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text,
  disabled_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.cod_restrictions to authenticated;
grant all on public.cod_restrictions to service_role;
alter table public.cod_restrictions enable row level security;
create policy "own cod restriction" on public.cod_restrictions for select to authenticated
  using (user_id = auth.uid() or app_private.has_role(auth.uid(), 'super_admin'::app_role));

alter table public.orders add column if not exists is_fake boolean not null default false;
alter table public.orders add column if not exists flagged_by uuid;

-- ---------- OTP rpcs ----------
create or replace function public.create_phone_otp(_user_id uuid, _phone text, _code_hash text)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare _p text := app_private.norm_phone(_phone); _recent int;
begin
  if _p is null or length(_p) <> 10 then raise exception 'Invalid phone'; end if;
  select count(*) into _recent from public.phone_otps
   where user_id = _user_id and created_at > now() - interval '1 hour';
  if _recent >= 5 then raise exception 'Too many code requests. Please try again later.'; end if;
  insert into public.phone_otps (user_id, phone, code_hash, expires_at)
  values (_user_id, _p, _code_hash, now() + interval '10 minutes');
end;
$$;
revoke all on function public.create_phone_otp(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_phone_otp(uuid, text, text) to service_role;

create or replace function public.verify_phone_otp(_phone text, _code text)
returns boolean language plpgsql security definer set search_path = public, app_private, extensions as $$
declare _p text := app_private.norm_phone(_phone); _row public.phone_otps; _hash text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into _row from public.phone_otps
   where user_id = auth.uid() and phone = _p and consumed_at is null
   order by created_at desc limit 1;
  if not found then raise exception 'Please request a new code'; end if;
  if _row.expires_at < now() then raise exception 'Code expired, please request a new one'; end if;
  if _row.attempts >= 5 then raise exception 'Too many wrong attempts, please request a new code'; end if;

  _hash := encode(extensions.digest(coalesce(_code,'') || ':' || _p, 'sha256'), 'hex');
  if _hash <> _row.code_hash then
    update public.phone_otps set attempts = attempts + 1 where id = _row.id;
    return false;
  end if;

  update public.phone_otps set consumed_at = now() where id = _row.id;
  insert into public.verified_phones (user_id, phone) values (auth.uid(), _p)
    on conflict (user_id, phone) do update set verified_at = now();
  return true;
end;
$$;

-- ---------- customer order gate ----------
create or replace function public.cod_status(_phone text default null)
returns table(needs_otp boolean, phone_verified boolean, cod_allowed boolean, disabled_until timestamptz, blocked boolean)
language plpgsql stable security definer set search_path = public, app_private as $$
declare _p text := app_private.norm_phone(_phone); _delivered int := 0; _uid uuid := auth.uid();
begin
  if _uid is null then return; end if;
  select count(*) into _delivered from public.orders o
    where o.user_id = _uid and o.status = 'delivered' and o.is_fake = false;
  return query select
    (_delivered = 0),
    (length(coalesce(_p,'')) = 10 and exists (
       select 1 from public.verified_phones v where v.user_id = _uid and v.phone = _p)),
    not exists (select 1 from public.cod_restrictions c where c.user_id = _uid and c.disabled_until > now()),
    (select c.disabled_until from public.cod_restrictions c where c.user_id = _uid and c.disabled_until > now()),
    (length(coalesce(_p,'')) = 10 and exists (
       select 1 from public.blocked_phones b where app_private.norm_phone(b.phone) = _p));
end;
$$;

-- ---------- super admin actions ----------
create or replace function public.super_flag_fake_order(_order_id uuid, _fake boolean)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare _uid uuid; _fakes int;
begin
  if not app_private.has_role(auth.uid(), 'super_admin'::app_role) then
    raise exception 'Only super admin';
  end if;
  update public.orders set is_fake = _fake, flagged_by = case when _fake then auth.uid() else null end,
         updated_at = now()
   where id = _order_id returning user_id into _uid;
  if _uid is null then raise exception 'Order not found'; end if;

  select count(*) into _fakes from public.orders where user_id = _uid and is_fake;
  if _fakes >= 2 then
    insert into public.cod_restrictions (user_id, reason, disabled_until)
    values (_uid, 'Repeated fake cash-on-delivery orders', now() + interval '30 days')
    on conflict (user_id) do update
      set disabled_until = greatest(public.cod_restrictions.disabled_until, now() + interval '30 days'),
          reason = 'Repeated fake cash-on-delivery orders', updated_at = now();
  else
    delete from public.cod_restrictions where user_id = _uid;
  end if;
end;
$$;

create or replace function public.super_set_cod_restriction(_user_id uuid, _days int, _reason text default null)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if not app_private.has_role(auth.uid(), 'super_admin'::app_role) then
    raise exception 'Only super admin';
  end if;
  if _days is null or _days <= 0 then
    delete from public.cod_restrictions where user_id = _user_id;
  else
    insert into public.cod_restrictions (user_id, reason, disabled_until)
    values (_user_id, coalesce(_reason, 'Blocked by admin'), now() + make_interval(days => _days))
    on conflict (user_id) do update
      set disabled_until = now() + make_interval(days => _days),
          reason = coalesce(_reason, 'Blocked by admin'), updated_at = now();
  end if;
end;
$$;

-- ---------- place_order hardening ----------
CREATE OR REPLACE FUNCTION public.place_order(_items jsonb, _customer_name text, _customer_phone text, _address text, _landmark text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _latitude double precision DEFAULT NULL::double precision, _longitude double precision DEFAULT NULL::double precision)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _platform_fee numeric;
  _per_km numeric;
  _max_radius numeric;
  _subtotal numeric := 0;
  _delivery_fee numeric := 0;
  _distance_km numeric;
  _total numeric;
  _server_items jsonb := '[]'::jsonb;
  _entry jsonb;
  _item_id uuid;
  _qty int;
  _portion text;
  _unit_price numeric;
  _label text;
  _menu record;
  _order_id uuid;
  _rid uuid;
  _rlat double precision;
  _rlng double precision;
  _min_order numeric := 0;
  _is_open boolean;
  _rstatus text;
  _promo_start timestamptz := timestamptz '2026-08-15 00:00:00+05:30';
  _promo_free boolean := false;
  _np text;
  _delivered int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_blocks WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Account is blocked';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Too many items'; END IF;
  IF length(coalesce(_customer_name,'')) < 2 OR length(_customer_name) > 80 THEN RAISE EXCEPTION 'Invalid name'; END IF;
  IF _customer_phone !~ '^[0-9+\-\s]{7,15}$' THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF length(coalesce(_address,'')) < 8 OR length(_address) > 300 THEN RAISE EXCEPTION 'Invalid address'; END IF;
  IF _latitude IS NULL OR _longitude IS NULL THEN
    RAISE EXCEPTION 'Please pin your delivery location';
  END IF;

  _np := app_private.norm_phone(_customer_phone);
  IF length(coalesce(_np,'')) <> 10 THEN RAISE EXCEPTION 'Invalid phone'; END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_phones b WHERE app_private.norm_phone(b.phone) = _np) THEN
    RAISE EXCEPTION 'This phone number is blocked. Please contact support.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.cod_restrictions c WHERE c.user_id = _uid AND c.disabled_until > now()) THEN
    RAISE EXCEPTION 'Cash on Delivery is temporarily disabled for your account. Prepaid orders only — please contact support.';
  END IF;
  SELECT count(*) INTO _delivered FROM public.orders o
    WHERE o.user_id = _uid AND o.status = 'delivered' AND o.is_fake = false;
  IF _delivered = 0 AND NOT EXISTS (
      SELECT 1 FROM public.verified_phones v WHERE v.user_id = _uid AND v.phone = _np) THEN
    RAISE EXCEPTION 'Please verify your phone number with the OTP before placing your first order.';
  END IF;

  SELECT platform_fee, delivery_per_km, max_delivery_radius_km
    INTO _platform_fee, _per_km, _max_radius
    FROM public.platform_settings LIMIT 1;
  _platform_fee := coalesce(_platform_fee, 10);
  _per_km := coalesce(_per_km, 10);
  _max_radius := coalesce(_max_radius, 10);

  FOR _entry IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _item_id := (_entry->>'id')::uuid;
    _qty := (_entry->>'qty')::int;
    _portion := lower(coalesce(_entry->>'portion', 'full'));
    IF _portion NOT IN ('full','half','kg','g500','g250','piece') THEN RAISE EXCEPTION 'Invalid portion'; END IF;
    IF _qty IS NULL OR _qty < 1 OR _qty > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, coalesce(offer_price, price) AS price,
           coalesce(half_offer_price, half_price) AS half_price,
           price_kg, price_500g, price_250g, price_piece,
           is_available, is_out_of_stock, restaurant_id
      INTO _menu FROM public.menu_items WHERE id = _item_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Menu item not found'; END IF;
    IF NOT _menu.is_available OR _menu.is_out_of_stock THEN RAISE EXCEPTION 'Item % is not available', _menu.name; END IF;

    _label := NULL;
    IF _portion = 'half' THEN
      IF _menu.half_price IS NULL THEN RAISE EXCEPTION 'Half plate is not available for %', _menu.name; END IF;
      _unit_price := _menu.half_price; _label := 'Half';
    ELSIF _portion = 'kg' THEN
      IF _menu.price_kg IS NULL THEN RAISE EXCEPTION '1 kg is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_kg; _label := '1 kg';
    ELSIF _portion = 'g500' THEN
      IF _menu.price_500g IS NULL THEN RAISE EXCEPTION '500 g is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_500g; _label := '500 g';
    ELSIF _portion = 'g250' THEN
      IF _menu.price_250g IS NULL THEN RAISE EXCEPTION '250 g is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_250g; _label := '250 g';
    ELSIF _portion = 'piece' THEN
      IF _menu.price_piece IS NULL THEN RAISE EXCEPTION 'Per piece is not available for %', _menu.name; END IF;
      _unit_price := _menu.price_piece; _label := 'per piece';
    ELSE
      _unit_price := _menu.price;
    END IF;

    IF _rid IS NULL THEN _rid := _menu.restaurant_id;
    ELSIF _rid <> _menu.restaurant_id THEN RAISE EXCEPTION 'All items must belong to the same restaurant';
    END IF;
    _subtotal := _subtotal + (_unit_price * _qty);
    _server_items := _server_items || jsonb_build_object(
      'id', _menu.id,
      'name', CASE WHEN _label IS NULL THEN _menu.name ELSE _menu.name || ' (' || _label || ')' END,
      'portion', _portion,
      'price', _unit_price,
      'qty', _qty);
  END LOOP;

  SELECT min_order_value, latitude, longitude, is_open, status
    INTO _min_order, _rlat, _rlng, _is_open, _rstatus
    FROM public.restaurants WHERE id = _rid;

  IF _rstatus IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'This restaurant is not accepting orders right now.';
  END IF;
  IF _is_open IS NOT TRUE THEN
    RAISE EXCEPTION 'This restaurant is closed right now. Please try again when it reopens.';
  END IF;

  IF _subtotal < coalesce(_min_order, 0) THEN
    RAISE EXCEPTION 'Minimum order value is %', _min_order;
  END IF;
  IF _rlat IS NULL OR _rlng IS NULL THEN
    RAISE EXCEPTION 'Restaurant location is not set';
  END IF;

  _distance_km := 1.3 * (
    2 * 6371 * asin(sqrt(
      power(sin(radians((_latitude - _rlat)/2)), 2) +
      cos(radians(_rlat)) * cos(radians(_latitude)) *
      power(sin(radians((_longitude - _rlng)/2)), 2)
    ))
  );

  IF _distance_km > _max_radius THEN
    RAISE EXCEPTION 'Sorry, this restaurant does not deliver to your selected location.';
  END IF;

  _promo_free := (now() >= _promo_start)
    AND ((SELECT count(*) FROM public.orders o WHERE o.created_at >= _promo_start) < 50);

  IF _promo_free THEN
    _delivery_fee := 0;
  ELSE
    _delivery_fee := round(_distance_km * _per_km);
  END IF;
  _total := _subtotal + _delivery_fee + _platform_fee;

  INSERT INTO public.orders (
    user_id, restaurant_id, customer_name, customer_phone, address, landmark, notes,
    latitude, longitude, items, subtotal, delivery_fee, platform_fee, distance_km, total, payment_method, status
  ) VALUES (
    _uid, _rid, _customer_name, _customer_phone, _address, nullif(_landmark,''), nullif(_notes,''),
    _latitude, _longitude, _server_items, _subtotal, _delivery_fee, _platform_fee,
    round(_distance_km::numeric, 2), _total, 'cod', 'placed'
  ) RETURNING id INTO _order_id;

  RETURN _order_id;
END;
$function$;