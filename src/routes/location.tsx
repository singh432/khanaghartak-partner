import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFormDraft } from "@/hooks/useFormDraft";

import { BrandHeader } from "@/components/BrandHeader";
import { MapPin, Navigation, Loader2, CheckCircle2, AlertCircle, Map, Search, X } from "lucide-react";
import { isPartnerApp } from "@/lib/capacitor";
import { fetchActiveZones, zoneForPoint, resolveCustomerZone, isLocationInServiceZone, CHAKGHAT_CENTER, SHANKARGARH_CENTER, type DeliveryZone } from "@/lib/zones";
import { isWithinServiceArea, SERVICE_CENTER, type LatLng } from "@/lib/geo";

// Dynamically load the map picker
const LocationPicker = lazy(() => import("@/components/LocationPicker"));

export const Route = createFileRoute("/location")({
  component: LocationPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Delivery Location — KhanaGharTak" },
      { name: "description", content: "Set your delivery address and pin your exact location for KhanaGharTak deliveries." },
      { property: "og:title", content: "Delivery Location — KhanaGharTak" },
      { property: "og:description", content: "Set your delivery address and pin your exact location for KhanaGharTak deliveries." },
      { property: "og:url", content: "https://khanaghartak.in/location" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/location" }],
  }),
});

const schema = z.object({
  address: z.string().trim().min(3, "Enter a valid delivery address").max(300),
  landmark: z.string().trim().max(120).optional(),
});

type PlaceSuggestion = {
  label: string;
  lat: number;
  lng: number;
};

function LocationPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Address search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PlaceSuggestion[]>([]);

  const [activeZones, setActiveZones] = useState<DeliveryZone[]>([]);
  const [zoneStatus, setZoneStatus] = useState<"supported" | "unsupported" | null>(null);
  const [detectedZoneName, setDetectedZoneName] = useState<string>("");

  const draftKey = user ? `kgt-draft-location-${user.id}` : null;
  const clearDraft = useFormDraft(
    draftKey,
    { address, landmark, coords },
    (d) => {
      if (d.address) setAddress(d.address);
      if (d.landmark) setLandmark(d.landmark);
      if (d.coords) setCoords(d.coords);
    },
  );

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { as: "customer" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchActiveZones().then(setActiveZones).catch(() => {});
  }, []);

  // Initialize from profile or localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const localAddr = localStorage.getItem("kgt:delivery-address");
      if (localAddr) setAddress((c) => c || localAddr);
      try {
        const raw = localStorage.getItem("kgt:user-coords");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            setCoords((c) => c ?? { lat: parsed.lat, lng: parsed.lng });
          }
        }
      } catch {}
    }

    if (user) {
      supabase.from("profiles").select("address, landmark, latitude, longitude")
        .eq("id", user.id).maybeSingle()
        .then(({ data }) => {
          if (data) {
            if (data.address) setAddress((cur) => cur || data.address || "");
            if (data.landmark) setLandmark((cur) => cur || data.landmark || "");
            if (data.latitude && data.longitude) {
              setCoords((cur) => cur ?? { lat: data.latitude!, lng: data.longitude! });
            }
          }
        });
    }
  }, [user]);

  // Evaluate serviceability live whenever coords or address change
  useEffect(() => {
    if (!coords && !address) {
      setZoneStatus(null);
      return;
    }
    const z = resolveCustomerZone(coords, address, activeZones);
    const inService = isLocationInServiceZone(coords, address, activeZones);
    if (inService || isPartnerApp() || z) {
      setZoneStatus("supported");
      setDetectedZoneName(z?.name ?? "KhanaGharTak Active Zone");
    } else {
      setZoneStatus("unsupported");
      setDetectedZoneName("");
    }
  }, [coords, address, activeZones]);

  // Reverse geocode lat/lng to readable address
  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
        return data.display_name;
      }
    } catch {
      // ignore
    }
    return null;
  };

  // A) Use current GPS location
  const detectLocation = async () => {
    setLocating(true);

    const applyPos = async (p: { lat: number; lng: number }) => {
      setCoords(p);
      const resolvedAddr = await reverseGeocode(p.lat, p.lng);
      const checkAddr = resolvedAddr || address;
      const inService = isLocationInServiceZone(p, checkAddr, activeZones);
      if (inService || isPartnerApp()) {
        toast.success("Location pinned inside active delivery zone");
      } else {
        toast.warning("Pinned location is outside our active delivery area");
      }
      setLocating(false);
    };

    // 1. Check if fresh native bridge coordinates are already available (< 30s old)
    try {
      let nativeCoords: { lat: number; lng: number } | null = null;
      if (typeof window !== "undefined") {
        const androidApp = (window as any).AndroidApp;
        if (androidApp && typeof androidApp.getDeviceCoordinates === "function") {
          const raw = androidApp.getDeviceCoordinates();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.lat === "number" && typeof parsed?.lng === "number" && (!parsed?.ts || Date.now() - parsed.ts < 30000)) {
              nativeCoords = { lat: parsed.lat, lng: parsed.lng };
            }
          }
        }
        if (!nativeCoords && (window as any).__native_device_coords) {
          const c = (window as any).__native_device_coords;
          if (typeof c.lat === "number" && typeof c.lng === "number" && (!c?.ts || Date.now() - c.ts < 30000)) {
            nativeCoords = { lat: c.lat, lng: c.lng };
          }
        }
      }

      if (nativeCoords) {
        await applyPos(nativeCoords);
        return;
      }
    } catch {
      // Continue to fresh location
    }

    // Trigger native location refresh if running in Android app
    try {
      (window as any).AndroidApp?.refreshLocation?.();
    } catch {}

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocating(false);
      return toast.error("Geolocation is not supported by your device");
    }

    // Request current location (routed through FusedLocationProvider in Android app)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        // Check if native coordinates arrived
        const native = (window as any).__native_device_coords;
        if (native && typeof native.lat === "number" && typeof native.lng === "number") {
          void applyPos({ lat: native.lat, lng: native.lng });
          return;
        }
        setLocating(false);
        if (err.code === 1) {
          toast.error("Location permission denied. Please allow location access in device settings.");
        } else {
          toast.info("Could not detect exact location. Please search your area or select on the map.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 }
    );
  };

  // B) Search address / place via OpenStreetMap
  const handleSearchPlaces = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } }
      );
      const data = await res.json();
      if (Array.isArray(data)) {
        setSearchResults(
          data.map((item: any) => ({
            label: item.display_name,
            lat: Number(item.lat),
            lng: Number(item.lon),
          }))
        );
      }
    } catch {
      setSearchResults([]);
      toast.error("Could not search location. Please check your internet connection.");
    }
    setSearching(false);
  };

  const selectSearchResult = (item: PlaceSuggestion) => {
    setAddress(item.label);
    setCoords({ lat: item.lat, lng: item.lng });
    setSearchResults([]);
    setSearchQuery("");
    toast.success("Location selected: " + item.label.split(",")[0]);
  };

  // C) Choose location on map confirm
  const handleMapConfirm = (p: LatLng, label?: string) => {
    setCoords(p);
    if (label) {
      setAddress(label);
    } else {
      void reverseGeocode(p.lat, p.lng);
    }
    setShowMapModal(false);
    toast.success("Map pin updated");
  };


  // Save / Confirm Location
  const save = async () => {
    const parsed = schema.safeParse({ address, landmark });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;

    let targetCoords = coords;

    // If user typed an address manually without picking on map/GPS, geocode it
    if (!targetCoords && address.trim()) {
      setSaving(true);
      const lower = address.toLowerCase();
      if (
        lower.includes("chakghat") ||
        lower.includes("chak ghat") ||
        lower.includes("486226") ||
        lower.includes("teonthar")
      ) {
        targetCoords = CHAKGHAT_CENTER;
      } else if (
        lower.includes("shankargarh") ||
        lower.includes("shankergarh") ||
        lower.includes("raja market") ||
        lower.includes("212108")
      ) {
        targetCoords = SHANKARGARH_CENTER;
      } else {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(address)}`,
            { headers: { Accept: "application/json" } }
          );
          const json = await res.json();
          if (Array.isArray(json) && json[0]) {
            targetCoords = { lat: Number(json[0].lat), lng: Number(json[0].lon) };
          }
        } catch {}
      }
      setSaving(false);
    }

    // Default fallback to center only if completely unresolved
    if (!targetCoords) {
      const lower = address.toLowerCase();
      if (lower.includes("chakghat") || lower.includes("chak ghat") || lower.includes("486226") || lower.includes("teonthar")) {
        targetCoords = CHAKGHAT_CENTER;
      } else {
        targetCoords = SHANKARGARH_CENTER;
      }
    }

    setSaving(true);

    // Save profile with the EXACT chosen latitude and longitude (e.g. Rewa or Shankargarh)
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      address,
      landmark: landmark || null,
      latitude: targetCoords.lat,
      longitude: targetCoords.lng,
    }, { onConflict: "id" });

    setSaving(false);

    if (error) return toast.error(error.message);

    try {
      localStorage.setItem("kgt:delivery-address", address);
      localStorage.setItem("kgt:user-coords", JSON.stringify({ lat: targetCoords.lat, lng: targetCoords.lng, ts: Date.now() }));
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("kgt:address-changed"));
    } catch {}

    clearDraft();
    toast.success("Delivery address saved successfully");
    navigate({ to: "/home" });
  };

  return (
    <div className="pb-28 bg-background min-h-screen">
      <BrandHeader subtitle="Delivery location" />

      <div className="px-4 pt-4 max-w-lg mx-auto">
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Select Delivery Location</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose on map, use current location, or search your address.
        </p>

        {/* Action Row: A) Use Current GPS & C) Choose on Map */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={detectLocation}
            disabled={locating}
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/30 py-3 text-xs font-bold text-primary transition active:scale-98 disabled:opacity-50"
          >
            {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            Current Location
          </button>

          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 py-3 text-xs font-bold text-primary shadow-sm transition active:scale-98"
          >
            <Map className="h-4 w-4" />
            Choose on Map
          </button>
        </div>

        {/* B) Search / Enter Address Input */}
        <div className="mt-4">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Search Area, City, Street or Landmark
          </label>
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchPlaces()}
              placeholder="e.g. Rewa, Shankargarh, Prayagraj, Civil Lines..."
              className="h-11 w-full rounded-2xl border border-border/80 bg-card pl-10 pr-20 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-14 grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={handleSearchPlaces}
              disabled={searching || searchQuery.trim().length < 2}
              className="absolute right-2 rounded-xl bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm active:scale-95 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Find"}
            </button>
          </div>

          {/* Search suggestions dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-2 divide-y divide-border/60 rounded-2xl border border-border/80 bg-card shadow-lg overflow-hidden">
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectSearchResult(item)}
                  className="flex w-full items-start gap-2.5 p-3 text-left hover:bg-accent/40 transition active:bg-accent"
                >
                  <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground leading-tight">{item.label.split(",")[0]}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.label}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live Service Zone Status Feedback */}
        {zoneStatus === "supported" && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-success/10 p-3 text-xs font-bold text-success border border-success/20">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Serviceable zone: {detectedZoneName || "Active Delivery Zone (Shankargarh & Chakghat)"}. Fast delivery available!</span>
          </div>
        )}

        {zoneStatus === "unsupported" && (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-1.5 font-extrabold">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>Outside Active Delivery Area</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
              KhanaGharTak is currently delivering in Shankargarh, Chakghat and nearby active zones. You can still save this location to check availability.
            </p>
          </div>
        )}

        {/* Full Delivery Address & Landmark form */}
        <div className="mt-5 space-y-3.5">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Full Delivery Address</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="House/Flat/Shop no., street, locality, city, pincode"
              className="w-full rounded-2xl border border-border/80 bg-card p-3 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-muted-foreground">Landmark (Optional)</span>
            <input
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              maxLength={120}
              placeholder="Near temple, hospital, railway station, main market..."
              className="h-11 w-full rounded-2xl border border-border/80 bg-card px-3.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
            />
          </label>
        </div>

        {/* Pinned Coordinates info */}
        {coords && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>Pinned: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowMapModal(true)}
              className="font-bold text-primary hover:underline"
            >
              Adjust Pin
            </button>
          </div>
        )}
      </div>

      {/* Sticky Bottom Save Button */}
      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur-sm p-4 z-20">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={save}
            disabled={saving || !address.trim()}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-extrabold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-98 disabled:opacity-50"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Delivery Location
          </button>
        </div>
      </div>

      {/* Interactive Map Picker Modal */}
      {showMapModal && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="flex items-center gap-2 rounded-2xl bg-card p-4 text-sm font-bold shadow-lg">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Loading map…
              </div>
            </div>
          }
        >
          <LocationPicker
            value={coords}
            onConfirm={handleMapConfirm}
            onCancel={() => setShowMapModal(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
