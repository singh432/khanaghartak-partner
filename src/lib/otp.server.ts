const GRAPH = "https://graph.facebook.com/v21.0";
/** The ONLY template allowed to carry an OTP. Must be an approved AUTHENTICATION template. */
export const OTP_TEMPLATE = "kgt_otp";

export const TEMPLATE_UNAVAILABLE = "WhatsApp OTP authentication template is not available yet.";

export function normPhone(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(-10);
}

export function toE164(raw: string): string {
  return `91${normPhone(raw)}`;
}

export async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Tpl = { name: string; language: string; auth: boolean; hasButton: boolean };

/**
 * The phone-number node does not expose the parent account, so resolve it from
 * the business accounts this system-user token owns and match the phone number.
 */
async function getWabaId(token: string, phoneNumberId: string): Promise<string | null> {
  const envWaba = process.env["WHATSAPP_WABA_ID"];
  if (envWaba) return envWaba;
  try {
    const bizRes = await fetch(`${GRAPH}/me/businesses?access_token=${token}`);
    const biz = (await bizRes.json()) as { data?: { id: string }[] };
    for (const b of biz.data ?? []) {
      const res = await fetch(`${GRAPH}/${b.id}/owned_whatsapp_business_accounts?access_token=${token}`);
      const json = (await res.json()) as { data?: { id: string }[] };
      for (const waba of json.data ?? []) {
        const pn = await fetch(`${GRAPH}/${waba.id}/phone_numbers?access_token=${token}`);
        const pnJson = (await pn.json()) as { data?: { id: string }[] };
        if ((pnJson.data ?? []).some((p) => p.id === phoneNumberId)) return waba.id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Read the approved template list so we never guess a template name. */
async function listAuthOtpTemplates(token: string, waba: string): Promise<Tpl[]> {
  try {
    const res = await fetch(`${GRAPH}/${waba}/message_templates?limit=200&access_token=${token}`);
    const json = (await res.json()) as {
      data?: {
        name: string;
        status: string;
        category?: string;
        language: string;
        components?: { type: string }[];
      }[];
    };
    return (json.data ?? [])
      .filter(
        (t) =>
          t.name === OTP_TEMPLATE &&
          t.status === "APPROVED" &&
          (t.category ?? "").toUpperCase() === "AUTHENTICATION",
      )
      .map((t) => ({
        name: t.name,
        language: t.language,
        auth: true,
        hasButton: Boolean(t.components?.some((c) => c.type === "BUTTONS")),
      }));
  } catch (err) {
    console.error(`Template list failed: ${err instanceof Error ? err.message : String(err)}`);
    return [];
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

function metaError(text: string): string {
  try {
    const json = JSON.parse(text) as { error?: { message?: string; error_user_msg?: string } };
    return json.error?.error_user_msg ?? json.error?.message ?? text.slice(0, 200);
  } catch {
    return text.slice(0, 200);
  }
}

/**
 * Sends the code strictly through the approved AUTHENTICATION template.
 * Marketing/utility templates and plain text are never used for OTP.
 */
export async function sendCode(
  to: string,
  code: string,
): Promise<{ delivered: boolean; error: string | null }> {
  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  if (!token || !phoneNumberId) return { delivered: false, error: "WhatsApp messaging is not configured" };

  const waba = await getWabaId(token, phoneNumberId);
  if (!waba) {
    console.error("OTP: could not resolve WABA id for the configured phone number.");
    return { delivered: false, error: TEMPLATE_UNAVAILABLE };
  }

  const templates = await listAuthOtpTemplates(token, waba);
  if (templates.length === 0) {
    console.error(`OTP: approved AUTHENTICATION template "${OTP_TEMPLATE}" not found on WABA.`);
    return { delivered: false, error: TEMPLATE_UNAVAILABLE };
  }

  let lastError = TEMPLATE_UNAVAILABLE;
  for (const tpl of templates) {
    const body = { type: "body", parameters: [{ type: "text", text: code }] };
    const variants: unknown[][] = tpl.hasButton
      ? [
          [
            body,
            { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
          ],
          [body],
        ]
      : [[body]];

    for (const components of variants) {
      const { ok, text } = await post(token, phoneNumberId, {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: tpl.name, language: { code: tpl.language }, components },
      });
      if (ok) return { delivered: true, error: null };
      lastError = metaError(text);
      console.error(`OTP template "${tpl.name}" (${tpl.language}) failed: ${lastError}`);
    }
  }

  return { delivered: false, error: `WhatsApp rejected the verification message: ${lastError}` };
}
