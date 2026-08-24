import { supabase } from "@/integrations/supabase/client";

/** Ordered customer conversion funnel steps. */
export const FUNNEL_STEPS = [
  { event: "visit", label: "Website Visit" },
  { event: "menu_view", label: "Menu View" },
  { event: "product_view", label: "Product View" },
  { event: "add_to_cart", label: "Add to Cart" },
  { event: "cart_view", label: "Cart View" },
  { event: "begin_checkout", label: "Begin Checkout" },
  { event: "checkout_started", label: "Checkout Started" },
  { event: "payment_started", label: "Payment Started" },
  { event: "payment_success", label: "Payment Successful" },
  { event: "order_placed", label: "Order Placed" },
] as const;

export type FunnelEvent = (typeof FUNNEL_STEPS)[number]["event"] | "page_view";

const SESSION_KEY = "kgt_analytics_session";
const SENT_KEY = "kgt_analytics_sent";

function uuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

/** Stable per-visit id (30 min idle window) so events are attributable and de-duplicated. */
export function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; ts: number };
      if (parsed?.id && now - parsed.ts < 30 * 60 * 1000) {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ id: parsed.id, ts: now }));
        return parsed.id;
      }
    }
    const id = uuid();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, ts: now }));
    localStorage.removeItem(SENT_KEY);
    return id;
  } catch {
    return "anon";
  }
}

function deviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

/** Local guard so a re-render or fast navigation can never double-count a step. */
function alreadySent(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const set = new Set<string>(JSON.parse(localStorage.getItem(SENT_KEY) || "[]"));
    if (set.has(key)) return true;
    set.add(key);
    localStorage.setItem(SENT_KEY, JSON.stringify([...set].slice(-400)));
    return false;
  } catch {
    return false;
  }
}

type TrackOpts = {
  path?: string;
  restaurant_id?: string | null;
  item_id?: string | null;
  order_id?: string | null;
  value?: number | null;
  meta?: Record<string, unknown>;
  /** allow the same step more than once in a session */
  repeatable?: boolean;
};

/** Fire-and-forget funnel event. Never throws, never blocks the UI. */
export function track(event: FunnelEvent, opts: TrackOpts = {}): void {
  if (typeof window === "undefined") return;
  const sid = sessionId();
  const key = `${sid}|${event}|${opts.item_id ?? ""}|${opts.order_id ?? ""}`;
  if (!opts.repeatable && alreadySent(key)) return;

  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      await supabase.from("analytics_events").insert({
        event,
        session_id: sid,
        user_id: data.session?.user?.id ?? null,
        path: opts.path ?? window.location.pathname,
        device: deviceType(),
        restaurant_id: opts.restaurant_id ?? null,
        item_id: opts.item_id ?? null,
        order_id: opts.order_id ?? null,
        value: opts.value ?? null,
        meta: (opts.meta ?? {}) as never,
      });
    } catch {
      /* analytics must never break the app */
    }
  })();
}
