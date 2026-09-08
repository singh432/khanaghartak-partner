import { useEffect, useState } from "react";

/**
 * Re-renders every `ms` (default 30s) and when the tab regains focus, so
 * time-derived UI (like automatic Open/Closed status from opening hours)
 * stays correct without a page refresh.
 */
export function useMinuteTick(ms = 30000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const t = setInterval(tick, ms);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, [ms]);

  return now;
}
