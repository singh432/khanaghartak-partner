import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { signInWithPhoneOtp } from "@/lib/phone-auth.functions";
import { loadMsg91, sendSmsOtp, verifySmsOtp, RESEND_SECONDS } from "@/lib/msg91-widget";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Mobile number + SMS OTP sign-in. No password is ever required. */
export function MobileLogin({ onBack }: { onBack: () => void }) {
  const signIn = useServerFn(signInWithPhoneOtp);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [reqId, setReqId] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const digits = phone.replace(/\D/g, "").slice(-10);
  const valid = /^[6-9]\d{9}$/.test(digits);

  // Warm up the MSG91 widget as soon as this step opens so the first
  // "Send OTP" tap never races the SDK.
  useEffect(() => {
    void loadMsg91().catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async (isRetry: boolean) => {
    if (!valid) return toast.error("Enter a valid 10-digit mobile number");
    if (busy || (isRetry && cooldown > 0)) return;
    setBusy(true);
    try {
      const id = await sendSmsOtp(digits, isRetry ? reqId : undefined);
      if (id) setReqId(id);
      setSent(true);
      setCooldown(RESEND_SECONDS);
      toast.success("OTP sent by SMS");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code");
    }
    setBusy(false);
  };

  const verify = async () => {
    const otp = code.replace(/\D/g, "");
    if (otp.length !== 4) return toast.error("Enter the 4-digit code");
    if (busy) return;
    if (!reqId) return toast.error("This code has expired. Tap Resend OTP.");
    setBusy(true);
    try {
      const accessToken = await verifySmsOtp(otp, reqId);
      const res = await signIn({ data: { phone: digits, accessToken } });
      if (!res.ok || !res.token_hash) {
        toast.error(res.error ?? "Could not sign you in");
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: res.token_hash });
      if (error) {
        toast.error("Could not sign you in, please try again");
        setBusy(false);
        return;
      }
      toast.success("Mobile number verified");
      // The login page redirects by role once the session lands.
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Incorrect code, please try again");
      setBusy(false);
    }
  };

  return (
    <div className="mt-8 space-y-3">
      {!sent ? (
        <>
          <label className="block text-sm font-semibold">Mobile number</label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground">+91</span>
            <input
              className="h-[52px] flex-1 bg-transparent text-[15px] font-semibold outline-none"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <p className="text-xs text-muted-foreground">No password required. We'll send you an OTP.</p>
          <Button onClick={() => void send(false)} disabled={busy || !valid} className="h-[52px] w-full font-bold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send OTP
          </Button>
        </>
      ) : (
        <>
          <p className="text-center text-sm font-semibold">Enter the code sent to +91 {digits}</p>
          <input
            className="ck-input h-[52px] w-full rounded-2xl border border-border bg-card text-center tracking-[0.4em]"
            inputMode="numeric"
            maxLength={4}
            placeholder="____"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <Button onClick={() => void verify()} disabled={busy} className="h-[52px] w-full font-bold">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify & continue
          </Button>
          <Button
            variant="link"
            onClick={() => void send(true)}
            disabled={busy || cooldown > 0}
            className="h-auto w-full text-xs font-semibold"
          >
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
          </Button>
          <button type="button" onClick={() => { setSent(false); setCode(""); }} className="w-full text-xs font-medium text-muted-foreground underline">
            Change mobile number
          </button>
        </>
      )}

      <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-medium text-primary underline">
        ← Back to all sign-in options
      </button>
    </div>
  );
}
