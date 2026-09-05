ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS fssai_number text,
  ADD COLUMN IF NOT EXISTS fssai_image_url text;

ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS aadhaar_number text,
  ADD COLUMN IF NOT EXISTS aadhaar_image_url text;

CREATE OR REPLACE FUNCTION public.become_rider(_full_name text, _phone text, _vehicle text, _aadhaar_number text, _aadhaar_image_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  INSERT INTO public.rider_profiles (user_id, full_name, phone, vehicle, aadhaar_number, aadhaar_image_url, status)
  VALUES (_uid, _full_name, _phone, _vehicle, _aadhaar_number, _aadhaar_image_url, 'pending')
  ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        vehicle = EXCLUDED.vehicle,
        aadhaar_number = COALESCE(EXCLUDED.aadhaar_number, public.rider_profiles.aadhaar_number),
        aadhaar_image_url = COALESCE(EXCLUDED.aadhaar_image_url, public.rider_profiles.aadhaar_image_url),
        updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'rider')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.become_rider(text, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.become_rider(text, text, text, text, text) TO authenticated;