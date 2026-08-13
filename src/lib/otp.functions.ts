import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ phone: z.string().trim().min(7).max(15) });

const GRAPH = "https://graph.facebook.com/v21.0";

function normPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

function toE164(raw: string): string {
  return `91${normPhone(raw)}`;
}

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Tpl = { name: string; language: string; bodyVars: number; auth: boolean; hasButton: boolean };

/** Read the approved template list for the WhatsApp number so we never guess a name. */
async function listTemplates(token: string, phoneNumberId: string): Promise<Tpl[]> {
  try {
    const idRes = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=whatsapp_business_account&access_token=${token}`,
    );
    const idJson = (await idRes.json()) as { whatsapp_business_account?: { id?: string } };
    const waba = idJson.whatsapp_business_account?.id;
    if (!waba) return [];

    const res = await fetch(
      `${GRAPH}/${waba}/message_templates?limit=200&access_token=${token}`,
    );
    const json = (await res.json()) as {
      data?: {
        name: string;
        status: string;
        category?: string;
        language: string;
        components?: { type: string; text?: string; buttons?: unknown[] }[];
      }[];
    };
    return (json.data ?? [])
      .filter((t) => t.status === "APPROVED")
      .map((t) => {
        const body = t.components?.find((c) => c.type === "BODY");
        const buttons = t.components?.find((c) => c.type === "BUTTONS");
        const vars = new Set((body?.text ?? "").match(/\{\{\d+\}\}/g) ?? []);
        return {
          name: t.name,
          language: t.language,
          bodyVars: vars.size,
          auth: (t.category ?? "").toUpperCase() === "AUTHENTICATION",
          hasButton: Boolean(buttons),
        };
      });
  } catch (err) {
    console.error(`Template list failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

function pickTemplate(tpls: Tpl[]): Tpl | null {
  const auth = tpls.find((t) => t.auth);
  if (auth) return auth;
  const named = tpls.find((t) => /otp|verif|code/i.test(t.name) && t.bodyVars === 1);
  if (named) return named;
  return tpls.find((t) => t.bodyVars === 1) ?? null;
}

async function post(token: string, phoneNumberId: string, body: unknown) {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, text };
}

async function sendCode(to: string, code: string): Promise<{ delivered: boolean; error: string | null }> {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) return { delivered: false, error: "WhatsApp messaging is not configured" };

  const tpls = await listTemplates(token, phoneNumberId);
  const tpl = pickTemplate(tpls);
  let lastError = "Could not send the code";

  if (tpl) {
    const variants: unknown[] = [];
    if (tpl.auth || tpl.hasButton) {
      variants.push({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: tpl.name,
          language: { code: tpl.language },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
        },
      });
    }
    variants.push({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tpl.name,
        language: { code: tpl.language },
        components: [{ type: "body", parameters: [{ type: "text", text: code }] }],
      },
    });

    for (const body of variants) {
      const { ok, text } = await post(token, phoneNumberId, body);
      if (ok) return { delivered: true, error: null };
      lastError = text.slice(0, 300);
      console.error(`OTP template "${tpl.name}" failed: ${lastError}`);
    }
  } else {
    console.error(
      `No approved WhatsApp template available for OTP. Approved templates: ${
        tpls.map((t) => `${t.name}(${t.bodyVars})`).join(", ") || "none"
      }`,
    );
  }

  // Plain text only reaches a customer who messaged the business in the last 24h.
  const { ok, text } = await post(token, phoneNumberId, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body: `KhanaGharTak.in · Your verification code is ${code}. It expires in 10 minutes. Never share this code.`,
    },
  });
  if (ok) return { delivered: true, error: null };
  console.error(`OTP text fallback failed: ${text.slice(0, 300)}`);

  return {
    delivered: false,
    error: tpl
      ? "WhatsApp rejected the verification message. Please try again or contact support."
      : "WhatsApp verification template is not approved yet. Please contact support to place your first order.",
  };
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
