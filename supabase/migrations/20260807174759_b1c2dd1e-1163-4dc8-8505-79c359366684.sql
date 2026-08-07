CREATE TABLE public.restaurant_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.restaurant_ratings TO authenticated;
GRANT SELECT ON public.restaurant_ratings TO anon;
GRANT ALL ON public.restaurant_ratings TO service_role;

ALTER TABLE public.restaurant_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ratings" ON public.restaurant_ratings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Customers rate their own delivered orders" ON public.restaurant_ratings FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.user_id = auth.uid()
      AND o.status = 'delivered'
      AND o.restaurant_id = restaurant_ratings.restaurant_id
  )
);

CREATE INDEX idx_restaurant_ratings_restaurant ON public.restaurant_ratings(restaurant_id);

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;
UPDATE public.restaurants SET rating = NULL, rating_count = 0;

CREATE OR REPLACE FUNCTION public.refresh_restaurant_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE rid uuid;
BEGIN
  rid := COALESCE(NEW.restaurant_id, OLD.restaurant_id);
  UPDATE public.restaurants r
  SET rating = sub.avg_rating, rating_count = sub.cnt
  FROM (
    SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS cnt
    FROM public.restaurant_ratings WHERE restaurant_id = rid
  ) sub
  WHERE r.id = rid;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_restaurant_rating() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_refresh_restaurant_rating
AFTER INSERT OR UPDATE OR DELETE ON public.restaurant_ratings
FOR EACH ROW EXECUTE FUNCTION public.refresh_restaurant_rating();