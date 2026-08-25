// Shared MSG91 OTP widget helpers (client-side).
// The MSG91 AuthKey is never exposed here — only the public widget token.

const WIDGET_ID = "36686d745256313731393737";
const TOKEN_AUTH = "560401T0Fc1eDo6a7e2ec1P1";
const SDK_SRC = "https://verify.msg91.com/otp-provider.js";
export const RESEND_SECONDS = 10;

type Msg91Window = Window & {
  initSendOTP?: (config: Record<string, unknown>) => void;
  sendOtp?: (identifier: string, success: (d: unknown) => void, failure: (e: unknown) => void) => void;
  retryOtp?: (channel: string, success: (d: unknown) => void, failure: (e: unknown) => void, reqId?: string) => void;
  verifyOtp?: (otp: string, success: (d: unknown) => void, failure: (e: unknown) => void, reqId?: string) => void;
};

let sdkPromise: Promise<void> | null = null;

export function loadMsg91(): Promise<void> {
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
        // initSendOTP exposes sendOtp/verifyOtp asynchronously (after the
        // widget config request finishes) — wait for them before resolving.
        let waited = 0;
        const waitForMethods = () => {
          if (w.sendOtp && w.verifyOtp) return resolve();
          waited += 100;
          if (waited >= 15000) return reject(new Error("Verification service is unavailable"));
          setTimeout(waitForMethods, 100);
        };
        waitForMethods();
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
  }).catch((err: unknown) => {
    sdkPromise = null; // allow a retry on the next attempt
    throw err;
  });
  return sdkPromise;
}

/** Extracts the MSG91 message/token string from a callback payload. */
export function payloadMessage(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const msg = (data as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

/** MSG91 returns the request id under different keys depending on SDK version. */
export function payloadReqId(data: unknown): string {
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

/** Sends (or resends) an SMS OTP. Resolves with the MSG91 request id. */
export async function sendSmsOtp(digits: string, retryReqId?: string): Promise<string> {
  await loadMsg91();
  const w = window as Msg91Window;
  return new Promise<string>((resolve, reject) => {
    const onSuccess = (data: unknown) => resolve(payloadReqId(data));
    const onFailure = (err: unknown) => reject(new Error(payloadMessage(err) || "Could not send the code"));
    if (retryReqId && w.retryOtp) w.retryOtp("11", onSuccess, onFailure, retryReqId);
    else if (w.sendOtp) w.sendOtp(`91${digits}`, onSuccess, onFailure);
    else reject(new Error("Verification service is unavailable"));
  });
}

/** Verifies the SMS code with MSG91 and resolves with the access token. */
export async function verifySmsOtp(otp: string, reqId: string): Promise<string> {
  await loadMsg91();
  const w = window as Msg91Window;
  return new Promise<string>((resolve, reject) => {
    if (!w.verifyOtp) return reject(new Error("Verification service is unavailable"));
    w.verifyOtp(
      otp,
      (data) => {
        const token = payloadMessage(data);
        token ? resolve(token) : reject(new Error("Incorrect code, please try again"));
      },
      (err) => reject(new Error(payloadMessage(err) || "Incorrect code, please try again")),
      reqId,
    );
  });
}
