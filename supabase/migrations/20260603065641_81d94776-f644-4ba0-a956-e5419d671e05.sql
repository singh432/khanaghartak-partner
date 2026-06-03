CREATE OR REPLACE FUNCTION public.create_my_restaurant(
  _name text,
  _tagline text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _delivery_time text DEFAULT '30-40 min',
  _delivery_charges numeric DEFAULT 25,
  _min_order_value numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _restaurant_id uuid;
  _clean_name text := nullif(trim(_name), '');
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _clean_name IS NULL OR char_length(_clean_name) < 2 OR char_length(_clean_name) > 80 THEN
    RAISE EXCEPTION 'Restaurant name must be between 2 and 80 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'restaurant_admin'::public.app_role
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'restaurant_admin'::public.app_role);
  END IF;

  SELECT id INTO _restaurant_id
  FROM public.restaurants
  WHERE owner_id = _uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF _restaurant_id IS NULL THEN
    INSERT INTO public.restaurants (
      owner_id,
      name,
      tagline,
      phone,
      address,
      status,
      is_open,
      delivery_time,
      delivery_charges,
      min_order_value,
      opening_time,
      closing_time
    ) VALUES (
      _uid,
      _clean_name,
      nullif(trim(coalesce(_tagline, '')), ''),
      nullif(trim(coalesce(_phone, '')), ''),
      nullif(trim(coalesce(_address, '')), ''),
      'active',
      true,
      coalesce(nullif(trim(coalesce(_delivery_time, '')), ''), '30-40 min'),
      greatest(coalesce(_delivery_charges, 25), 0),
      greatest(coalesce(_min_order_value, 0), 0),
      '09:00',
      '22:00'
    ) RETURNING id INTO _restaurant_id;
  ELSE
    UPDATE public.restaurants
    SET
      name = _clean_name,
      tagline = nullif(trim(coalesce(_tagline, '')), ''),
      phone = nullif(trim(coalesce(_phone, '')), ''),
      address = nullif(trim(coalesce(_address, '')), ''),
      delivery_time = coalesce(nullif(trim(coalesce(_delivery_time, '')), ''), delivery_time),
      delivery_charges = greatest(coalesce(_delivery_charges, delivery_charges), 0),
      min_order_value = greatest(coalesce(_min_order_value, min_order_value), 0),
      status = 'active',
      updated_at = now()
    WHERE id = _restaurant_id
    RETURNING id INTO _restaurant_id;
  END IF;

  INSERT INTO public.categories (restaurant_id, name, priority)
  SELECT _restaurant_id, seed.name, seed.priority
  FROM (VALUES
    ('Breakfast', 0),
    ('Main Course', 1),
    ('Snacks', 2),
    ('Beverages', 3)
  ) AS seed(name, priority)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.restaurant_id = _restaurant_id AND lower(c.name) = lower(seed.name)
  );

  RETURN _restaurant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_restaurant(text, text, text, text, text, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_my_restaurant(text, text, text, text, text, numeric, numeric) TO authenticated;

DROP POLICY IF EXISTS "Admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;

CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((auth.uid() = user_id) OR app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins read all profiles" ON public.profiles;

CREATE POLICY "Super admins read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));