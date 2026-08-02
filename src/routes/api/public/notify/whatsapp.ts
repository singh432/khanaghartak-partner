import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  order_id: z.string().uuid(),
  event: z.enum([
    "order_placed",
    "restaurant_accepted",
    "ready_for_pickup",
    "rider_picked_up",
    "delivered",
  ]),
});

type Recipient = { type: string; phone: string; body: string };

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

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function itemLines(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return items
    .map((i) => {
      const it = i as { name?: string; qty?: number };
      return `• ${it.name ?? "Item"} × ${it.qty ?? 1}`;
    })
    .join("\n");
}

async function sendWhatsApp(to: string, from: string, body: string) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioConnKey = process.env["TWILIO_API_KEY"];
  const accountSid = process.env["TWILIO_ACCOUNT_SID"];
  const authToken = process.env["TWILIO_AUTH_TOKEN"];

  const form = new URLSearchParams({
    To: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    Body: body,
  });

  let res: Response;
  if (lovableKey && twilioConnKey) {
    res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioConnKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
  } else if (accountSid && authToken) {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
  } else {
    return { ok: false, sid: null, error: "Twilio is not configured" };
  }

  const text = await res.text();
  if (!res.ok) {
    console.error(`Twilio send failed [${res.status}]: ${text}`);
    return { ok: false, sid: null, error: `[${res.status}] ${text.slice(0, 500)}` };
  }
  let sid: string | null = null;
  try {
    sid = (JSON.parse(text) as { sid?: string }).sid ?? null;
  } catch {
    /* ignore */
  }
  return { ok: true, sid, error: null };
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
            .select("whatsapp_from, whatsapp_enabled")
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
        const cfg = settings as { whatsapp_from: string | null; whatsapp_enabled: boolean } | null;
        if (cfg && cfg.whatsapp_enabled === false) return Response.json({ skipped: "disabled" });
        const from = cfg?.whatsapp_from ?? null;

        const { data: restaurant } = await supabaseAdmin
          .from("restaurants")
          .select("name, phone, address")
          .eq("id", order.restaurant_id as string)
          .maybeSingle();

        const orderRef = shortId(order.id as string);
        const total = `₹${Number(order.total ?? 0).toFixed(0)}`;
        const dropArea = (order.landmark as string | null) || (order.address as string);
        const recipients: Recipient[] = [];

        if (event === "order_placed") {
          const phone = toE164(restaurant?.phone as string | null);
          if (phone) {
            recipients.push({
              type: "restaurant",
              phone,
              body:
                `🍽️ *New order #${orderRef}* on KhanaGharTak\n\n` +
                `${itemLines(order.items)}\n\n` +
                `Total (COD): ${total}\n` +
                `Drop area: ${dropArea}\n\n` +
                `Open your restaurant panel to accept: https://khanaghartak.in/admin/orders`,
            });
          }
        } else if (event === "restaurant_accepted") {
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            recipients.push({
              type: "customer",
              phone,
              body:
                `✅ Order #${orderRef} confirmed by ${restaurant?.name ?? "the kitchen"}.\n` +
                `Your food is being prepared. We'll update you when a rider picks it up.`,
            });
          }
        } else if (event === "ready_for_pickup") {
          const { data: riders } = await supabaseAdmin
            .from("rider_profiles")
            .select("phone, full_name")
            .eq("status", "approved");
          for (const r of riders ?? []) {
            const phone = toE164(r.phone as string | null);
            if (!phone) continue;
            recipients.push({
              type: "rider",
              phone,
              body:
                `🛵 *Delivery available — #${orderRef}*\n\n` +
                `Pickup: ${restaurant?.name ?? "Restaurant"}, ${restaurant?.address ?? ""}\n` +
                `Drop area: ${dropArea}\n` +
                `Order value: ${total}` +
                (order.distance_km != null ? `\nDistance: ~${Number(order.distance_km).toFixed(1)} km` : "") +
                `\n\nFirst to accept gets it: https://khanaghartak.in/rider`,
            });
          }
        } else if (event === "rider_picked_up") {
          let riderName = "Your rider";
          if (order.rider_id) {
            const { data: rp } = await supabaseAdmin
              .from("rider_profiles")
              .select("full_name, phone")
              .eq("user_id", order.rider_id as string)
              .maybeSingle();
            if (rp?.full_name) riderName = rp.full_name as string;
          }
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            recipients.push({
              type: "customer",
              phone,
              body: `🛵 ${riderName} has picked up your order #${orderRef} and is on the way. Keep ${total} ready for cash on delivery.`,
            });
          }
        } else if (event === "delivered") {
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            recipients.push({
              type: "customer",
              phone,
              body: `📦 Order #${orderRef} delivered. Thanks for ordering with KhanaGharTak — Jo Dil Chahe, Wahi Order Karo!`,
            });
          }
        }

        const results: { type: string; ok: boolean; error: string | null }[] = [];
        const logRows: Record<string, unknown>[] = [];

        for (const r of recipients) {
          if (!from) {
            logRows.push({
              order_id,
              event,
              recipient_type: r.type,
              phone: r.phone,
              status: "skipped",
              error: "WhatsApp sender number not configured",
            });
            results.push({ type: r.type, ok: false, error: "no_sender" });
            continue;
          }
          const sent = await sendWhatsApp(r.phone, from, r.body);
          logRows.push({
            order_id,
            event,
            recipient_type: r.type,
            phone: r.phone,
            status: sent.ok ? "sent" : "failed",
            provider_sid: sent.sid,
            error: sent.error,
          });
          results.push({ type: r.type, ok: sent.ok, error: sent.error });
        }

        if (recipients.length === 0) {
          logRows.push({
            order_id,
            event,
            recipient_type: "none",
            status: "skipped",
            error: "No valid phone numbers for this event",
          });
        }

        if (logRows.length) await supabaseAdmin.from("notification_log").insert(logRows as never);

        return Response.json({ event, sent: results });
      },
    },
  },
});
