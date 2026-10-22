import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";
import { fetchActiveZones, zoneForPoint, type DeliveryZone } from "@/lib/zones";
import { useAuth } from "@/hooks/useAuth";

import { isPartnerApp } from "@/lib/capacitor";

type GateStatus = "idle" | "checking" | "allowed" | "denied" | "unsupported" | "outside_zone";

type Ctx = {
  status: GateStatus;
  coords: LatLng | null;
  zone: DeliveryZone | null;
  zoneId: string | null;
  activeZones: DeliveryZone[];
  distanceKm: number | null;
  request: () => void;
};

const LocationGateCtx = createContext<Ctx | null>(null);
const STORAGE_KEY = "kgt:user-coords";

function readCached(): LatLng | null {
  if (typeof window === "undefined") return null;
  try {
    if ((window as any).AndroidApp && typeof (window as any).AndroidApp.getDeviceCoordinates === "function") {
      try {
        const rawApp = (window as any).AndroidApp.getDeviceCoordinates();
        if (rawApp) {
          const parsedApp = JSON.parse(rawApp);
          if (typeof parsedApp.lat === "number" && typeof parsedApp.lng === "number") {
            return { lat: parsedApp.lat, lng: parsedApp.lng };
          }
        }
      } catch {}
    }
    const native = (window as any).__native_device_coords;
    if (native && typeof native.lat === "number" && typeof native.lng === "number") {
      return { lat: native.lat, lng: native.lng };
    }
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
  const [zone, setZone] = useState<DeliveryZone | null>(null);
  const [activeZones, setActiveZones] = useState<DeliveryZone[]>([]);
  const [status, setStatus] = useState<GateStatus>("idle");
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    fetchActiveZones().then(setActiveZones).catch(() => {});
  }, []);

  const handleCoords = useCallback(async (p: LatLng) => {
    writeCached(p);
    setCoords(p);
    let zones = activeZones;
    if (!zones || zones.length === 0) {
      zones = await fetchActiveZones().catch(() => []);
      setActiveZones(zones);
    }
    if (isPartnerApp()) {
      setStatus("allowed");
      const matched = zoneForPoint(p, zones);
      setZone(matched);
      return;
    }
    const matched = zoneForPoint(p, zones);
    if (matched) {
      setZone(matched);
      setStatus("allowed");
      try {
        localStorage.setItem("kgt:detected-zone-id", matched.id);
        localStorage.setItem("kgt:detected-zone-name", matched.name);
        window.dispatchEvent(new CustomEvent("kgt:zone-changed", { detail: matched }));
      } catch {}
    } else {
      setZone(null);
      setStatus("outside_zone");
      try {
        localStorage.removeItem("kgt:detected-zone-id");
        localStorage.removeItem("kgt:detected-zone-name");
        window.dispatchEvent(new CustomEvent("kgt:zone-changed", { detail: null }));
      } catch {}
    }
  }, [activeZones]);

  const request = useCallback(async () => {
    if (typeof window === "undefined") return;
    setStatus("checking");

    // Check if native coordinates are already available from MainActivity
    const native = (window as any).__native_device_coords;
    if (native && typeof native.lat === "number" && typeof native.lng === "number") {
      await handleCoords({ lat: native.lat, lng: native.lng });
      return;
    }

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

  // Listen to native coordinates updates from MainActivity
  useEffect(() => {
    const handleNativeCoords = (e?: any) => {
      let p: { lat: number; lng: number } | null = null;
      if (e && e.detail && typeof e.detail.lat === "number" && typeof e.detail.lng === "number") {
        p = { lat: e.detail.lat, lng: e.detail.lng };
      } else {
        const native = (window as any).__native_device_coords;
        if (native && typeof native.lat === "number" && typeof native.lng === "number") {
          p = { lat: native.lat, lng: native.lng };
        }
      }
      if (p) {
        void handleCoords(p);
      }
    };
    window.addEventListener("kgt:native-coords", handleNativeCoords);
    window.addEventListener("kgt:address-changed", handleNativeCoords);
    window.addEventListener("storage", handleNativeCoords);
    handleNativeCoords();
    return () => {
      window.removeEventListener("kgt:native-coords", handleNativeCoords);
      window.removeEventListener("kgt:address-changed", handleNativeCoords);
      window.removeEventListener("storage", handleNativeCoords);
    };
  }, [handleCoords]);

  useEffect(() => {
    if (authLoading || !user) {
      setStatus("idle");
      return;
    }
    const cached = readCached();
    if (cached) {
      void handleCoords(cached);
    }
    // Always request live location to detect whether customer moved or is in another zone
    request();
  }, [authLoading, user, request, handleCoords]);

  return (
    <LocationGateCtx.Provider value={{ status, coords, zone, zoneId: zone?.id ?? null, activeZones, distanceKm: null, request }}>
      {children}
    </LocationGateCtx.Provider>
  );
}

export function useLocationGate() {
  const ctx = useContext(LocationGateCtx);
  if (!ctx) throw new Error("useLocationGate must be used inside LocationGateProvider");
  return ctx;
}
