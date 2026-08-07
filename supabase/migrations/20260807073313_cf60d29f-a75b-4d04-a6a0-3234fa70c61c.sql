ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_restaurant_name_key ON public.categories (restaurant_id, lower(name));