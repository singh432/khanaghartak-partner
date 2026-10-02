import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  order_id: z.string().uuid(),
  event: z.enum([
    "order_placed",
    "restaurant_accepted",
    "rider_offer",
    "no_rider",
    "ready_for_pickup",
    "rider_picked_up",
    "delivered",
  ]),
});

type Recipient = { type: string; phone: string; template: string; params: string[] };

/**
 * Variable count of each APPROVED template in the WABA.
 * Keep in sync with Meta — a mismatch is a hard send failure (error 132000),
 * so we fail loudly here instead of guessing at request time.
 */
const TEMPLATE_VARS: Record<string, number> = {
  kgt_new_order: 3,
  kgt_order_accepted: 2,
  kgt_delivery_available: 3,
  kgt_order_picked_up: 2,
  kgt_order_delivered: 1,
  kgt_no_rider: 3,
};

const TEMPLATE_LANG = "en";

function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return null;
}

/** 91XXXXXXXXXX — the wire format Meta expects (no plus). */
function toWireNumber(e164: string) {
  return e164.replace(/^\+/, "");
}

function maskPhone(p: string) {
  return p.length > 4 ? `${"*".repeat(p.length - 4)}${p.slice(-4)}` : "****";
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function itemLines(items: unknown): string {
  if (!Array.isArray(items)) return "";
  const parts = items.map((i) => {
    const it = i as { name?: string; qty?: number };
    return `${it.name ?? "Item"} x${it.qty ?? 1}`;
  });
  // WhatsApp template params cannot contain newlines or tabs.
  return parts.join(", ").slice(0, 900) || "items";
}

function clean(v: string | null | undefined, fallback = "-") {
  const s = (v ?? "").replace(/[\n\r\t]+/g, " ").replace(/\s{2,}/g, " ").trim();
  return s.length ? s.slice(0, 900) : fallback;
}

type SendResult = {
  ok: boolean;
  wamid: string | null;
  error: string | null;
  errorCode: number | null;
  errorTitle: string | null;
  accepted: boolean;
};

async function sendWhatsApp(
  orderId: string,
  to: string,
  template: string,
  params: string[],
): Promise<SendResult> {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const base = { ok: false, wamid: null, accepted: false } as const;

  if (!token || !phoneNumberId) {
    return {
      ...base,
      error: "WhatsApp Cloud API is not configured",
      errorCode: null,
      errorTitle: "not_configured",
    };
  }

  const expected = TEMPLATE_VARS[template];
  if (expected !== undefined && expected !== params.length) {
    const msg = `Template "${template}" expects ${expected} variables but ${params.length} were built`;
    console.error(`[whatsapp] order=${orderId} template=${template} config_error="${msg}"`);
    return { ...base, error: msg, errorCode: null, errorTitle: "param_count_mismatch" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toWireNumber(to),
        type: "template",
        template: {
          name: template,
          language: { code: TEMPLATE_LANG },
          components: params.length
            ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }]
            : [],
        },
      }),
    });

    const text = await res.text();

    if (res.ok) {
      let wamid: string | null = null;
      try {
        wamid = (JSON.parse(text) as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null;
      } catch {
        /* ignore */
      }
      // ACCEPTED by Meta — NOT proof of delivery. The status webhook confirms that.
      console.log(
        `[whatsapp] order=${orderId} template=${template} to=${maskPhone(to)} status=accepted wamid=${wamid ?? "none"}`,
      );
      return { ok: true, accepted: true, wamid, error: null, errorCode: null, errorTitle: null };
    }

    let msg = text.slice(0, 500);
    let code: number | null = null;
    let title: string | null = null;
    try {
      const e = (
        JSON.parse(text) as {
          error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
        }
      ).error;
      if (e) {
        code = e.code ?? null;
        title = e.message ?? null;
        msg = `[${e.code ?? res.status}] ${e.message ?? ""}${
          e.error_data?.details ? ` · ${e.error_data.details}` : ""
        }`;
      }
    } catch {
      /* ignore */
    }
    console.error(
      `[whatsapp] order=${orderId} template=${template} to=${maskPhone(to)} status=rejected code=${code ?? "?"} title="${title ?? msg}"`,
    );
    return { ...base, error: msg, errorCode: code, errorTitle: title };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const msg = aborted ? "Meta request timed out after 15s" : err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp] order=${orderId} template=${template} to=${maskPhone(to)} status=error msg="${msg}"`);
    return { ...base, error: msg.slice(0, 500), errorCode: null, errorTitle: aborted ? "timeout" : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

async function sendFcmPush(
  token: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const fcmServerKey = process.env["FCM_SERVER_KEY"];
  if (!fcmServerKey) return;
  try {
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${fcmServerKey}`,
      },
      body: JSON.stringify({
        to: token,
        priority: "high",
        notification: {
          title,
          body,
          android_channel_id: "orders_channel",
          sound: "order_siren",
        },
        data: {
          ...data,
          title,
          body,
          notification_type: data.notification_type || "NEW_ORDER",
        },
      }),
    });
  } catch (err) {
    console.error("[fcm] Failed to send push notification:", err);
  }
}

