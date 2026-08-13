import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { requestPhoneOtp } from "@/lib/otp.functions";

type Props = {
  phone: string;
  onVerified: () => void;
};

export function PhoneVerification({ phone, onVerified }: Props) {
  const sendOtp = useServerFn(requestPhoneOtp);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");

  const digits = phone.replace(/[^0-9]/g, "").slice(-10);
  const valid = digits.length === 10;
  const storeKey = `kgt_otp_sent_${digits}`;

  // Keep the "enter code" step open when the user switches to WhatsApp to read
  // the code and comes back (the page may remount and lose state).
  useEffect(() => {
    if (!valid) return;
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw && Date.now() - Number(raw) < 10 * 60 * 1000) setSent(true);
    } catch {
      /* ignore */
    }
  }, [storeKey, valid]);

  const send = async () => {
    if (!valid) return toast.error("Enter a valid 10-digit mobile number");
    setSending(true);
    try {
      const res = await sendOtp({ data: { phone: digits } });
      if (res.ok) {
        setSent(true);
        try {
          localStorage.setItem(storeKey, String(Date.now()));
        } catch {
          /* ignore */
        }
        toast.success("Verification code sent on WhatsApp");
      } else {
        toast.error(res.error ?? "Could not send the code");
      }
    } catch {
      toast.error("WhatsApp verification is temporarily unavailable");
    }
    setSending(false);
  };

  const verify = async () => {
    if (code.replace(/\D/g, "").length !== 6) return toast.error("Enter the 6-digit code");
    setVerifying(true);
    const { data, error } = await supabase.rpc("verify_phone_otp", {
      _phone: digits,
      _code: code.replace(/\D/g, ""),
    });
    setVerifying(false);
    if (error) return toast.error(error.message);
    if (data === true) {
      toast.success("Number verified");
      onVerified();
    } else {
      toast.error("Incorrect code, please try again");
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary/30 bg-accent/30 p-3">
      <div className="flex items-start gap-2 text-xs font-semibold text-primary">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Verify this number once on WhatsApp to confirm your order.</span>
      </div>

      {!sent ? (
        <button
          onClick={send}
          disabled={sending || !valid}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Send code on WhatsApp
        </button>
      ) : (
        <div className="space-y-2">
          <input
            className="ck-input tracking-[0.4em] text-center"
            inputMode="numeric"
            maxLength={6}
            placeholder="______"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <button
            onClick={verify}
            disabled={verifying}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify number
          </button>
          <button onClick={send} disabled={sending} className="w-full text-xs font-semibold text-primary underline">
            Resend code
          </button>
        </div>
      )}
    </div>
  );
}
