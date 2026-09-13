UPDATE public.platform_settings
SET delivery_extra_per_km = 15;

CREATE OR REPLACE FUNCTION public.compute_delivery_fee(_subtotal numeric, _distance_km numeric)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  _slabs jsonb;
  _extra numeric;
  _slab jsonb;
  _band int;
  _fee numeric := 0;
  _d numeric := greatest(coalesce(_distance_km, 0), 0);
  _sub numeric := greatest(coalesce(_subtotal, 0), 0);
BEGIN
  SELECT delivery_slabs, delivery_extra_per_km
    INTO _slabs, _extra
    FROM public.platform_settings
    LIMIT 1;

  _slabs := coalesce(_slabs, '[{"max_order":null,"rates":[10,10,10,10]}]'::jsonb);
  _extra := coalesce(_extra, 15);

  FOR _slab IN SELECT * FROM jsonb_array_elements(_slabs) LOOP
    IF (_slab->>'max_order') IS NULL OR _sub <= (_slab->>'max_order')::numeric THEN
      EXIT;
    END IF;
  END LOOP;

  IF _d <= 1 THEN
    _band := 0;
  ELSIF _d <= 2 THEN
    _band := 1;
  ELSIF _d <= 3 THEN
    _band := 2;
  ELSE
    _band := 3;
  END IF;

  _fee := coalesce((_slab->'rates'->>_band)::numeric, 0);
  IF _d > 5 THEN
    _fee := _fee + ((_d - 5) * _extra);
  END IF;

  RETURN greatest(round(_fee, 2), 10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_delivery_fee(numeric, numeric) TO anon, authenticated, service_role;

WITH recalculated AS (
  SELECT
    id,
    public.compute_delivery_fee(subtotal, distance_km) AS new_delivery_fee
  FROM public.orders
  WHERE distance_km IS NOT NULL
)
UPDATE public.orders AS o
SET delivery_fee = r.new_delivery_fee,
    total = greatest(o.subtotal + r.new_delivery_fee + o.platform_fee - coalesce(o.discount, 0), 0),
    updated_at = now()
FROM recalculated AS r
WHERE o.id = r.id
  AND o.delivery_fee IS DISTINCT FROM r.new_delivery_fee;