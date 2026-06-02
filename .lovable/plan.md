## Goal

Expand the current single-restaurant admin into a full multi-tenant platform with two distinct dashboards: **Restaurant Owner** (manages one restaurant) and **Super Admin** (manages the entire KhanaGharTak platform).

This is a large change. I'll build it in one go, but want your sign-off on the approach below before I touch the DB schema — because the schema needs to go from "1 restaurant" to "many restaurants".

---

## Database changes (biggest impact)

Today the schema assumes **one restaurant**. To support multi-tenant, I'll migrate to:

- **`restaurants`** (renamed from singular `restaurant`) — id, name, owner_id (FK auth.users), logo, address, phone, opening_time, closing_time, min_order_value, delivery_charges, status (`pending` | `active` | `inactive` | `rejected`), location, rating, is_open.
- **`menu_items`** — add `restaurant_id`, `offer_price`, `is_out_of_stock`.
- **`categories`** — add `restaurant_id` (categories become per-restaurant).
- **`orders`** — add `restaurant_id`. Extend status enum: `placed` → `accepted` → `preparing` → `ready_for_pickup` → `out_for_delivery` → `delivered` / `cancelled`.
- **`app_role` enum** — add `super_admin` (keep existing `customer`, `restaurant_admin`).
- **`platform_settings`** — singleton row: platform_fee, default_delivery_charges, support_phone, support_email, terms, privacy.
- **`customer_blocks`** — track blocked customers (super admin action).
- **RLS** rewritten so restaurant owners only see THEIR restaurant's data; super admin sees everything; customers unchanged.

Existing data (your current restaurant + menu) will be preserved and assigned to your owner account.

---

## Routes

**Restaurant Owner** (`/admin/*`) — refactor existing pages:
- `/admin` — dashboard with the new stat cards (today's orders, revenue, pending, preparing, delivered, out-of-stock count)
- `/admin/orders` — live orders with the expanded status workflow
- `/admin/menu` — add `offer_price` + `out_of_stock` toggle to existing CRUD
- `/admin/analytics` — daily/weekly/monthly revenue charts (recharts), top items
- `/admin/settings` — restaurant profile (logo, hours, min order, delivery charges)

**Super Admin** (new — `/super/*`):
- `/super` — platform-wide stat cards
- `/super/restaurants` — table with approve/reject/activate/deactivate/edit/delete
- `/super/orders` — all orders, filterable by date range / restaurant / status
- `/super/customers` — list, search, view order history, block
- `/super/analytics` — revenue charts, top restaurants, top foods
- `/super/settings` — platform fee, delivery charges, terms, privacy, support

Both share a sidebar layout (shadcn sidebar), mobile responsive, orange theme.

---

## Auth & access

- Login page already supports `?redirect=`. I'll add a "Super Admin" entry path too.
- Role check: `customer` → `/home`, `restaurant_admin` → `/admin`, `super_admin` → `/super`.
- You'll be granted `super_admin` role on your existing user so you can access `/super` immediately.

---

## What I will NOT do in this pass

- Onboarding/sign-up flow for new restaurant owners (super admin will add them manually for now — let me know if you want self-serve signup too).
- Push notifications (in-app real-time updates only, via the existing Supabase channel).
- Payment integration (cash-on-delivery only, as today).

---

## Stack notes

- Charts: `recharts` (already in shadcn ecosystem).
- All queries through existing `supabase` client + RLS — no new server functions needed.
- Real-time order updates via existing `supabase.channel` pattern.

---

## Confirm before I start

1. **OK to rename `restaurant` → `restaurants` and reassign your existing data?** (Required for multi-tenant.)
2. **Grant `super_admin` role to your current user** (`b6a0cdbb-1da8-463b-b7ee-c339c839cd41`)?
3. **Skip self-serve restaurant signup** for now (super admin adds restaurants manually)?

If yes to all three, I'll ship the whole thing in the next turn.