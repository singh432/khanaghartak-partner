import { useEffect, useRef, useState } from "react";
import type { ZonePoint } from "@/lib/zones";
import { loadGoogleMaps } from "@/lib/google-maps";

/**
 * Client-only Google Maps polygon editor.
 * Full Google detail (roads, villages, shops, landmarks) + place search.
 * Click the map to add a boundary point, drag a point to move it,
 * click a point to remove it.
 */
export default function ZoneMapEditor({
  points,
  onChange,
  center,
}: {
  points: ZonePoint[];
  onChange: (pts: ZonePoint[]) => void;
  center?: ZonePoint;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const gRef = useRef<any>(null);
  const polyRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const ptsRef = useRef<ZonePoint[]>(points);
  ptsRef.current = points;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; placeId: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !holder.current || mapRef.current) return;
        gRef.current = g;
        const start = center ?? ptsRef.current[0] ?? { lat: 25.1842, lng: 81.6212 };
        const map = new g.maps.Map(holder.current, {
          center: start,
          zoom: 14,
          mapTypeId: "roadmap",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        map.addListener("click", (e: any) => {
          if (!e.latLng) return;
          changeRef.current([...ptsRef.current, { lat: e.latLng.lat(), lng: e.latLng.lng() }]);
        });
        mapRef.current = map;
        redraw();
      } catch (e: any) {
        setError(e?.message ?? "Map could not load");
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redraw = () => {
    const g = gRef.current;
    const map = mapRef.current;
    if (!g || !map) return;
    const pts = ptsRef.current;

    markersRef.current.forEach((m) => (m.map ? (m.map = null) : m.setMap(null)));
    markersRef.current = [];

    if (polyRef.current) polyRef.current.setMap(null);
    polyRef.current = null;

    if (pts.length >= 2) {
      const opts = {
        path: pts,
        strokeColor: "#e23744",
        strokeWeight: 2,
        fillColor: "#e23744",
        fillOpacity: 0.15,
        map,
        clickable: false,
      };
      polyRef.current = pts.length >= 3 ? new g.maps.Polygon(opts) : new g.maps.Polyline(opts);
    }

    pts.forEach((p, i) => {
      const marker = new g.maps.Marker({
        position: p,
        map,
        draggable: true,
        title: `Point ${i + 1} — click to remove, drag to move`,
        label: { text: String(i + 1), color: "#fff", fontSize: "11px" },
      });
      marker.addListener("click", () => {
        changeRef.current(ptsRef.current.filter((_, idx) => idx !== i));
      });
      marker.addListener("dragend", (e: any) => {
        const next = ptsRef.current.slice();
        next[i] = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        changeRef.current(next);
      });
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.setCenter(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setMapTypeId(mapType);
  }, [mapType]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const g = gRef.current;
    if (!g || !query.trim()) return;
    setSearching(true);
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = (await g.maps.importLibrary(
        "places",
      )) as any;
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query.trim(),
        sessionToken: new AutocompleteSessionToken(),
        region: "in",
      });
      setResults(
        (suggestions ?? [])
          .map((s: any) => s.placePrediction)
          .filter(Boolean)
          .map((p: any) => ({ label: p.text?.text ?? "", placeId: p.placeId })),
      );
    } catch {
      setError("Search is unavailable right now");
    } finally {
      setSearching(false);
    }
  };

  const goTo = async (placeId: string, label: string) => {
    const g = gRef.current;
    if (!g) return;
    const { Place } = (await g.maps.importLibrary("places")) as any;
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: ["location"] });
    if (place.location && mapRef.current) {
      mapRef.current.setCenter(place.location);
      mapRef.current.setZoom(16);
    }
    setResults([]);
    setQuery(label);
  };

  return (
    <div className="space-y-2">
      <form onSubmit={search} className="relative flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a village, area or landmark…"
          className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={searching}
          className="h-10 rounded-xl bg-secondary px-4 text-xs font-semibold"
        >
          {searching ? "Searching…" : "Search"}
        </button>
        <button
          type="button"
          onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")}
          className="h-10 rounded-xl bg-secondary px-4 text-xs font-semibold"
        >
          {mapType === "roadmap" ? "Satellite" : "Map"}
        </button>
        {results.length > 0 && (
          <ul className="absolute left-0 right-0 top-11 z-[500] max-h-60 overflow-auto rounded-xl border bg-card shadow-lg">
            {results.map((r) => (
              <li key={r.placeId}>
                <button
                  type="button"
                  onClick={() => goTo(r.placeId, r.label)}
                  className="block w-full px-3 py-2 text-left text-xs hover:bg-secondary"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <div ref={holder} className="h-[420px] w-full overflow-hidden rounded-2xl border" />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
