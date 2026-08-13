import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normPhone, toE164, sha256Hex, sendCode } from "@/lib/otp.server";

const schema = z.object({ phone: z.string().trim().min(7).max(15) });

export const sendPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const digits = normPhone(data.phone);
    if (digits.length !== 10) return { ok: false, sent: false, error: "Enter a valid 10-digit mobile number" };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(`${code}:${digits}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("create_phone_otp", {
      _user_id: context.userId,
      _phone: digits,
      _code_hash: codeHash,
    });
    if (error) return { ok: false, sent: false, error: error.message };

    const sent = await sendCode(toE164(digits), code);
    if (!sent.delivered) {
      return { ok: false, sent: false, error: sent.error ?? "Could not send code" };
    }
    return { ok: true, sent: true, error: null };
  });
