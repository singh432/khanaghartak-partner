import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { track } from "@/lib/analytics";

/**
 * Records page-level funnel steps on every client route change.
 * Each step is de-duplicated per visit, so mobile and desktop users are
 * counted once per step.
 */
export function AnalyticsTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });

  useEffect(() => {
    track("visit", { path: pathname });
    track("page_view", { path: pathname, item_id: pathname });

    if (pathname === "/menu" || pathname.startsWith("/menu/")) {
      track("menu_view", { path: pathname });
      const r = typeof search?.r === "string" ? search.r : null;
      if (r) track("product_view", { path: pathname, restaurant_id: r, item_id: r });
    }
    if (pathname === "/cart") track("cart_view", { path: pathname });
    if (pathname === "/checkout") track("begin_checkout", { path: pathname });
  }, [pathname, search]);

  return null;
}
