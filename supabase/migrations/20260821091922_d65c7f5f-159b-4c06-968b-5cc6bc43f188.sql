CREATE OR REPLACE FUNCTION public.owner_order_update_safe(_old orders, _new orders)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    _new.id              IS NOT DISTINCT FROM _old.id
    AND _new.user_id          IS NOT DISTINCT FROM _old.user_id
    AND _new.restaurant_id    IS NOT DISTINCT FROM _old.restaurant_id
    AND _new.rider_id         IS NOT DISTINCT FROM _old.rider_id
    AND _new.items            IS NOT DISTINCT FROM _old.items
    AND _new.subtotal         IS NOT DISTINCT FROM _old.subtotal
    AND _new.delivery_fee     IS NOT DISTINCT FROM _old.delivery_fee
    AND _new.platform_fee     IS NOT DISTINCT FROM _old.platform_fee
    AND _new.distance_km      IS NOT DISTINCT FROM _old.distance_km
    AND _new.total            IS NOT DISTINCT FROM _old.total
    AND _new.payment_method    IS NOT DISTINCT FROM _old.payment_method
    AND _new.customer_name    IS NOT DISTINCT FROM _old.customer_name
    AND _new.customer_phone   IS NOT DISTINCT FROM _old.customer_phone
    AND _new.address          IS NOT DISTINCT FROM _old.address
    AND _new.landmark         IS NOT DISTINCT FROM _old.landmark
    AND _new.notes            IS NOT DISTINCT FROM _old.notes
    AND _new.latitude         IS NOT DISTINCT FROM _old.latitude
    AND _new.longitude        IS NOT DISTINCT FROM _old.longitude
    AND _new.created_at       IS NOT DISTINCT FROM _old.created_at
    AND _new.is_fake          IS NOT DISTINCT FROM _old.is_fake
    AND _new.flagged_by       IS NOT DISTINCT FROM _old.flagged_by
    AND (
      _new.status IS NOT DISTINCT FROM _old.status
      OR (_old.status = 'placed'     AND _new.status IN ('accepted','rejected'))
      OR (_old.status = 'accepted'   AND _new.status = 'preparing')
      OR (_old.status = 'preparing'  AND _new.status = 'out_for_delivery')
    )
    AND (
      _new.rejection_reason IS NOT DISTINCT FROM _old.rejection_reason
      OR _new.status = 'rejected'
    )
$function$;

CREATE OR REPLACE FUNCTION public.enforce_owner_order_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = NEW.restaurant_id AND r.owner_id = auth.uid()
  ) THEN
    IF NOT public.owner_order_update_safe(OLD, NEW) THEN
      RAISE EXCEPTION 'Restaurant owners can only advance order status through allowed transitions';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;