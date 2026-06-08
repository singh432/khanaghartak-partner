import { useRouterState } from "@tanstack/react-router";
import { Loader2, MapPin } from "lucide-react";
import { useLocationGate } from "@/hooks/useLocationGate";
import { SERVICE_RADIUS_KM } from "@/lib/geo";

// Routes that the gate guards. Other routes (landing, login, admin, super, rider)
// are reachable regardless of customer location.
const GUARDED_PREFIXES = ["/home", "/menu", "/cart", "/checkout", "/orders", "/order"];

export function LocationGate({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { status, distanceKm, request } = useLocationGate();

  const guarded = GUARDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!guarded) return <>{children}</>;

  if (status === "checking") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking your location…</p>
      </div>
    );
  }

  if (status === "allowed") return <>{children}</>;

  const heading =
    status === "out_of_range"
      ? "Not serving in your area yet"
      : status === "unsupported"
        ? "Location not supported"
        : "Location permission needed";

  const body =
    status === "out_of_range"
      ? `KhanaGharTak is currently only available within a ${SERVICE_RADIUS_KM}km radius of Shankargarh.`
      : `KhanaGharTak is currently only available within a ${SERVICE_RADIUS_KM}km radius of Shankargarh. Please allow location access so we can confirm you're inside our serving area.`;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-10">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-primary/10 text-primary">
          <MapPin className="h-8 w-8" />
        </div>
        <h1 className="font-display text-3xl leading-tight tracking-tight">{heading}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{body}</p>
        {status === "out_of_range" && distanceKm !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            You're approximately {distanceKm.toFixed(1)} km away from Shankargarh.
          </p>
        )}
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={request}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            {status === "denied" ? "Try location again" : "Recheck my location"}
          </button>
          <a href="/" className="text-xs font-semibold text-muted-foreground underline">
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
