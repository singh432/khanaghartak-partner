-- Auto-assign restaurants & riders to zones by pinned location

CREATE OR REPLACE FUNCTION public.assign_entities_to_zone(_zone_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _poly jsonb;
  _active boolean;
BEGIN
  SELECT polygon, is_active INTO _poly, _active FROM public.delivery_zones WHERE id = _zone_id;
  IF _poly IS NULL OR NOT _active THEN RETURN; END IF;

  UPDATE public.restaurants r
     SET zone_id = _zone_id
   WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
     AND public.point_in_polygon(r.latitude, r.longitude, _poly)
     AND (r.zone_id IS DISTINCT FROM _zone_id);

  UPDATE public.rider_profiles rp
     SET zone_id = _zone_id
   WHERE rp.base_latitude IS NOT NULL AND rp.base_longitude IS NOT NULL
     AND public.point_in_polygon(rp.base_latitude, rp.base_longitude, _poly)
     AND (rp.zone_id IS DISTINCT FROM _zone_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.zone_reassign_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assign_entities_to_zone(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zone_reassign_members ON public.delivery_zones;
CREATE TRIGGER trg_zone_reassign_members
AFTER INSERT OR UPDATE OF polygon, is_active ON public.delivery_zones
FOR EACH ROW EXECUTE FUNCTION public.zone_reassign_members();

-- Recalculate a restaurant's zone when its pinned location changes
CREATE OR REPLACE FUNCTION public.restaurant_set_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _z uuid;
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    _z := public.point_in_zone(NEW.latitude, NEW.longitude);
    IF _z IS NOT NULL THEN NEW.zone_id := _z; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restaurant_set_zone ON public.restaurants;
CREATE TRIGGER trg_restaurant_set_zone
BEFORE INSERT OR UPDATE OF latitude, longitude ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.restaurant_set_zone();

CREATE OR REPLACE FUNCTION public.rider_set_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _z uuid;
BEGIN
  IF NEW.base_latitude IS NOT NULL AND NEW.base_longitude IS NOT NULL THEN
    _z := public.point_in_zone(NEW.base_latitude, NEW.base_longitude);
    IF _z IS NOT NULL THEN NEW.zone_id := _z; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rider_set_zone ON public.rider_profiles;
CREATE TRIGGER trg_rider_set_zone
BEFORE INSERT OR UPDATE OF base_latitude, base_longitude ON public.rider_profiles
FOR EACH ROW EXECUTE FUNCTION public.rider_set_zone();

-- Back-fill existing rows
DO $$
DECLARE z record;
BEGIN
  FOR z IN SELECT id FROM public.delivery_zones WHERE is_active LOOP
    PERFORM public.assign_entities_to_zone(z.id);
  END LOOP;
END;
$$;
