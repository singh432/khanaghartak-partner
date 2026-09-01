CREATE OR REPLACE FUNCTION public.order_restaurant_contact(_order_id uuid)
 RETURNS TABLE(restaurant_name text, phone text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'app_private'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.name, r.phone
    FROM public.orders o
    JOIN public.restaurants r ON r.id = o.restaurant_id
   WHERE o.id = _order_id
     AND (
       (o.user_id = auth.uid() AND o.status = 'delivered')
       OR o.rider_id = auth.uid()
       OR r.owner_id = auth.uid()
       OR app_private.has_role(auth.uid(), 'super_admin'::app_role)
     );
END;
$function$;