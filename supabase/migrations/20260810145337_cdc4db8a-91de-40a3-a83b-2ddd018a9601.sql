CREATE TABLE IF NOT EXISTS public.rider_locations (
  rider_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.rider_locations TO authenticated;
GRANT ALL ON public.rider_locations TO service_role;

ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders manage own live location" ON public.rider_locations;
CREATE POLICY "Riders manage own live location"
  ON public.rider_locations FOR ALL TO authenticated
  USING (rider_id = auth.uid())
  WITH CHECK (rider_id = auth.uid());

DROP POLICY IF EXISTS "Super admin reads rider locations" ON public.rider_locations;
CREATE POLICY "Super admin reads rider locations"
  ON public.rider_locations FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

CREATE OR REPLACE FUNCTION public.rider_update_live_location(_lat double precision, _lng double precision, _accuracy double precision DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT app_private.has_role(auth.uid(), 'rider'::app_role) THEN RAISE EXCEPTION 'Not a rider'; END IF;
  IF _lat IS NULL OR _lng IS NULL OR _lat < -90 OR _lat > 90 OR _lng < -180 OR _lng > 180 THEN
    RAISE EXCEPTION 'Invalid location';
  END IF;
  INSERT INTO public.rider_locations (rider_id, latitude, longitude, accuracy, updated_at)
  VALUES (auth.uid(), _lat, _lng, _accuracy, now())
  ON CONFLICT (rider_id) DO UPDATE
    SET latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy = EXCLUDED.accuracy,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.order_rider_location(_order_id uuid)
RETURNS TABLE(latitude double precision, longitude double precision, updated_at timestamptz, rider_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'app_private'
AS $$
DECLARE _o record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT o.user_id, o.rider_id, o.status, o.restaurant_id INTO _o
    FROM public.orders o WHERE o.id = _order_id;
  IF NOT FOUND OR _o.rider_id IS NULL THEN RETURN; END IF;
  IF _o.status NOT IN ('out_for_delivery','preparing','accepted') THEN RETURN; END IF;

  IF NOT (
    _o.user_id = auth.uid()
    OR _o.rider_id = auth.uid()
    OR app_private.has_role(auth.uid(), 'super_admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _o.restaurant_id AND r.owner_id = auth.uid())
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT rl.latitude, rl.longitude, rl.updated_at, rp.full_name
      FROM public.rider_locations rl
      LEFT JOIN public.rider_profiles rp ON rp.user_id = rl.rider_id
     WHERE rl.rider_id = _o.rider_id
       AND rl.updated_at > now() - interval '15 minutes';
END;
$$;