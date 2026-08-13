import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ phone: z.string().trim().min(7).max(15) });

const GRAPH = "https://graph.facebook.com/v21.0";
const OTP_TEMPLATE = "kgt_otp";

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

async function getWabaId(token: string, phoneNumberId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GRAPH}/${phoneNumberId}?fields=whatsapp_business_account&access_token=${token}`,
    );
    const json = (await res.json()) as { whatsapp_business_account?: { id?: string } };
    return json.whatsapp_business_account?.id ?? null;
  } catch {
    return null;
  }
}

/** Read the approved template list so we never guess a template name. */
async function listTemplates(token: string, waba: string): Promise<Tpl[]> {
  try {
    const res = await fetch(`${GRAPH}/${waba}/message_templates?limit=200&access_token=${token}`);
    const json = (await res.json()) as {
      data?: {
        name: string;
        status: string;
        category?: string;
        language: string;
        components?: { type: string; text?: string }[];
      }[];
    };
    return (json.data ?? [])
      .filter((t) => t.status === "APPROVED")
      .map((t) => {
        const body = t.components?.find((c) => c.type === "BODY");
        const vars = new Set((body?.text ?? "").match(/\{\{\d+\}\}/g) ?? []);
        return {
          name: t.name,
          language: t.language,
          bodyVars: vars.size,
          auth: (t.category ?? "").toUpperCase() === "AUTHENTICATION",
          hasButton: Boolean(t.components?.some((c) => c.type === "BUTTONS")),
        };
      });
  } catch (err) {
    console.error(`Template list failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/** Only an authentication-style template may carry a login code. */
function pickTemplate(tpls: Tpl[]): Tpl | null {
  return (
    tpls.find((t) => t.auth) ??
    tpls.find((t) => /otp|verif|code/i.test(t.name) && t.bodyVars === 1) ??
    null
  );
}

/** Authentication templates are auto-approved by Meta within seconds, so self-heal. */
async function createAuthTemplate(token: string, waba: string): Promise<string | null> {
  try {
    const res = await fetch(`${GRAPH}/${waba}/message_templates`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: OTP_TEMPLATE,
        language: "en_US",
        category: "AUTHENTICATION",
        components: [
          { type: "BODY", add_security_recommendation: true },
          { type: "FOOTER", code_expiration_minutes: 10 },
          { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy code" }] },
        ],
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`OTP template create failed: ${text.slice(0, 300)}`);
      return null;
    }
    return "en_US";
  } catch (err) {
    console.error(`OTP template create error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function post(token: string, phoneNumberId: string, body: unknown) {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, text: await res.text() };
}

async function trySend(
  token: string,
  phoneNumberId: string,
  to: string,
  code: string,
  tpl: { name: string; language: string },
): Promise<{ delivered: boolean; error: string }> {
  const variants = [
    [
      { type: "body", parameters: [{ type: "text", text: code }] },
      { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
    ],
    [{ type: "body", parameters: [{ type: "text", text: code }] }],
  ];
  let lastError = "Could not send the code";
  for (const components of variants) {
    const { ok, text } = await post(token, phoneNumberId, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: tpl.name, language: { code: tpl.language }, components },
    });
    if (ok) return { delivered: true, error: "" };
    lastError = text.slice(0, 300);
    console.error(`OTP template "${tpl.name}" failed: ${lastError}`);
  }
  return { delivered: false, error: lastError };
}

async function sendCode(to: string, code: string): Promise<{ delivered: boolean; error: string | null }> {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) return { delivered: false, error: "WhatsApp messaging is not configured" };

  const waba = await getWabaId(token, phoneNumberId);
  if (!waba) {
    console.error("Could not resolve WhatsApp Business Account id for the configured phone number");
    return { delivered: false, error: "WhatsApp account is not reachable right now" };
  }

  const tpls = await listTemplates(token, waba);
  let tpl = pickTemplate(tpls);

  if (!tpl) {
    console.error(
      `No OTP template approved. Approved templates: ${
        tpls.map((t) => `${t.name}(${t.bodyVars})`).join(", ") || "none"
      } — creating "${OTP_TEMPLATE}".`,
    );
    const language = await createAuthTemplate(token, waba);
    if (language) tpl = { name: OTP_TEMPLATE, language, bodyVars: 1, auth: true, hasButton: true };
  }

  if (tpl) {
    const sent = await trySend(token, phoneNumberId, to, code, tpl);
    if (sent.delivered) return { delivered: true, error: null };
  }

  // Plain text only reaches a customer who messaged the business in the last 24h,
  // so it is the last resort, never the primary path.
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
    error: "WhatsApp could not deliver the code right now. Please try again in a minute or contact support.",
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
