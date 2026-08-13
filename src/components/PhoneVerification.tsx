import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2, MessageCircle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { sendPhoneOtp } from "@/lib/otp.functions";

export function PhoneVerification({
  phone,
  verified,
  onVerified,
}: {
  phone: string;
  verified: boolean;
  onVerified: () => void;
}) {
  const send = useServerFn(sendPhoneOtp);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => { setSent(false); setCode(""); }, [phone]);

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-xl border-2 border-success/40 bg-success/10 p-3 text-xs font-semibold text-success">
        <ShieldCheck className="h-4 w-4" /> Mobile number verified
      </div>
    );
  }

  const digits = phone.replace(/[^0-9]/g, "").slice(-10);

  const request = async () => {
    if (digits.length !== 10) return toast.error("Enter a valid 10-digit mobile number");
    setSending(true);
    const res = await send({ data: { phone: digits } }).catch((e: unknown) => ({
      ok: false,
      error: e instanceof Error ? e.message : "Could not send code",
    }));
    setSending(false);
    if (!res.ok) return toast.error(res.error ?? "Could not send code");
    setSent(true);
    setSeconds(45);
    toast.success("Verification code sent on WhatsApp");
  };

  const verify = async () => {
    if (code.trim().length !== 6) return toast.error("Enter the 6-digit code");
    setChecking(true);
    const { data, error } = await supabase.rpc("verify_phone_otp", { _phone: digits, _code: code.trim() });
    setChecking(false);
    if (error) return toast.error(error.message);
    if (!data) return toast.error("Incorrect code, please try again");
    toast.success("Mobile number verified");
    onVerified();
  };

  return (
    <div className="space-y-3 rounded-xl border-2 border-primary/40 bg-accent/40 p-3">
      <div className="flex items-start gap-2 text-xs text-foreground/80">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>First order — verify your mobile number with a one-time code on WhatsApp before we confirm Cash on Delivery.</span>
      </div>

      {sent && (
        <input
          className="ck-input tracking-[0.4em] text-center"
          value={code}
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={request}
          disabled={sending || seconds > 0}
          className="flex-1 rounded-xl border-2 border-primary/50 bg-background py-2.5 text-xs font-bold text-primary disabled:opacity-60"
        >
          {sending && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
          {seconds > 0 ? `Resend in ${seconds}s` : sent ? "Resend code" : "Send OTP"}
        </button>
        {sent && (
          <button
            type="button"
            onClick={verify}
            disabled={checking}
            className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            {checking && <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />}
            Verify
          </button>
        )}
      </div>
    </div>
  );
}
