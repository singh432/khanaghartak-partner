# WhatsApp Order Flow with Nearest-Rider Offers

Full message chain, plus a one-by-one rider offer system with a 2-minute timer.

## The flow

```text
Customer places order
  -> Restaurant gets WhatsApp: new order
Restaurant taps Accept
  -> Customer gets WhatsApp: order accepted
Restaurant taps Preparing
  -> Nearest rider gets WhatsApp offer      (2 min to accept)
  -> no accept -> 2nd nearest rider          (2 min)
  -> no accept -> 3rd nearest rider          (2 min)
  -> still nobody -> you get a WhatsApp alert to assign manually
Rider accepts -> order is assigned to that rider
Restaurant hands food over (Ready for Delivery / rider picks up)
  -> Customer gets WhatsApp: rider has picked up your order
Rider marks Delivered
  -> Customer gets WhatsApp: order delivered
```

## Decisions locked in

- Nearest is measured from each rider's saved base area pin to the restaurant.
- The 2-minute timer runs on a database scheduler, so it works even when nobody has the app open.
- Chain length: 3 nearest approved riders, then a WhatsApp alert to you (super admin).
- Rider offers start when the restaurant marks the order Preparing.

## What gets built

**Rider base location.** Rider signup and the rider dashboard gain a "Set my base area" step that saves a map pin. Riders without a pin are skipped in the ranking and only reached in the final fallback.

**Offer queue.** Each order gets an ordered list of up to 3 candidate riders. Only the current rider in the queue can accept; the offer expires after 2 minutes and passes to the next rider automatically. Accepting an already-expired or taken offer shows "This delivery has already been taken".

**Rider dashboard.** Available Orders becomes "Offered to you" and shows a live countdown on the active offer. Riders no longer see a free-for-all list of every order.

**Super admin.** A new Deliveries view shows each order's offer chain, who was messaged when, who accepted or timed out, plus a manual "Assign this rider" action for the fallback case. The existing WhatsApp delivery log stays.

## WhatsApp templates to approve in Meta

| Template | Sent to | Content |
|---|---|---|
| `kgt_new_order` | Restaurant | new order, items, total, drop area |
| `kgt_order_accepted` | Customer | order confirmed by kitchen |
| `kgt_delivery_offer` | Rider | pickup, drop area, payout, 2-minute window |
| `kgt_order_picked_up` | Customer | rider name, on the way |
| `kgt_order_delivered` | Customer | delivered, thank you |
| `kgt_no_rider_alert` | Super admin | nobody accepted, assign manually |

Sending stays on the Meta Cloud API integration already wired up; it needs your WhatsApp phone number ID and access token, which I will request once these templates are decided.

## Technical details

- Migration 1: add `base_latitude` / `base_longitude` to `rider_profiles`; create `delivery_offers` (order_id, rider_id, rank, status, offered_at, expires_at, responded_at) with GRANTs, RLS (rider reads own offers, super admin reads all, no direct client writes) and an index on `(status, expires_at)`.
- Migration 2: `app_private.dispatch_rider_offers(order_id)` picks the 3 nearest approved riders by Haversine from the restaurant pin, inserts offer rows, activates rank 1 and calls `dispatch_order_notification(order_id, 'rider_offer')`. `expire_rider_offers()` closes offers past `expires_at`, promotes the next rank, and fires `no_rider` when the chain is exhausted.
- Migration 3: rewrite `notify_order_event()` so `status = 'preparing'` calls `dispatch_rider_offers`, and `out_for_delivery` (or rider assignment) sends `rider_picked_up` to the customer instead of broadcasting to riders.
- Migration 4: `rider_accept_order` is rewritten to require an `active` offer for the calling rider that has not expired; it marks the offer accepted, cancels siblings, and sets `orders.rider_id`. Restaurant-owner order UPDATE immutability rules stay as-is.
- Scheduler: enable `pg_cron`; a job every 30 seconds runs `expire_rider_offers()`. `pg_net` already dispatches notifications to `/api/public/notify/whatsapp`, which stays shared-secret protected.
- Endpoint: `src/routes/api/public/notify/whatsapp.ts` gains the `rider_offer` and `no_rider` events (single targeted rider / super admin phone from `platform_settings.support_phone`) and drops the approved-rider broadcast branch.
- Frontend: rider base-pin picker reusing `src/lib/geo.ts` and the existing location picker; `src/routes/rider.tsx` switched from `rider_list_available_orders` to an offers query with countdown; new `src/routes/super.deliveries.tsx` with a manual assign RPC guarded by `has_role(super_admin)`.
