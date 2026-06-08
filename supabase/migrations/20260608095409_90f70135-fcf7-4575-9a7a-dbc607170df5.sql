
-- 1) Enforce: only singhsuryapratap432@gmail.com can hold the super_admin role.
CREATE OR REPLACE FUNCTION public.enforce_super_admin_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _email text;
BEGIN
  IF NEW.role = 'super_admin'::app_role THEN
    SELECT email INTO _email FROM auth.users WHERE id = NEW.user_id;
    IF _email IS DISTINCT FROM 'singhsuryapratap432@gmail.com' THEN
      RAISE EXCEPTION 'super_admin role is reserved for the platform owner';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_super_admin_email_ins ON public.user_roles;
CREATE TRIGGER enforce_super_admin_email_ins
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_super_admin_email();

-- Strip any stale super_admin assignments that aren't the owner email.
DELETE FROM public.user_roles ur
WHERE ur.role = 'super_admin'::app_role
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = ur.user_id AND u.email = 'singhsuryapratap432@gmail.com'
  );

-- Ensure the owner account does have it (idempotent).
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
WHERE u.email = 'singhsuryapratap432@gmail.com'
ON CONFLICT DO NOTHING;

-- 2) Finding: restaurants.owner_id publicly readable.
-- Revoke column-level SELECT for anon so the public read policy can't return owner UUIDs.
REVOKE SELECT (owner_id) ON public.restaurants FROM anon;
-- Authenticated keeps full select (RLS still applies for writes).

-- 3) Finding: orders UPDATE policy too permissive for restaurant owners.
-- Replace blanket owner-update policy with a narrow one that only allows
-- safe status/rejection-reason transitions; everything else goes through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "Owner updates own restaurant orders" ON public.orders;

CREATE OR REPLACE FUNCTION public.owner_order_update_safe(_old public.orders, _new public.orders)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    _new.id              IS NOT DISTINCT FROM _old.id
    AND _new.user_id          IS NOT DISTINCT FROM _old.user_id
    AND _new.restaurant_id    IS NOT DISTINCT FROM _old.restaurant_id
    AND _new.rider_id         IS NOT DISTINCT FROM _old.rider_id
    AND _new.items            IS NOT DISTINCT FROM _old.items
    AND _new.subtotal         IS NOT DISTINCT FROM _old.subtotal
    AND _new.delivery_fee     IS NOT DISTINCT FROM _old.delivery_fee
    AND _new.total            IS NOT DISTINCT FROM _old.total
    AND _new.payment_method   IS NOT DISTINCT FROM _old.payment_method
    AND _new.customer_name    IS NOT DISTINCT FROM _old.customer_name
    AND _new.customer_phone   IS NOT DISTINCT FROM _old.customer_phone
    AND _new.address          IS NOT DISTINCT FROM _old.address
    AND _new.landmark         IS NOT DISTINCT FROM _old.landmark
    AND _new.notes            IS NOT DISTINCT FROM _old.notes
    AND _new.latitude         IS NOT DISTINCT FROM _old.latitude
    AND _new.longitude        IS NOT DISTINCT FROM _old.longitude
    AND _new.created_at       IS NOT DISTINCT FROM _old.created_at
$$;

CREATE POLICY "Owner updates only status fields"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id AND r.owner_id = auth.uid()
  )
  AND public.owner_order_update_safe(orders, orders)
);

-- Note: Postgres RLS WITH CHECK only sees the NEW row, not OLD. To compare
-- OLD vs NEW we use a row-level BEFORE UPDATE trigger that enforces the same
-- invariant for restaurant owners (super_admin bypasses).
CREATE OR REPLACE FUNCTION public.enforce_owner_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow super admin to do anything.
  IF app_private.has_role(auth.uid(), 'super_admin'::app_role) THEN
    RETURN NEW;
  END IF;
  -- For restaurant owners: only status & rejection_reason & updated_at may change.
  IF EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = NEW.restaurant_id AND r.owner_id = auth.uid()
  ) THEN
    IF NEW.id              IS DISTINCT FROM OLD.id
    OR NEW.user_id         IS DISTINCT FROM OLD.user_id
    OR NEW.restaurant_id   IS DISTINCT FROM OLD.restaurant_id
    OR NEW.rider_id        IS DISTINCT FROM OLD.rider_id
    OR NEW.items           IS DISTINCT FROM OLD.items
    OR NEW.subtotal        IS DISTINCT FROM OLD.subtotal
    OR NEW.delivery_fee    IS DISTINCT FROM OLD.delivery_fee
    OR NEW.total           IS DISTINCT FROM OLD.total
    OR NEW.payment_method  IS DISTINCT FROM OLD.payment_method
    OR NEW.customer_name   IS DISTINCT FROM OLD.customer_name
    OR NEW.customer_phone  IS DISTINCT FROM OLD.customer_phone
    OR NEW.address         IS DISTINCT FROM OLD.address
    OR NEW.landmark        IS DISTINCT FROM OLD.landmark
    OR NEW.notes           IS DISTINCT FROM OLD.notes
    OR NEW.latitude        IS DISTINCT FROM OLD.latitude
    OR NEW.longitude       IS DISTINCT FROM OLD.longitude
    OR NEW.created_at      IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Restaurant owners can only change order status fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_owner_order_update_trg ON public.orders;
CREATE TRIGGER enforce_owner_order_update_trg
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_order_update();

-- 4) Finding: menu_items realtime broadcasts unavailable items to all subscribers.
-- Tighten the public SELECT policy so unavailable / out-of-stock items aren't
-- streamed (or returned) to non-owners. Owners still see everything via their own ALL policy.
DROP POLICY IF EXISTS "Public read menu" ON public.menu_items;
CREATE POLICY "Public read available menu"
ON public.menu_items
FOR SELECT
TO anon, authenticated
USING (
  COALESCE(is_available, true) = true
  AND COALESCE(is_out_of_stock, false) = false
);
