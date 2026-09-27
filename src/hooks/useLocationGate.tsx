import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { isWithinServiceArea } from "@/lib/geo";
import { fetchActiveZones, zoneForPoint } from "@/lib/zones";
import { useAuth } from "@/hooks/useAuth";

type GateStatus = "idle" | "checking" | "allowed" | "denied" | "unsupported" | "outside_zone";

type Ctx = {
  status: GateStatus;
  coords: LatLng | null;
  distanceKm: number | null;
  request: () => void;
};

const LocationGateCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "kgt:user-coords";

function readCached(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat?: unknown; lng?: unknown; ts?: unknown };
    if (typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    // Re-prompt every 24h
    if (typeof parsed.ts === "number" && Date.now() - parsed.ts > 24 * 60 * 60 * 1000) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}

function writeCached(p: LatLng) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...p, ts: Date.now() }));
  } catch {
    /* noop */
  }
}

async function checkZone(p: LatLng): Promise<boolean> {
  if (isWithinServiceArea(p)) return true;
  try {
    const zones = await fetchActiveZones();
    if (zoneForPoint(p, zones)) return true;
  } catch {
    /* fallback to geo */
  }
  return false;
}

export function LocationGateProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GateStatus>("idle");
  const { user, loading: authLoading } = useAuth();

  const handleCoords = useCallback(async (p: LatLng) => {
    writeCached(p);
    setCoords(p);
    const inZone = await checkZone(p);
    setStatus(inZone ? "allowed" : "outside_zone");
  }, []);

  const request = useCallback(async () => {
    if (typeof window === "undefined") return;
    setStatus("checking");

    // Try native Capacitor GPS first if on mobile
    try {
      const { isNative, getNativePosition } = await import("@/lib/capacitor");
      if (isNative) {
        const nativePos = await getNativePosition();
        if (nativePos) {
          await handleCoords(nativePos);
          return;
        }
      }
    } catch {
      /* fallback to navigator */
    }

    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        await handleCoords(p);
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  }, [handleCoords]);

  useEffect(() => {
    if (authLoading || !user) {
      setStatus("idle");
      return;
    }
    const cached = readCached();
    if (cached) {
      void handleCoords(cached);
      return;
    }
    request();
  }, [authLoading, user, request, handleCoords]);

  return (
    <LocationGateCtx.Provider value={{ status, coords, distanceKm: null, request }}>
      {children}
    </LocationGateCtx.Provider>
  );
}

export function useLocationGate() {
  const ctx = useContext(LocationGateCtx);
  if (!ctx) throw new Error("useLocationGate must be used inside LocationGateProvider");
  return ctx;
}
