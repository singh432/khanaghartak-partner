# Map-Based Delivery Zones (replacing the 7 km restaurant radius)

## What you get

- **Zones**: Super Admin draws a delivery boundary on a map (polygon) and saves it as a Zone.
- **Assignments**: each Zone can have a Manager, Restaurants and Riders.
- **Eligibility**: an order is allowed only if the customer's pinned location falls inside an active Zone polygon. Distance from the restaurant is no longer used to allow/block an order (it is still used only to compute the delivery fee and to rank nearest riders).
- **Blocked message**: "Sorry, we don't deliver to this location yet."
- **Zone Manager panel**: sees only their own Zone's orders, restaurants, riders, customers and analytics, and can assign riders only inside their Zone. No access to other Zones or platform settings.
- **Super Admin**: unchanged owner-only access, full platform control, can see/manage every Zone's orders, assign any rider, and move any restaurant/rider/manager between Zones. New Zone-wise report: orders, revenue, cancellations, net profit.

## Database changes (one migration, nothing dropped)

- New table `delivery_zones`: name, city, polygon (list of lat/lng points), is_active, timestamps.
- New table `zone_managers`: zone_id + user_id (a manager can hold one or more zones).
- New role value `zone_manager` added to the existing role enum; managers are granted through `user_roles` by the Super Admin only.
- New nullable columns: `restaurants.zone_id`, `rider_profiles.zone_id`, `orders.zone_id`. Nullable keeps every existing row valid.
- New SQL helpers:
  - `point_in_zone(lat, lng)` – ray-casting point-in-polygon, no extensions needed; returns the matching active zone id.
  - `zone_for_user(uid)` / `is_zone_manager(uid, zone_id)` – security-definer role checks used by policies (same pattern as the existing `has_role`).
- `place_order` update: the 7 km radius check is replaced by a zone lookup on the customer's pinned lat/lng. No zone match → the "we don't deliver here yet" error. The resolved `zone_id` is stored on the order. Fee slabs, minimum order, closed-restaurant and fraud checks stay exactly as they are.
- Manager-scoped RPCs (security definer, mirroring the existing owner/super functions): list orders / restaurants / riders / customers for the caller's zone, and assign a rider within the zone.
- RLS + GRANTs for the new tables: zones readable by authenticated users (needed for the customer check), writable only by Super Admin; zone_managers readable by the manager and Super Admin, writable by Super Admin.

## App changes

- `src/routes/super.zones.tsx` (new): zone list + map editor. Click the map to drop boundary points, drag to adjust, close the polygon, save. Assign manager (by email), restaurants and riders to the zone.
- `src/routes/super.index.tsx`: new Zone-wise table — orders, revenue, cancellations, net profit — reusing the existing payout math and date filter.
- `src/routes/zone.tsx` + child routes (new): the Zone Manager panel (orders, restaurants, riders, customers, analytics), gated to `zone_manager` and scoped to the assigned zone.
- `src/routes/login.tsx` / `src/lib/active-role.ts`: add a `manager` entry point so a manager lands on `/zone`.
- Checkout: the "outside delivery area" message now comes from the zone check; the existing 7 km copy is removed.
- Map rendering uses Leaflet with OpenStreetMap tiles, loaded client-side only (no SSR import), consistent with the current no-API-key setup.

## Safety

- Every new column is nullable and every new table is additive — existing orders, restaurants, riders and policies keep working.
- Until a zone is drawn, ordering would block everywhere, so the migration seeds one active zone covering your current service area (Shankargarh/Prayagraj, ~10 km box) and back-fills existing restaurants into it. You can redraw it precisely from the new Zones screen.
