// Server-only helpers for MSG91 OTP widget verification.
// The AuthKey never leaves the server.

export type Msg91VerifyResult = { ok: boolean; error: string | null };

/**
 * Validates the access token returned by the MSG91 widget's verifyOtp()
 * success callback. This is the only trustworthy proof that the visitor
 * actually received and entered the SMS code.
 */
export async function verifyMsg91AccessToken(accessToken: string): Promise<Msg91VerifyResult> {
  const authkey = process.env["MSG91_AUTH_KEY"];
  if (!authkey) return { ok: false, error: "SMS verification is not configured" };

  try {
    const res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey, "access-token": accessToken }),
    });
    const text = await res.text();
    let parsed: { type?: string; message?: string } = {};
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      /* non-JSON response */
    }
    if (res.ok && parsed.type === "success") return { ok: true, error: null };
    return { ok: false, error: parsed.message ?? "Could not verify the code" };
  } catch {
    return { ok: false, error: "Verification service is unreachable" };
  }
}
