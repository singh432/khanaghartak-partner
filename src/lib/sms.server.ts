/**
 * Server-only SMS provider adapter (currently MSG91).
 * Keep the provider details isolated here so it can be swapped later.
 */

const MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/";

export type SmsResult = { sent: boolean; error: string | null };

/** Customer-safe message; never contains provider or config details. */
export const SMS_GENERIC_ERROR = "Unable to send OTP right now. Please try again.";

/** Shown when the SMS provider credentials have not been set up yet. */
export const SMS_NOT_CONFIGURED =
  "SMS verification is not set up yet. Please contact support on 97117 20846.";

/** 10-digit Indian mobile → E.164 (+91XXXXXXXXXX). Returns null when invalid. */
export function normalizeIndianPhone(phone: string): string | null {
  const digits = phone.replace(/[^0-9]/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

function config() {
  return {
    authKey: process.env["MSG91_AUTH_KEY"] ?? "",
    templateId: process.env["MSG91_TEMPLATE_ID"] ?? "",
    senderId: process.env["MSG91_SENDER_ID"] ?? "",
  };
}

/** Strip anything that could leak keys/OTPs before logging. */
function sanitize(text: string): string {
  return text.replace(/\d{6,}/g, "[redacted]").slice(0, 200);
}

/**
 * Low-level send through the MSG91 Flow API using a DLT-approved template.
 * `variables` map to the ##VAR## placeholders configured in the MSG91 template.
 */
export async function sendSms(
  e164: string,
  variables: Record<string, string>,
): Promise<SmsResult> {
  const { authKey, templateId, senderId } = config();
  if (!authKey || !templateId) {
    console.error("SMS: MSG91 credentials are not configured");
    return { sent: false, error: SMS_NOT_CONFIGURED };
  }

  const payload: Record<string, unknown> = {
    template_id: templateId,
    short_url: "0",
    recipients: [{ mobiles: e164.replace(/^\+/, ""), ...variables }],
  };
  if (senderId) payload["sender"] = senderId;

  try {
    const res = await fetch(MSG91_FLOW_URL, {
      method: "POST",
      headers: {
        authkey: authKey,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let accepted = res.ok;
    try {
      const json = JSON.parse(text) as { type?: string };
      if (json.type && json.type.toLowerCase() !== "success") accepted = false;
    } catch {
      /* non-JSON body: rely on HTTP status */
    }
    if (!accepted) {
      console.error(`SMS: provider rejected request [${res.status}]: ${sanitize(text)}`);
      return { sent: false, error: SMS_GENERIC_ERROR };
    }
    return { sent: true, error: null };
  } catch (err) {
    console.error(`SMS: network error: ${sanitize(err instanceof Error ? err.message : String(err))}`);
    return { sent: false, error: SMS_GENERIC_ERROR };
  }
}

/** Sends the verification code over SMS. The code is never logged or returned. */
export async function sendSmsOtp(phone: string, otp: string): Promise<SmsResult> {
  const e164 = normalizeIndianPhone(phone);
  if (!e164) {
    console.error("SMS: invalid Indian mobile number supplied");
    return { sent: false, error: "Enter a valid 10-digit mobile number" };
  }
  // MSG91 templates commonly use ##OTP##; both keys are accepted harmlessly.
  return sendSms(e164, { OTP: otp, otp });
}
