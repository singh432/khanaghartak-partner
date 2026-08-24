UPDATE public.platform_settings
SET delivery_slabs = '[
  {"max_order":199,"rates":[20,30,40,50]},
  {"max_order":249,"rates":[10,20,30,40]},
  {"max_order":299,"rates":[0,10,20,30]},
  {"max_order":399,"rates":[0,0,10,20]},
  {"max_order":null,"rates":[0,0,0,10]}
]'::jsonb,
    max_delivery_radius_km = 8,
    updated_at = now();

CREATE OR REPLACE FUNCTION public.compute_delivery_fee(_subtotal numeric, _distance_km numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _slabs jsonb; _extra numeric; _slab jsonb; _band int; _fee numeric := 0;
  _d numeric := greatest(coalesce(_distance_km, 0), 0);
  _sub numeric := greatest(coalesce(_subtotal, 0), 0);
BEGIN
  IF extract(dow from (now() AT TIME ZONE 'Asia/Kolkata')) = 0 AND _sub >= 300 THEN
    RETURN 0;
  END IF;

  SELECT delivery_slabs, delivery_extra_per_km INTO _slabs, _extra
    FROM public.platform_settings LIMIT 1;
  _slabs := coalesce(_slabs, '[{"max_order":null,"rates":[0,0,0,0]}]'::jsonb);
  _extra := coalesce(_extra, 8);

  FOR _slab IN SELECT * FROM jsonb_array_elements(_slabs) LOOP
    IF (_slab->>'max_order') IS NULL OR _sub <= (_slab->>'max_order')::numeric THEN
      EXIT;
    END IF;
  END LOOP;

  IF _d <= 2 THEN _band := 0;
  ELSIF _d <= 4 THEN _band := 1;
  ELSIF _d <= 6 THEN _band := 2;
  ELSE _band := 3;
  END IF;

  _fee := coalesce((_slab->'rates'->>_band)::numeric, 0);
  IF _d > 8 THEN _fee := _fee + ceil(_d - 8) * _extra; END IF;
  RETURN greatest(round(_fee), 0);
END;
$function$;