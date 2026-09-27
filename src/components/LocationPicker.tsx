import { useEffect, useRef, useState } from "react";
import { Loader2, Search, Navigation, Check } from "lucide-react";
import type { LatLng } from "@/lib/geo";

const DEFAULT_CENTER: LatLng = { lat: 25.1842, lng: 81.6212 };

type Suggestion = { label: string; lat: number; lng: number };

/**
 * Client-only map location picker (Leaflet + OpenStreetMap).
 * Search a place or drag the pin, then confirm.
 */
export default function LocationPicker({
  value,
  onConfirm,
  onCancel,
}: {
  value?: LatLng | null;
  onConfirm: (p: LatLng, label?: string) => void;
  onCancel: () => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [picked, setPicked] = useState<LatLng>(value ?? DEFAULT_CENTER);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !holder.current || mapRef.current) return;
      const start = value ?? DEFAULT_CENTER;
      const map = L.map(holder.current).setView([start.lat, start.lng], value ? 16 : 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:22px;height:22px;border-radius:50%;background:#e23744;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      const marker = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        setPicked({ lat: ll.lat, lng: ll.lng });
        setLabel(undefined);
      });
      map.on("click", (e: any) => {
        marker.setLatLng(e.latlng);
        setPicked({ lat: e.latlng.lat, lng: e.latlng.lng });
        setLabel(undefined);
      });
      mapRef.current = map;
      markerRef.current = marker;
      setTimeout(() => map.invalidateSize(), 120);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveTo = (p: LatLng, zoom = 17) => {
    setPicked(p);
    markerRef.current?.setLatLng([p.lat, p.lng]);
    mapRef.current?.setView([p.lat, p.lng], zoom);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (q.length < 3) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      const json = (await res.json()) as any[];
      setResults(
        (json ?? []).map((r) => ({ label: r.display_name as string, lat: Number(r.lat), lng: Number(r.lon) })),
      );
    } catch {
      setResults([]);
    }
    setSearching(false);
  };

  const useGps = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => moveTo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
      <div className="flex h-[85vh] w-full max-w-[480px] flex-col rounded-t-2xl bg-background">
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center gap-2 rounded-xl border bg-input px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                className="h-10 flex-1 bg-transparent text-sm outline-none"
                placeholder="Search your area, street or landmark"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runSearch()}
              />
              {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <button onClick={runSearch} className="h-10 rounded-xl bg-secondary px-3 text-sm font-semibold">
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-xl border">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    moveTo({ lat: r.lat, lng: r.lng });
                    setLabel(r.label);
                    setResults([]);
                    setQuery(r.label);
                  }}
                  className="block w-full border-b px-3 py-2 text-left text-xs last:border-0"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div ref={holder} className="flex-1" />

        <div className="space-y-2 border-t p-3">
          <button
            onClick={useGps}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-accent/40 py-2.5 text-xs font-semibold text-primary"
          >
            <Navigation className="h-4 w-4" /> Move pin to my current location (optional)
          </button>
          <p className="text-center text-[11px] text-muted-foreground">
            Drag the pin to your exact door · {picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="h-11 flex-1 rounded-xl border-2 text-sm font-semibold">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(picked, label)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground"
            >
              <Check className="h-4 w-4" /> Confirm location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
