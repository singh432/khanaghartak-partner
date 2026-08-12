ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS price_half_pound numeric,
  ADD COLUMN IF NOT EXISTS price_pound numeric,
  ADD COLUMN IF NOT EXISTS price_2pound numeric;