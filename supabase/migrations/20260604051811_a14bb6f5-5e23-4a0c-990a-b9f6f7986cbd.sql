
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_rider ON public.orders(rider_id);

CREATE POLICY "Riders see available and own orders"
ON public.orders FOR SELECT TO authenticated
USING (
  app_private.has_role(auth.uid(), 'rider'::app_role)
  AND ((status = 'out_for_delivery' AND rider_id IS NULL) OR rider_id = auth.uid())
);

CREATE POLICY "Riders update assignable orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  app_private.has_role(auth.uid(), 'rider'::app_role)
  AND ((status = 'out_for_delivery' AND rider_id IS NULL) OR rider_id = auth.uid())
);
