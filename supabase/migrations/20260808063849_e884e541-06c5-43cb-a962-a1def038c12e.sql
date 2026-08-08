UPDATE public.platform_settings SET max_delivery_radius_km = 5, updated_at = now();
ALTER TABLE public.platform_settings ALTER COLUMN max_delivery_radius_km SET DEFAULT 5;