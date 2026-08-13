import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ phone: z.string().trim().min(7).max(15) });

function normPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

function toE164(raw: string): string {
  const d = normPhone(raw);
  return `91${d}`;
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendCode(to: string, code: string): Promise<{ delivered: boolean; error: string | null }> {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) return { delivered: false, error: "Messaging is not configured" };

  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const bodies: unknown[] = [
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: "otp_verification",
        language: { code: "en" },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    },
    {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: "otp_verification",
        language: { code: "en" },
        components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
      },
    },
    {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: `KhanaGharTak.in · Your verification code is ${code}. It expires in 10 minutes. Never share this code.` },
    },
  ];

  let lastError = "Could not send code";
  for (const body of bodies) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return { delivered: true, error: null };
      const text = await res.text();
      lastError = text.slice(0, 300);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  console.error(`OTP send failed: ${lastError}`);
  return { delivered: false, error: "Could not send the code on WhatsApp right now" };
}

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const digits = normPhone(data.phone);
    if (digits.length !== 10) return { ok: false, error: "Enter a valid 10-digit mobile number" };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(`${code}:${digits}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("create_phone_otp", {
      _user_id: context.userId,
      _phone: digits,
      _code_hash: codeHash,
    });
    if (error) return { ok: false, error: error.message };

    const sent = await sendCode(toE164(digits), code);
    if (!sent.delivered) return { ok: false, error: sent.error ?? "Could not send code" };
    return { ok: true, error: null };
  });
