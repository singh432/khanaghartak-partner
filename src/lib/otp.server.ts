// Server-only helpers for phone OTP delivery over the WhatsApp Cloud API.

/** Matches app_private.norm_phone(): last 10 digits of the number. */
export function normPhone(raw: string): string {
  return (raw ?? "").replace(/[^0-9]/g, "").slice(-10);
}

/** Must match verify_phone_otp(): sha256 hex of "<code>:<norm_phone>". */
export async function hashOtp(code: string, phone10: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${code}:${phone10}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return n.toString().padStart(6, "0");
}

type Attempt = { template: string; language: string; params: string[]; withUrlButton?: boolean };

/**
 * Delivery attempts in priority order. `kgt_otp` is the dedicated
 * AUTHENTICATION template; when it is not approved yet we fall back to an
 * approved utility template that can carry the code in its single variable.
 */
function attempts(code: string): Attempt[] {
  const carrier = `KhanaGharTak.in verification code ${code} (valid 10 minutes)`;
  return [
    { template: "kgt_otp", language: "en", params: [code], withUrlButton: true },
    { template: "kgt_otp", language: "en_US", params: [code], withUrlButton: true },
    { template: "kgt_otp", language: "en", params: [code] },
    { template: "kgt_otp", language: "en_US", params: [code] },
    { template: "kgt_order_delivered", language: "en", params: [carrier] },
  ];
}

async function post(phoneNumberId: string, token: string, to: string, a: Attempt) {
  const components: Record<string, unknown>[] = [
    { type: "body", parameters: a.params.map((p) => ({ type: "text", text: p })) },
  ];
  if (a.withUrlButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: a.params[0] }],
    });
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: { name: a.template, language: { code: a.language }, components },
    }),
  });
  return { ok: res.ok, text: await res.text() };
}

export type OtpSendResult = { ok: boolean; sid: string | null; error: string | null; template: string | null };

/** Sends the code to an E.164-less digits string (e.g. 919711720846). */
export async function sendOtpWhatsApp(toDigits: string, code: string): Promise<OtpSendResult> {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) {
    return { ok: false, sid: null, error: "WhatsApp is not configured", template: null };
  }

  let lastError = "Unknown error";
  for (const a of attempts(code)) {
    try {
      const { ok, text } = await post(phoneNumberId, token, toDigits, a);
      if (ok) {
        let sid: string | null = null;
        try {
          sid = (JSON.parse(text) as { messages?: { id?: string }[] }).messages?.[0]?.id ?? null;
        } catch {
          /* ignore */
        }
        return { ok: true, sid, error: null, template: a.template };
      }
      try {
        const e = (JSON.parse(text) as { error?: { message?: string; code?: number } }).error;
        lastError = e?.message ? `[${e.code ?? ""}] ${e.message}` : text.slice(0, 300);
      } catch {
        lastError = text.slice(0, 300);
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  console.error(`OTP send failed: ${lastError}`);
  return { ok: false, sid: null, error: lastError, template: null };
}
