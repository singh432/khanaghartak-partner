import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { confirmPhoneVerification } from "@/lib/otp.functions";
import { Button } from "@/components/ui/button";

type Props = {
  phone: string;
  onVerified: () => void;
};

const WIDGET_ID = "36686d745256313731393737";
// Public widget token (safe for client). The MSG91 AuthKey stays server-side.
const TOKEN_AUTH = "560401T0Fc1eDo6a7e2ec1P1";
const SDK_SRC = "https://verify.msg91.com/otp-provider.js";
const RESEND_SECONDS = 10;

type Msg91Window = Window & {
  initSendOTP?: (config: Record<string, unknown>) => void;
  sendOtp?: (identifier: string, success: (d: unknown) => void, failure: (e: unknown) => void) => void;
  retryOtp?: (
    channel: string,
    success: (d: unknown) => void,
    failure: (e: unknown) => void,
    reqId?: string,
  ) => void;
  verifyOtp?: (
    otp: string,
    success: (d: unknown) => void,
    failure: (e: unknown) => void,
    reqId?: string,
  ) => void;
};

let sdkPromise: Promise<void> | null = null;

function loadMsg91(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const w = window as Msg91Window;
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const init = () => {
      try {
        w.initSendOTP?.({
          widgetId: WIDGET_ID,
          tokenAuth: TOKEN_AUTH,
          exposeMethods: true,
          success: () => {},
          failure: () => {},
        });
        resolve();
      } catch {
        reject(new Error("init failed"));
      }
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      if (w.initSendOTP) init();
      else existing.addEventListener("load", init, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = init;
    script.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

/** Extracts the MSG91 message/reqId string from a callback payload. */
function payloadMessage(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

/**
 * MSG91 returns the request id under different keys depending on SDK version
 * (`message`, `reqId`, `requestId`, `req_id`, or a nested `data`).
 */
function payloadReqId(data: unknown): string {
  if (typeof data === "string") return data;
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  for (const key of ["reqId", "requestId", "req_id", "message"]) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const nested = obj["data"];
  if (nested && nested !== data) return payloadReqId(nested);
  return "";
}

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
      await loadMsg91();
      const w = window as Msg91Window;
      await new Promise<void>((resolve, reject) => {
        const onSuccess = (data: unknown) => {
          // Keep the latest valid reqId; never clear it on an empty payload.
          rememberReqId(payloadReqId(data));
          resolve();
        };
        const onFailure = (err: unknown) => reject(new Error(payloadMessage(err) || "Could not send the code"));
        if (isRetry && reqIdRef.current && w.retryOtp) {
          w.retryOtp("11", onSuccess, onFailure, reqIdRef.current);
        } else if (w.sendOtp) {
          w.sendOtp(`91${digits}`, onSuccess, onFailure);
        } else {
          reject(new Error("Verification service is unavailable"));
        }
      });

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

  const verify = async () => {
    const otp = code.replace(/\D/g, "");
    if (otp.length !== 4) return toast.error("Enter the 4-digit code");
    if (verifying) return;
    setVerifying(true);
    try {
      await loadMsg91();
      const w = window as Msg91Window;
      const accessToken = await new Promise<string>((resolve, reject) => {
        if (!w.verifyOtp) return reject(new Error("Verification service is unavailable"));
        w.verifyOtp(
          otp,
          (data) => {
            const token = payloadMessage(data);
            token ? resolve(token) : reject(new Error("Incorrect code, please try again"));
          },
          (err) => reject(new Error(payloadMessage(err) || "Incorrect code, please try again")),
          reqIdRef.current || undefined,
        );
      });

      const res = await confirm({ data: { phone: digits, accessToken } });
      if (!res.ok) {
        toast.error(res.error ?? "Verification failed, please try again");
        setVerifying(false);
        return;
      }
      try {
        localStorage.removeItem(storeKey);
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
        <span>Verify this number once by SMS to confirm your order.</span>
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
            disabled={verifying}
            className="h-12 w-full font-bold"
          >
            {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
            Verify number
          </Button>
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
