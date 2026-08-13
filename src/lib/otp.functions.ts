import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Confirms an MSG91 widget verification server-side and records the phone
 * number as verified for the signed-in user.
 */
export const confirmPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().min(7).max(20),
        accessToken: z.string().min(10).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { verifyMsg91AccessToken } = await import("./msg91.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone10 = (data.phone ?? "").replace(/[^0-9]/g, "").slice(-10);
    if (phone10.length !== 10) return { ok: false, error: "Enter a valid 10-digit mobile number" };

    const verified = await verifyMsg91AccessToken(data.accessToken);
    if (!verified.ok) return { ok: false, error: verified.error ?? "Verification failed" };

    const { error } = await supabaseAdmin
      .from("verified_phones")
      .upsert({ user_id: context.userId, phone: phone10 } as never, { onConflict: "user_id,phone" });
    if (error) {
      console.error(`Could not store verified phone: ${error.message}`);
      return { ok: false, error: "Could not save your verification, please try again" };
    }

    await supabaseAdmin.from("notification_log").insert({
      event: "otp",
      recipient_type: "customer",
      phone: `91${phone10}`,
      status: "sent",
      provider_sid: null,
      error: null,
    } as never);

    return { ok: true, error: null };
  });
