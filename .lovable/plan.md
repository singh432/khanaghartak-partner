# Switch WhatsApp Notifications to Meta Cloud API

Keep the notification flow already built (triggers, recipients, message text, delivery log) and replace the Twilio sending layer with Meta's WhatsApp Cloud API.

## What changes

- Messages are sent directly from your own WhatsApp Business number via Meta's Cloud API — no Twilio account, no per-message reseller fee.
- Settings in the Super Admin panel change from "Twilio sender number" to your WhatsApp Business phone number ID, plus the same on/off toggle and the delivery log.
- Everything else stays as planned: kitchen alert on a new order, rider broadcast when an order is ready for pickup, customer updates on accept, pickup, and delivery.

## Important: Meta requires approved templates

Meta only allows free-form text to someone who messaged you in the last 24 hours. Since we message people first, each notification must be a pre-approved **message template** created in Meta Business Manager. Five templates are needed:

| Template name | Sent to | Variables |
|---|---|---|
| `kgt_new_order` | Restaurant | order id, items summary, total, drop area |
| `kgt_order_accepted` | Customer | order id, restaurant name |
| `kgt_delivery_available` | Riders | order id, pickup name, drop area, total |
| `kgt_order_picked_up` | Customer | order id, rider name, total |
| `kgt_order_delivered` | Customer | order id |

I will give you the exact template body text to paste into Meta for approval. Until they are approved, the app logs each send as "skipped — template not approved" instead of failing.

## What I need from you

- A Meta app with WhatsApp product added, a verified WhatsApp Business number, its **Phone Number ID**, and a **permanent access token** (System User token). I will request these securely once you approve the plan.
- Template approval in Meta Business Manager (usually minutes to a few hours).

## Technical details

- Rewrite the sender inside `src/routes/api/public/notify/whatsapp.ts`: replace the Twilio REST/gateway call with `POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`, `Authorization: Bearer WHATSAPP_ACCESS_TOKEN`, JSON body of type `template` with `language: { code: "en" }` and positional body parameters.
- Message text moves from inline strings to a template map (template name + ordered parameter array per event), keeping the existing recipient resolution, E.164 normalisation, and `notification_log` writes unchanged.
- Log the Meta message id (`messages[0].id`) into `provider_sid`; on non-2xx, log Meta's `error.message` and `error.code` verbatim.
- Secrets: `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` (requested via the secure form). Remove the Twilio branch and drop the Twilio secret request.
- `platform_settings.whatsapp_from` is repurposed as an optional display-only sender label; sending uses the phone number ID from secrets. Super Admin settings UI updated accordingly.
- Database triggers, `notification_log`, and the shared-secret protection on the endpoint stay exactly as they are — no migration needed beyond what is already applied.

## Optional follow-up (not in this change)

A Meta status webhook at `/api/public/notify/whatsapp-status` can mark each log row delivered/read. Say the word and I will add it after the first messages go out.
