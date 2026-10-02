// Supabase Edge Function: send-order-fcm
// Triggered by Database Webhook on public.orders INSERT
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const order = payload.record || payload;
    if (!order || !order.id) {
      return new Response(JSON.stringify({ error: "Missing order record" }), { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY") ?? "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch restaurant owner ID
    let ownerId: string | null = null;
    let restaurantName = "Restaurant";
    if (order.restaurant_id) {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("name, owner_id")
        .eq("id", order.restaurant_id)
        .maybeSingle();
      if (rest) {
        ownerId = rest.owner_id;
        restaurantName = rest.name || "Restaurant";
      }
    }

    if (!ownerId) {
      return new Response(JSON.stringify({ status: "skipped", message: "No restaurant owner found" }), { status: 200 });
    }

    // 2. Fetch device tokens for restaurant owner
    const { data: tokens } = await supabase
      .from("user_fcm_tokens")
      .select("token")
      .eq("user_id", ownerId)
      .eq("app_type", "partner")
      .eq("is_active", true);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ status: "skipped", message: "No active partner tokens registered for owner" }), { status: 200 });
    }

    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const title = "🚨 NEW ORDER RECEIVED!";
    const body = `Order #${shortId} · ₹${Math.round(Number(order.total) || 0)} · Tap to accept!`;

    // 3. Send high-priority FCM message to all owner devices
    const results = [];
    for (const t of tokens) {
      const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: t.token,
          priority: "high",
          notification: {
            title: title,
            body: body,
            android_channel_id: "orders_channel",
            sound: "order_siren",
          },
          data: {
            order_id: String(order.id),
            role: "restaurant",
            notification_type: "NEW_ORDER",
            title: title,
            body: body,
          },
        }),
      });
      results.push(await fcmRes.json());
    }

    return new Response(JSON.stringify({ success: true, delivered: results.length, details: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
