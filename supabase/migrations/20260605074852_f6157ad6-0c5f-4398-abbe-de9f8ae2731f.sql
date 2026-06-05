
-- 1) Restaurants: ensure new rows default to pending
ALTER TABLE public.restaurants ALTER COLUMN status SET DEFAULT 'pending';

-- 2) Rider profiles table for approval workflow
CREATE TABLE IF NOT EXISTS public.rider_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  vehicle text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | suspended
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rider_profiles TO authenticated;
GRANT ALL ON public.rider_profiles TO service_role;

ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders read own profile" ON public.rider_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Super admin read all rider profiles" ON public.rider_profiles
  FOR SELECT TO authenticated USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));
CREATE POLICY "Super admin write rider profiles" ON public.rider_profiles
  FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.touch_rider_profiles_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_touch_rider_profiles ON public.rider_profiles;
CREATE TRIGGER trg_touch_rider_profiles BEFORE UPDATE ON public.rider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_rider_profiles_updated_at();

-- 3) become_rider now creates a pending profile (still grants role so they can log into rider panel)
CREATE OR REPLACE FUNCTION public.become_rider(_full_name text DEFAULT NULL, _phone text DEFAULT NULL, _vehicle text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'rider')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.rider_profiles (user_id, full_name, phone, vehicle, status)
    VALUES (auth.uid(), nullif(trim(_full_name),''), nullif(trim(_phone),''), nullif(trim(_vehicle),''), 'pending')
    ON CONFLICT (user_id) DO UPDATE
      SET full_name = COALESCE(EXCLUDED.full_name, public.rider_profiles.full_name),
          phone     = COALESCE(EXCLUDED.phone,     public.rider_profiles.phone),
          vehicle   = COALESCE(EXCLUDED.vehicle,   public.rider_profiles.vehicle);
END;
$$;

REVOKE ALL ON FUNCTION public.become_rider(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.become_rider(text, text, text) TO authenticated;

-- 4) Rider RPCs now require approved profile
CREATE OR REPLACE FUNCTION public.rider_accept_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = auth.uid() AND status = 'approved') THEN
    RAISE EXCEPTION 'Your rider account is not approved yet';
  END IF;
  UPDATE public.orders
     SET rider_id = auth.uid(), updated_at = now()
   WHERE id = _order_id AND status = 'out_for_delivery' AND rider_id IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is not available'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.rider_mark_delivered(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN
    RAISE EXCEPTION 'Not a rider';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.rider_profiles WHERE user_id = auth.uid() AND status = 'approved') THEN
    RAISE EXCEPTION 'Your rider account is not approved yet';
  END IF;
  UPDATE public.orders
     SET status = 'delivered', updated_at = now()
   WHERE id = _order_id AND rider_id = auth.uid() AND status = 'out_for_delivery';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is not assigned to you or not in transit'; END IF;
END;
$$;

-- 5) Approve / reject riders RPCs for super admin
CREATE OR REPLACE FUNCTION public.set_rider_status(_user_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'Only super admin';
  END IF;
  IF _status NOT IN ('pending','approved','rejected','suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.rider_profiles SET status = _status, updated_at = now() WHERE user_id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rider not found'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_rider_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_rider_status(uuid, text) TO authenticated;

-- 6) Backfill: existing restaurants currently 'active' stay active; existing riders are auto-approved
INSERT INTO public.rider_profiles (user_id, status)
SELECT ur.user_id, 'approved' FROM public.user_roles ur
WHERE ur.role = 'rider'
ON CONFLICT (user_id) DO UPDATE SET status = 'approved';
