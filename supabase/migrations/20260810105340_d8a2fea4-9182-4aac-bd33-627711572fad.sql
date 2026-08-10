DROP POLICY IF EXISTS "Anyone can read ratings" ON public.restaurant_ratings;

CREATE POLICY "Users read own ratings"
ON public.restaurant_ratings FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Owners read own restaurant ratings"
ON public.restaurant_ratings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_ratings.restaurant_id AND r.owner_id = auth.uid()));

CREATE POLICY "Super admin reads all ratings"
ON public.restaurant_ratings FOR SELECT TO authenticated
USING (app_private.has_role(auth.uid(), 'super_admin'::app_role));

REVOKE SELECT ON public.restaurant_ratings FROM anon;