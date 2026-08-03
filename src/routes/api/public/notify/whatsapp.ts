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

async function sendWhatsApp(to: string, template: string, params: string[]) {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) {
    return { ok: false, sid: null, error: "WhatsApp Cloud API is not configured" };
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template,
        language: { code: "en" },
        components: params.length
          ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }]
          : [],
      },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`WhatsApp send failed [${res.status}]: ${text}`);
    let msg = text.slice(0, 500);
    try {
      const e = (JSON.parse(text) as { error?: { message?: string; code?: number } }).error;
      if (e?.message) msg = `[${e.code ?? res.status}] ${e.message}`;
    } catch {
      /* ignore */
    }
    return { ok: false, sid: null, error: msg };
  }
  let sid: string | null = null;
  try {
    sid = (JSON.parse(text) as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null;
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

        if (cfg && cfg.whatsapp_enabled === false) return Response.json({ skipped: "disabled" });

        const { data: restaurant } = await supabaseAdmin
          .from("restaurants")
          .select("name, phone, address")
          .eq("id", order.restaurant_id as string)
          .maybeSingle();

        const orderRef = shortId(order.id as string);
        const total = `₹${Number(order.total ?? 0).toFixed(0)}`;
        const dropArea = clean((order.landmark as string | null) || (order.address as string));
        const recipients: Recipient[] = [];

        if (event === "order_placed") {
          const phone = toE164(restaurant?.phone as string | null);
          if (phone) {
            recipients.push({
              type: "restaurant",
              phone,
              template: "kgt_new_order",
              params: [orderRef, itemLines(order.items), total, dropArea],
            });
          }
        } else if (event === "restaurant_accepted") {
          const phone = toE164(order.customer_phone as string);
          if (phone) {
            recipients.push({
              type: "customer",
              phone,
              template: "kgt_order_accepted",
              params: [orderRef, clean(restaurant?.name as string | null, "the kitchen")],
            });
          }
        } else if (event === "ready_for_pickup") {
          const { data: riders } = await supabaseAdmin
            .from("rider_profiles")
            .select("phone, full_name")
            .eq("status", "approved");
          const pickup = clean(
            `${(restaurant?.name as string | null) ?? "Restaurant"}, ${(restaurant?.address as string | null) ?? ""}`,
            "Restaurant",
          );
          for (const r of riders ?? []) {
            const phone = toE164(r.phone as string | null);
            if (!phone) continue;
            recipients.push({
              type: "rider",
              phone,
              template: "kgt_delivery_available",
              params: [orderRef, pickup, dropArea, total],
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
              template: "kgt_order_picked_up",
              params: [orderRef, clean(riderName, "Your rider"), total],
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

        const results: { type: string; ok: boolean; error: string | null }[] = [];
        const logRows: Record<string, unknown>[] = [];

        for (const r of recipients) {
          const sent = await sendWhatsApp(r.phone, r.template, r.params);

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