export const Route = createFileRoute("/api/public/notify/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["NOTIFY_SHARED_SECRET"];
        const provided = request.headers.get("x-notify-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid payload", { status: 400 });
        const { order_id, event } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [{ data: settings }, { data: order }] = await Promise.all([
          supabaseAdmin
            .from("platform_settings")
            .select("whatsapp_from, whatsapp_enabled, support_phone")
            .limit(1)
            .maybeSingle(),
          supabaseAdmin
            .from("orders")
            .select(
              "id, status, total, items, customer_name, customer_phone, address, landmark, restaurant_id, rider_id, distance_km",
            )
            .eq("id", order_id)
            .maybeSingle(),
        ]);

        if (!order) return Response.json({ skipped: "order_not_found" });
        const cfg = settings as {
          whatsapp_from: string | null;
          whatsapp_enabled: boolean;
          support_phone: string | null;
        } | null;

        // Duplicate guard: the same event for the same order is only sent once
        // per 60s, so retries / concurrent triggers cannot double-message people.
        const { data: recent } = await supabaseAdmin
          .from("notification_log")
          .select("id")
          .eq("order_id", order_id)
          .eq("event", event)
          .in("status", ["sent", "accepted"])
          .gte("created_at", new Date(Date.now() - 60_000).toISOString())
          .limit(1);
        if ((recent ?? []).length) {
          console.log(`[whatsapp] order=${order_id} event=${event} skipped=duplicate_within_60s`);
          return Response.json({ event, skipped: "duplicate" });
        }

        const { data: restaurant } = await supabaseAdmin
          .from("restaurants")
          .select("name, phone, address")
          .eq("id", order.restaurant_id as string)
          .maybeSingle();

        const BRAND = "KhanaGharTak.in";
        const orderRef = `${BRAND} · #${shortId(order.id as string)}`;
        const total = `₹${Number(order.total ?? 0).toFixed(0)}`;
        const dropArea = clean((order.landmark as string | null) || (order.address as string));
        const restaurantName = clean(restaurant?.name as string | null, "Restaurant");
        const recipients: Recipient[] = [];

        if (event === "order_placed") {
          const phone = toE164(restaurant?.phone as string | null);
          if (phone) {
            // kgt_new_order: "Hi {{1}}, Your order {{2}} has been placed successfully. Restaurant: {{3}}"
            recipients.push({
              type: "restaurant",
              phone,
              template: "kgt_new_order",
              params: [restaurantName, `${orderRef} (${itemLines(order.items)} · ${total})`, restaurantName],
            });
          }

          // Asynchronously dispatch high-priority FCM push to restaurant owner's Android app
          try {
            const { data: restWithOwner } = await supabaseAdmin
              .from("restaurants")
              .select("owner_id")
              .eq("id", order.restaurant_id as string)
              .maybeSingle();

            if (restWithOwner?.owner_id) {
              const { data: tokens } = await (supabaseAdmin
                .from("user_fcm_tokens" as any) as any)
                .select("token")
                .eq("user_id", restWithOwner.owner_id)
                .eq("is_active", true);

              if (tokens && tokens.length > 0) {
                const sId = shortId(order.id as string);
                for (const t of (tokens as { token: string }[])) {
                  void sendFcmPush(
                    t.token,
                    "🚨 NEW ORDER RECEIVED!",
                    `Order #${sId} · ${total} · Tap to accept immediately!`,
                    { order_id: order.id as string, role: "restaurant", notification_type: "NEW_ORDER" }
                  );
                }
              }
            }

            // Also notify Zone Managers
            const { data: zmTokens } = await (supabaseAdmin
              .from("user_fcm_tokens" as any) as any)
              .select("token")
              .eq("role", "zone_manager")
              .eq("is_active", true);

            if (zmTokens && zmTokens.length > 0) {
              const sId = shortId(order.id as string);
              for (const t of (zmTokens as { token: string }[])) {
                void sendFcmPush(
                  t.token,
                  "📋 NEW ORDER PLACED",
                  `Order #${sId} at ${restaurantName} · ${total}`,
                  { order_id: order.id as string, role: "zone_manager", notification_type: "NEW_ORDER" }
                );
              }
            }
          } catch (e) {
            console.error("[fcm] Error querying FCM tokens on order_placed:", e);
          }
        } else if (event === "restaurant_accepted") {
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            // kgt_order_accepted: "Your order {{1}} from {{2}} has been accepted."
            recipients.push({
              type: "customer",
              phone,
              template: "kgt_order_accepted",
              params: [orderRef, restaurantName],
            });
          }
        } else if (event === "rider_offer" || event === "ready_for_pickup") {
          const pickup = clean(
            `${restaurantName}, ${(restaurant?.address as string | null) ?? ""}`,
            "Restaurant",
          );
          const { data: offers } = await supabaseAdmin
            .from("delivery_offers")
            .select("rider_id, distance_km, expires_at")
            .eq("order_id", order_id)
            .eq("status", "active")
            .limit(1);
          const offer = (offers ?? [])[0] as { rider_id: string } | undefined;
          if (offer) {
            const { data: rp } = await supabaseAdmin
              .from("rider_profiles")
              .select("phone")
              .eq("user_id", offer.rider_id)
              .maybeSingle();
            const phone = toE164(rp?.phone as string | null);
            if (phone) {
              // kgt_delivery_available: "Order: {{1}} Restaurant: {{2}} Drop Location: {{3}}"
              recipients.push({
                type: "rider",
                phone,
                template: "kgt_delivery_available",
                params: [`${orderRef} · ${total}`, pickup, dropArea],
              });
            }

            // Dispatch high-priority FCM push to rider's device
            try {
              const { data: tokens } = await (supabaseAdmin
                .from("user_fcm_tokens" as any) as any)
                .select("token")
                .eq("user_id", offer.rider_id)
                .eq("is_active", true);

              if (tokens && tokens.length > 0) {
                const sId = shortId(order.id as string);
                for (const t of (tokens as { token: string }[])) {
                  void sendFcmPush(
                    t.token,
                    "🛵 NEW DELIVERY OFFER!",
                    `Drop: ${dropArea} · ${total} · Tap to view and accept!`,
                    { order_id: order.id as string, role: "rider", notification_type: "DELIVERY_AVAILABLE" }
                  );
                }
              }
            } catch (e) {
              console.error("[fcm] Error querying rider FCM tokens:", e);
            }
          }
        } else if (event === "no_rider") {
          // Notify Zone Managers via FCM
          try {
            const { data: zmTokens } = await (supabaseAdmin
              .from("user_fcm_tokens" as any) as any)
              .select("token")
              .eq("role", "zone_manager")
              .eq("is_active", true);

            if (zmTokens && zmTokens.length > 0) {
              const sId = shortId(order.id as string);
              for (const t of (zmTokens as { token: string }[])) {
                void sendFcmPush(
                  t.token,
                  "⚠️ NO RIDER FOUND",
                  `No delivery partner accepted Order #${sId} from ${restaurantName}.`,
                  { order_id: order.id as string, role: "zone_manager", notification_type: "NO_RIDER" }
                );
              }
            }
          } catch (e) {
            console.error("[fcm] Error notifying zone managers of no_rider:", e);
          }

          const phone = toE164(cfg?.support_phone ?? null);
          if (phone) {
            // kgt_no_rider: "No delivery partner accepted Order {{1}} from {{2}}. Delivery Area: {{3}}"
            recipients.push({
              type: "admin",
              phone,
              template: "kgt_no_rider",
              params: [orderRef, restaurantName, dropArea],
            });
          }
        } else if (event === "rider_picked_up") {
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            // kgt_order_picked_up: "Your order {{1}} has been picked up from {{2}}."
            recipients.push({
              type: "customer",
              phone,
              template: "kgt_order_picked_up",
              params: [orderRef, restaurantName],
            });
          }
        } else if (event === "delivered") {
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            recipients.push({
              type: "customer",
              phone,
              template: "kgt_order_delivered",
              params: [orderRef],
            });
          }
        }

        // Check if WhatsApp is disabled after FCM has already fired
        if (cfg && cfg.whatsapp_enabled === false) {
          return Response.json({ event, fcm_dispatched: true, whatsapp: "disabled" });
        }

        const results: {
          type: string;
          accepted: boolean;
          wamid: string | null;
          error: string | null;
          errorCode: number | null;
        }[] = [];
        const logRows: Record<string, unknown>[] = [];

        // WhatsApp forbids messaging your own business number — Meta answers (#100).
        const ownNumber = toE164(cfg?.whatsapp_from ?? null);

        for (const r of recipients) {
          if (ownNumber && toWireNumber(r.phone) === toWireNumber(ownNumber)) {
            console.warn(`[whatsapp] order=${order_id} event=${event} skipped=self_send`);
            logRows.push({
              order_id,
              event,
              recipient_type: r.type,
              phone: r.phone,
              template: r.template,
              status: "skipped",
              error: "Cannot send to the business's own WhatsApp number",
              error_title: "self_send",
            });
            results.push({
              type: r.type,
              accepted: false,
              wamid: null,
              error: "self_send",
              errorCode: null,
            });
            continue;
          }

          const sent = await sendWhatsApp(order_id, r.phone, r.template, r.params);

          logRows.push({
            order_id,
            event,
            recipient_type: r.type,
            phone: r.phone,
            template: r.template,
            // "accepted" = Meta queued it. Real delivery arrives via the status webhook.
            status: sent.accepted ? "accepted" : "failed",
            provider_sid: sent.wamid,
            error: sent.error,
            error_code: sent.errorCode,
            error_title: sent.errorTitle,
          });
          results.push({
            type: r.type,
            accepted: sent.accepted,
            wamid: sent.wamid,
            error: sent.error,
            errorCode: sent.errorCode,
          });
        }

        if (recipients.length === 0) {
          console.warn(`[whatsapp] order=${order_id} event=${event} skipped=no_recipient_phone`);
          logRows.push({
            order_id,
            event,
            recipient_type: "none",
            status: "skipped",
            error: "No valid phone numbers for this event",
            error_title: "no_recipient",
          });
        }

        if (logRows.length) {
          const { error: logError } = await supabaseAdmin
            .from("notification_log")
            .insert(logRows as never);
          if (logError) console.error(`[whatsapp] notification_log insert failed: ${logError.message}`);
        }

        // Always 200: notification problems must not roll back or block the order.
        return Response.json({ event, accepted: results });
      },
    },
  },
});
