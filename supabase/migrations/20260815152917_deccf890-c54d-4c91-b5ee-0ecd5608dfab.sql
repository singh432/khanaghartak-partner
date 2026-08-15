UPDATE public.platform_settings
SET max_delivery_radius_km = 7,
    updated_at = now()
WHERE max_delivery_radius_km IS NOT NULL;

ALTER TABLE public.platform_settings
ALTER COLUMN max_delivery_radius_km SET DEFAULT 7;