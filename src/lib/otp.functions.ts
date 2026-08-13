import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const input = z.object({ phone: z.string().min(7).max(20) });

export const requestPhoneOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const { normPhone, hashOtp, generateOtp, sendOtpWhatsApp } = await import("./otp.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone10 = normPhone(data.phone);
    if (phone10.length !== 10) return { ok: false, error: "Enter a valid 10-digit mobile number" };

    // Simple throttle: one code per 45 seconds per user+phone.
    const { data: recent } = await supabaseAdmin
      .from("phone_otps")
      .select("created_at")
      .eq("user_id", context.userId)
      .eq("phone", phone10)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at && Date.now() - new Date(recent.created_at as string).getTime() < 45_000) {
      return { ok: false, error: "Please wait a few seconds before requesting a new code" };
    }

    const code = generateOtp();
    const code_hash = await hashOtp(code, phone10);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: insertError } = await supabaseAdmin.from("phone_otps").insert({
      user_id: context.userId,
      phone: phone10,
      code_hash,
      expires_at,
    } as never);
    if (insertError) return { ok: false, error: "Could not create a verification code" };

    const sent = await sendOtpWhatsApp(`91${phone10}`, code);
    if (!sent.ok) {
      return {
        ok: false,
        error: "WhatsApp verification is temporarily unavailable. Please try again shortly.",
      };
    }
    return { ok: true, error: null };
  });
