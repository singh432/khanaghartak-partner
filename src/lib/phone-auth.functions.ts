import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Signs a visitor in with a mobile number that was just verified through the
 * MSG91 SMS OTP widget.
 *
 * - Reuses the existing account when the phone is already verified for a user
 *   (so a Google customer who verifies their phone never gets a duplicate).
 * - Otherwise creates a Supabase auth user with a deterministic internal email
 *   (the phone number is the real identity; no password is ever used).
 * - Returns a one-time email token hash the browser exchanges for a session.
 */
export const signInWithPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        phone: z.string().min(7).max(20),
        accessToken: z.string().min(10).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { verifyMsg91AccessToken } = await import("./msg91.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone10 = (data.phone ?? "").replace(/[^0-9]/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone10)) {
      return { ok: false as const, error: "Enter a valid 10-digit mobile number", token_hash: null, email: null };
    }

    const verified = await verifyMsg91AccessToken(data.accessToken);
    if (!verified.ok) {
      return { ok: false as const, error: verified.error ?? "Verification failed", token_hash: null, email: null };
    }

    // 1) Find any existing account that already belongs to this number.
    //    Order of trust: verified phone → customer profile → rider profile → restaurant contact.
    //    This makes a Google/Gmail signup (restaurant, rider, zone manager, customer)
    //    reachable by its mobile number instead of creating a second account.
    const like = `%${phone10}`;

    const candidates: string[] = [];

    const { data: verifiedRows } = await supabaseAdmin
      .from("verified_phones")
      .select("user_id")
      .eq("phone", phone10)
      .order("verified_at", { ascending: true })
      .limit(1);
    for (const r of (verifiedRows ?? []) as { user_id: string }[]) candidates.push(r.user_id);

    if (!candidates.length) {
      const { data: profileRows } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .like("phone", like)
        .order("created_at", { ascending: true })
        .limit(1);
      for (const r of (profileRows ?? []) as { id: string }[]) candidates.push(r.id);
    }

    if (!candidates.length) {
      const { data: riderRows } = await supabaseAdmin
        .from("rider_profiles")
        .select("user_id")
        .like("phone", like)
        .order("created_at", { ascending: true })
        .limit(1);
      for (const r of (riderRows ?? []) as { user_id: string }[]) candidates.push(r.user_id);
    }

    if (!candidates.length) {
      const { data: restRows } = await supabaseAdmin
        .from("restaurants")
        .select("owner_id")
        .like("phone", like)
        .not("owner_id", "is", null)
        .order("created_at", { ascending: true })
        .limit(1);
      for (const r of (restRows ?? []) as { owner_id: string }[]) candidates.push(r.owner_id);
    }

    let userId: string | null = candidates[0] ?? null;
    let email: string | null = null;

    if (userId) {
      const { data: found } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = found?.user?.email ?? null;
      if (!email) userId = null;
    }

    const internalEmail = `p${phone10}@phone.khanaghartak.in`;

    if (!userId) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: internalEmail,
        email_confirm: true,
        phone_confirm: false,
        user_metadata: { full_name: `+91 ${phone10}`, phone: phone10, signup_method: "phone_otp" },
      });
      if (created?.user) {
        userId = created.user.id;
        email = internalEmail;
      } else {
        // Most likely the internal email already exists — reuse that account.
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = list?.users?.find((u) => u.email === internalEmail);
        if (!match) {
          console.error(`Phone sign-in could not create user: ${createError?.message ?? "unknown"}`);
          return { ok: false as const, error: "Could not sign you in, please try again", token_hash: null, email: null };
        }
        userId = match.id;
        email = match.email ?? internalEmail;
      }
    }

    // 2) Record the number as verified for this account (idempotent).
    await supabaseAdmin
      .from("verified_phones")
      .upsert({ user_id: userId, phone: phone10 } as never, { onConflict: "user_id,phone" });

    // Keep the profile phone in sync without overwriting other profile data.
    await supabaseAdmin.from("profiles").update({ phone: phone10 } as never).eq("id", userId).is("phone", null);

    // 3) Mint a one-time link the browser can exchange for a session.
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email!,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (!tokenHash) {
      console.error(`Phone sign-in link failed: ${linkError?.message ?? "no token"}`);
      return { ok: false as const, error: "Could not sign you in, please try again", token_hash: null, email: null };
    }

    return { ok: true as const, error: null, token_hash: tokenHash, email };
  });
