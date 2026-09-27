import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { signInWithPhoneOtp } from "@/lib/phone-auth.functions";
import { loadMsg91, sendSmsOtp, verifySmsOtp, RESEND_SECONDS } from "@/lib/msg91-widget";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** Mobile number + SMS OTP sign-in. No password is ever required. */
export function MobileLogin({
  onBack,
  backLabel = "← Back to all sign-in options",
  className,
}: {
  onBack?: () => void;
  backLabel?: string;
  className?: string;
}) {
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
      try { (window as any).AndroidOtp?.startSmsConsent?.(); } catch {}
      setCooldown(RESEND_SECONDS);
      toast.success("OTP sent by SMS");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the code");
    }
    setBusy(false);
  };

  const verify = async (overrideOtp?: string) => {
    const otp = (overrideOtp ?? code).replace(/\D/g, "").slice(0, 4);
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

  // OTP Auto-fill listeners: WebOTP API (browser/keyboard) + Native Android Bridge
  useEffect(() => {
    if (!sent) return;
    if (typeof window === "undefined") return;

    // 1. Native Android JavascriptInterface Bridge hook
    (window as any).__kgt_set_otp = (otp: string) => {
      const clean = otp.replace(/\D/g, "").slice(0, 4);
      if (clean.length === 4) {
        setCode(clean);
        toast.success("OTP auto-detected: " + clean);
        setTimeout(() => {
          void verify(clean);
        }, 200);
      }
    };

    // 2. Modern WebOTP API (Chrome / Android SMS verification)
    let ac: AbortController | null = null;
    if ("OTPCredential" in window && navigator.credentials) {
      try {
        ac = new AbortController();
        navigator.credentials
          .get({
            otp: { transport: ["sms"] },
            signal: ac.signal,
          } as any)
          .then((content: any) => {
            if (content && content.code) {
              const clean = String(content.code).replace(/\D/g, "").slice(0, 4);
              if (clean.length === 4) {
                setCode(clean);
                toast.success("OTP received: " + clean);
                setTimeout(() => {
                  void verify(clean);
                }, 200);
              }
            }
          })
          .catch(() => {});
      } catch {}
    }

    return () => {
      delete (window as any).__kgt_set_otp;
      if (ac) {
        try { ac.abort(); } catch {}
      }
    };
  }, [sent, reqId, digits]);

  return (
    <div className={className ?? "mt-8 space-y-3"}>
      {!sent ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-base font-bold text-slate-900">
              Enter mobile number
            </label>
            <p className="text-xs text-slate-500">
              We'll send you an OTP to verify your account
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
            <Phone className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-bold text-slate-700">+91</span>
            <input
              className="h-[52px] flex-1 bg-transparent text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 outline-none"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          <Button
            onClick={() => void send(false)}
            disabled={busy || !valid}
            className="h-[52px] w-full font-bold rounded-2xl bg-[#F45D2C] hover:bg-[#e04f20] text-white shadow-sm active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send OTP
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1 text-center">
            <h2 className="text-base font-bold text-slate-900">Enter OTP</h2>
            <p className="text-xs text-slate-500">
              Enter the 4-digit code sent to +91 {digits}
            </p>
          </div>
          <input
            id="otp-input"
            name="one-time-code"
            autoComplete="one-time-code"
            data-1p-ignore="true"
            className="ck-input h-[52px] w-full rounded-2xl border border-slate-200 bg-white text-center text-xl font-bold tracking-[0.4em] text-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none shadow-sm transition-all"
            inputMode="numeric"
            maxLength={4}
            placeholder="____"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setCode(val);
              if (val.length === 4) {
                setTimeout(() => void verify(val), 200);
              }
            }}
          />
          <Button
            onClick={() => void verify()}
            disabled={busy}
            className="h-[52px] w-full font-bold rounded-2xl bg-[#F45D2C] hover:bg-[#e04f20] text-white shadow-sm active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify & continue
          </Button>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => { setSent(false); setCode(""); }}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
            >
              Change mobile number
            </button>
            <Button
              variant="link"
              onClick={() => void send(true)}
              disabled={busy || cooldown > 0}
              className="h-auto p-0 text-xs font-semibold text-[#F45D2C]"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
            </Button>
          </div>
        </div>
      )}

      {onBack && (
        <button type="button" onClick={onBack} className="mt-4 w-full text-center text-xs font-medium text-slate-500 hover:text-slate-800 underline">
          {backLabel}
        </button>
      )}
    </div>
  );
}
