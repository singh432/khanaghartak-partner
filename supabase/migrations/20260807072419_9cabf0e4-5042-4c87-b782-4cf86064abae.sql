-- 1) Restaurants: only super_admin may change approval status or ownership
CREATE OR REPLACE FUNCTION public.enforce_restaurant_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- self-serve onboarding always starts as pending
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only the platform admin can change restaurant approval status';
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Restaurant ownership cannot be reassigned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_restaurant_status_change_ins ON public.restaurants;
CREATE TRIGGER enforce_restaurant_status_change_ins
  BEFORE INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_status_change();

DROP TRIGGER IF EXISTS enforce_restaurant_status_change_upd ON public.restaurants;
CREATE TRIGGER enforce_restaurant_status_change_upd
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_status_change();

-- 2) Rider profiles: only super_admin may change approval status or ownership
CREATE OR REPLACE FUNCTION public.enforce_rider_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only the platform admin can change rider approval status';
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Rider profile cannot be reassigned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_rider_status_change_ins ON public.rider_profiles;
CREATE TRIGGER enforce_rider_status_change_ins
  BEFORE INSERT ON public.rider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rider_status_change();

DROP TRIGGER IF EXISTS enforce_rider_status_change_upd ON public.rider_profiles;
CREATE TRIGGER enforce_rider_status_change_upd
  BEFORE UPDATE ON public.rider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_rider_status_change();