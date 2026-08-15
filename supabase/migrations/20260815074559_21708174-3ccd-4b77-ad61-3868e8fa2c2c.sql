DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories"
ON public.categories FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = categories.restaurant_id AND r.status = 'active'
  )
);

DROP POLICY IF EXISTS "Public read available menu" ON public.menu_items;
CREATE POLICY "Public read available menu"
ON public.menu_items FOR SELECT
USING (
  COALESCE(is_available, true) = true
  AND COALESCE(is_out_of_stock, false) = false
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = menu_items.restaurant_id AND r.status = 'active'
  )
);