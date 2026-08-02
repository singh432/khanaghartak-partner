# WhatsApp Order Notifications (Twilio)

Send automatic WhatsApp messages at four moments in the order lifecycle.

## Who gets notified, and when

| Moment | Trigger | Recipient |
|---|---|---|
| Order placed | `place_order` creates order (status `placed`) | Restaurant kitchen phone |
| Restaurant accepts / marks ready | status becomes `out_for_delivery` (order open for pickup) | All approved riders (broadcast) |
| Rider picks up order | rider accepts the order (`rider_accept_order`) | Customer phone from checkout |
| Delivered | `rider_mark_delivered` | Customer phone from checkout |

Rider broadcast goes to every rider whose profile status is `approved` and who has a phone saved. First rider to accept in the app takes the order; a short "already assigned" note is not sent to the others (kept simple for phase 1).

Note on the accept step: today the restaurant flow is placed → accepted → preparing → out_for_delivery, and riders only see orders once they are `out_for_delivery`. So the rider alert fires at "Ready for Delivery", which is the first point a rider can actually accept. The customer also gets a short "Restaurant accepted your order" message at the `accepted` step.

## How it works

1. **Twilio connection** — connect the Twilio connector so messages are sent through the secure gateway (no keys in app code). You will need a Twilio account with an approved WhatsApp sender (sandbox works for testing). I will also add a setting for the sender number.
2. **Notification endpoint** — a server route `POST /api/public/notify/whatsapp` that builds the message text, resolves recipient phone numbers, and calls Twilio. It is protected by a shared secret header so only the database can call it.
3. **Database hooks** — a trigger on `orders` (insert + status change) and additions inside `rider_accept_order` that call the endpoint asynchronously via `pg_net`. Order flow never blocks or fails if WhatsApp is down.
4. **Delivery log** — a `notification_log` table records each send (order, recipient type, phone, status, provider id, error). Visible in the Super Admin panel so you can see what went out and what failed.
5. **Phone normalisation** — Indian numbers stored as 10 digits are converted to `+91XXXXXXXXXX` E.164 before sending. Missing or invalid numbers are logged as skipped, not errors.

## Message content (plain text, phase 1)

- Restaurant: order id, items with quantity, total, customer area/landmark, "Open the KhanaGharTak restaurant panel to accept".
- Riders: order id, restaurant name and address, drop area, payout-relevant total, link to `/rider`. No customer name/phone/full address until accepted (keeps the existing privacy rule).
- Customer accepted: "Your order is confirmed by <restaurant>, preparing now."
- Customer picked up: "<rider name> has picked up your order and is on the way."
- Customer delivered: "Order delivered. Thanks for ordering with KhanaGharTak!"

## Technical details

- New table `public.notification_log` with GRANTs, RLS (super admin read; service role full), no client writes.
- New setting columns on `platform_settings`: `whatsapp_from` (Twilio WhatsApp sender, e.g. `whatsapp:+14155238886`) and `whatsapp_enabled` toggle, editable in `/super` settings.
- Server route under `src/routes/api/public/notify/whatsapp.ts`; verifies `x-notify-secret` against a generated secret, validates payload with Zod, loads `supabaseAdmin` inside the handler, and posts form-encoded to `https://connector-gateway.lovable.dev/twilio/Messages.json` with `Authorization: Bearer LOVABLE_API_KEY` and `X-Connection-Api-Key: TWILIO_API_KEY`.
- Migration: enable `pg_net`, add trigger function `notify_order_event()` on `orders` (AFTER INSERT, AFTER UPDATE OF status) plus a call inside `rider_accept_order`, each doing a fire-and-forget `net.http_post` with the order id and event name.
- Endpoint returns 200 with a per-recipient result array; failures are logged, never retried in phase 1.

## What I need from you

- Approve connecting Twilio (I will open the connect card).
- Your Twilio WhatsApp sender number (sandbox number is fine to start).
- Restaurant and rider phone numbers must be filled in their profiles, otherwise those alerts are skipped.
