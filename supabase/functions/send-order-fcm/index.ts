// Supabase Edge Function: send-order-fcm
// Triggered by Database Webhook on public.orders INSERT
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function pemToBinary(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64url(buf: string | Uint8Array | ArrayBuffer): string {
  let str: string;
  if (typeof buf === "string") {
    str = btoa(buf);
  } else {
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    str = btoa(binary);
  }
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let cachedOAuthToken: { token: string; expiresAt: number } | null = null;

async function getGoogleOAuthToken(sa: ServiceAccount): Promise<string> {
  if (cachedOAuthToken && Date.now() < cachedOAuthToken.expiresAt - 300000) {
    return cachedOAuthToken.token;
  }

  const keyBytes = pemToBinary(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const claimsB64 = base64url(JSON.stringify(claims));
  const sigInput = `${headerB64}.${claimsB64}`;

  const sigBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(sigInput)
  );

  const sigB64 = base64url(sigBytes);
  const jwt = `${sigInput}.${sigB64}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const resJson = await res.json();
  if (!resJson.access_token) {
    throw new Error(`Google OAuth error: ${JSON.stringify(resJson)}`);
  }

  cachedOAuthToken = {
    token: resJson.access_token,
    expiresAt: Date.now() + (resJson.expires_in || 3600) * 1000,
  };
  return cachedOAuthToken.token;
}

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
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ?? "";

    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "FIREBASE_SERVICE_ACCOUNT secret is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sa: ServiceAccount = JSON.parse(serviceAccountJson);
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
      return new Response(
        JSON.stringify({ status: "skipped", message: "No restaurant owner found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch active partner device tokens for restaurant owner
    const tokenSet = new Set<string>();
    try {
      const { data: pd } = await supabase
        .from("push_devices")
        .select("token")
        .eq("user_id", ownerId);
      if (pd) {
        for (const row of pd) {
          if (row?.token && typeof row.token === "string" && row.token.trim().length > 10) {
            tokenSet.add(row.token.trim());
          }
        }
      }
    } catch (_) {}

    const tokens = Array.from(tokenSet);
    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ status: "skipped", message: "No active partner tokens registered for owner" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const shortId = String(order.id).slice(0, 8).toUpperCase();
    const title = "🚨 NEW ORDER RECEIVED!";
    const body = `Order #${shortId} · ₹${Math.round(Number(order.total) || 0)} · Tap to accept!`;

    // 3. Obtain Google OAuth 2.0 access token
    const oauthToken = await getGoogleOAuthToken(sa);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    // 4. Send high-priority FCM v1 message to all owner partner devices
    const results = [];
    for (const token of tokens) {
      const fcmRes = await fetch(fcmEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${oauthToken}`,
        },
        body: JSON.stringify({
          message: {
            token: token,
            android: {
              priority: "HIGH",
            },
            data: {
              order_id: String(order.id),
              role: "restaurant",
              notification_type: "NEW_ORDER",
              sound: "order_siren",
              android_channel_id: "orders_channel_v2",
              title,
              body,
            },
          },
        }),
      const resData = await fcmRes.json();
      if (!fcmRes.ok && (fcmRes.status === 404 || JSON.stringify(resData).includes("UNREGISTERED"))) {
        await supabase.from("push_devices").delete().eq("token", token);
      }
      results.push({ token: token.slice(0, 10) + "...", status: fcmRes.status, result: resData });
    }

    return new Response(JSON.stringify({ success: true, delivered: results.length, details: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
