import "./lib/ssr-storage-polyfill";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  if (typeof window !== "undefined") {
    (window as any).__kgt_router = router;
    (window as any).__kgt_navigate_to_order = (role: string, orderId: string) => {
      let targetPath = "/admin/orders";
      if (role === "rider") targetPath = "/rider";
      else if (role === "zone_manager" || role === "manager") targetPath = "/zone";

      const cleanId = orderId ? orderId.trim() : "";
      const search = cleanId ? { orderId: cleanId } : {};

      // If already on the screen, check if the screen's order opener can handle it directly
      const curPath = window.location.pathname;
      if (curPath === targetPath) {
        if (targetPath === "/zone" && typeof (window as any).__kgt_open_zone_order === "function") {
          if ((window as any).__kgt_open_zone_order(cleanId)) return;
        } else if (targetPath === "/admin/orders" && typeof (window as any).__kgt_open_partner_order === "function") {
          if ((window as any).__kgt_open_partner_order(cleanId)) return;
        } else if (targetPath === "/rider" && typeof (window as any).__kgt_open_rider_order === "function") {
          if ((window as any).__kgt_open_rider_order(cleanId)) return;
        }
      }

      try {
        router.navigate({ to: targetPath as any, search: search as any, replace: false });
      } catch (e) {
        try {
          const finalUrl = targetPath + (cleanId ? "?orderId=" + encodeURIComponent(cleanId) : "");
          window.history.pushState(null, "", finalUrl);
          window.dispatchEvent(new PopStateEvent("popstate"));
        } catch (err) {}
      }
    };
  }

  return router;
};
