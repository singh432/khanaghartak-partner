import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { confirmPhoneVerification } from "@/lib/otp.functions";
import { loadMsg91, sendSmsOtp, verifySmsOtp, RESEND_SECONDS } from "@/lib/msg91-widget";
import { Button } from "@/components/ui/button";

type Props = {
  phone: string;
  onVerified: () => void;
};

export function PhoneVerification({ phone, onVerified }: Props) {
  const confirm = useServerFn(confirmPhoneVerification);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState("");
  const reqIdRef = useRef<string>("");
  const [reqId, setReqId] = useState("");

  const digits = phone.replace(/[^0-9]/g, "").slice(-10);
  const valid = /^[6-9]\d{9}$/.test(digits);
  const storeKey = `kgt_otp_sent_${digits}`;
  const reqKey = `kgt_otp_req_${digits}`;

  const [sent, setSent] = useState(() => {
    if (typeof window === "undefined") return false;
    const initialDigits = phone.replace(/[^0-9]/g, "").slice(-10);
    const raw = localStorage.getItem(`kgt_otp_sent_${initialDigits}`);
    return Boolean(raw && Date.now() - Number(raw) < 15 * 60 * 1000);
  });

  /** Persists the latest reqId so it survives re-renders and remounts. */
  const rememberReqId = (id: string) => {
    if (!id) return;
    reqIdRef.current = id;
    setReqId(id);
    try {
      localStorage.setItem(reqKey, id);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadMsg91().catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Keep the "enter code" step open when the user switches to the SMS app
  // to read the code and comes back (the page may remount and lose state).
  useEffect(() => {
    if (!valid) return;
    const restorePendingStep = () => {
      const raw = localStorage.getItem(storeKey);
      const fresh = Boolean(raw && Date.now() - Number(raw) < 15 * 60 * 1000);
      setSent(fresh);
      const savedReq = localStorage.getItem(reqKey) ?? "";
      if (fresh && savedReq && !reqIdRef.current) {
        reqIdRef.current = savedReq;
        setReqId(savedReq);
      }
    };
    try { restorePendingStep(); } catch { /* ignore */ }
    window.addEventListener("pageshow", restorePendingStep);
    document.addEventListener("visibilitychange", restorePendingStep);
    return () => {
      window.removeEventListener("pageshow", restorePendingStep);
      document.removeEventListener("visibilitychange", restorePendingStep);
    };
  }, [storeKey, reqKey, valid]);

  const send = async (isRetry: boolean) => {
    if (!valid) return toast.error("Enter a valid 10-digit mobile number");
    if (sending) return; // prevent simultaneous requests
    if (isRetry && cooldown > 0) return;
    setSending(true);
    try {
      const id = await sendSmsOtp(digits, isRetry ? reqIdRef.current || undefined : undefined);
      rememberReqId(id);

      setSent(true);
      setCooldown(RESEND_SECONDS);
      try {
        localStorage.setItem(storeKey, String(Date.now()));
      } catch {
        /* ignore */
      }
      toast.success("Verification code sent by SMS");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code");
    }
    setSending(false);
  };

  const activeReqId = reqId || reqIdRef.current;

  const verify = async () => {
    const otp = code.replace(/\D/g, "");
    if (otp.length !== 4) return toast.error("Enter the 4-digit code");
    if (verifying) return;
    if (!activeReqId) {
      return toast.error("This code has expired. Tap Resend OTP to get a new one.");
    }
    setVerifying(true);
    try {
      const accessToken = await verifySmsOtp(otp, activeReqId);

      const res = await confirm({ data: { phone: digits, accessToken } });
      if (!res.ok) {
        toast.error(res.error ?? "Verification failed, please try again");
        setVerifying(false);
        return;
      }
      try {
        localStorage.removeItem(storeKey);
        localStorage.removeItem(reqKey);
      } catch {
        /* ignore */
      }

      toast.success("Number verified");
      onVerified();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Incorrect code, please try again");
    }
    setVerifying(false);
  };

  return (
    <div className="space-y-3 rounded-2xl border-2 border-primary/30 bg-accent/30 p-3">
      <div className="flex items-start gap-2 text-xs font-semibold text-primary">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Verify your mobile number to place your order.</span>
      </div>

      {!sent ? (
        <Button
          onClick={() => void send(false)}
          disabled={sending || !valid}
          className="h-12 w-full font-bold"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          Send OTP
        </Button>
      ) : (
        <div className="space-y-2">
          <input
            className="ck-input tracking-[0.4em] text-center"
            inputMode="numeric"
            maxLength={4}
            placeholder="____"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            onClick={() => void verify()}
            disabled={verifying || !activeReqId}
            className="h-12 w-full font-bold"
          >
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify number
          </Button>
          {!activeReqId && (
            <p className="text-center text-xs font-semibold text-destructive">
              This code has expired. Tap Resend OTP to get a new one.
            </p>
          )}

          <Button
            variant="link"
            onClick={() => void send(true)}
            disabled={sending || cooldown > 0}
            className="h-auto w-full text-xs font-semibold"
          >
            {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
          </Button>
        </div>
      )}
    </div>
  );
}
