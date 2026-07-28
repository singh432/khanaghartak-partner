import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { distanceFromServiceCenterKm, SERVICE_RADIUS_KM, type LatLng } from "@/lib/geo";
import { useAuth } from "@/hooks/useAuth";

type GateStatus = "idle" | "checking" | "allowed" | "denied" | "out_of_range" | "unsupported";

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

export function LocationGateProvider({ children }: { children: React.ReactNode }) {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<GateStatus>("idle");
  const { user, loading: authLoading } = useAuth();

  const evaluate = useCallback((p: LatLng) => {
    const d = distanceFromServiceCenterKm(p);
    setCoords(p);
    setStatus(d <= SERVICE_RADIUS_KM ? "allowed" : "out_of_range");
  }, []);

  const request = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("checking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        writeCached(p);
        evaluate(p);
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
  }, [evaluate]);

  useEffect(() => {
    // Only check location AFTER the user is signed in.
    if (authLoading || !user) {
      setStatus("idle");
      return;
    }
    const cached = readCached();
    if (cached) {
      evaluate(cached);
      return;
    }
    request();
  }, [authLoading, user, evaluate, request]);

  const distanceKm = coords ? distanceFromServiceCenterKm(coords) : null;

  return (
    <LocationGateCtx.Provider value={{ status, coords, distanceKm, request }}>
      {children}
    </LocationGateCtx.Provider>
  );
}

export function useLocationGate() {
  const ctx = useContext(LocationGateCtx);
  if (!ctx) throw new Error("useLocationGate must be used inside LocationGateProvider");
  return ctx;
}
