import { useEffect, useRef } from "react";
import type { ZonePoint } from "@/lib/zones";

/**
 * Client-only Leaflet polygon editor.
 * Click the map to add a boundary point, drag a marker to move it,
 * click a marker to remove it. No API key — OpenStreetMap tiles.
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
  const layersRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);
  const ptsRef = useRef<ZonePoint[]>(points);
  ptsRef.current = points;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !holder.current || mapRef.current) return;
      LRef.current = L;
      const start = center ?? ptsRef.current[0] ?? { lat: 25.1842, lng: 81.6212 };
      const map = L.map(holder.current).setView([start.lat, start.lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      map.on("click", (e: any) => {
        changeRef.current([...ptsRef.current, { lat: e.latlng.lat, lng: e.latlng.lng }]);
      });
      mapRef.current = map;
      redraw();
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redraw = () => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];
    const pts = ptsRef.current;

    if (pts.length >= 3) {
      const poly = L.polygon(pts.map((p) => [p.lat, p.lng]), {
        color: "#e23744",
        weight: 2,
        fillOpacity: 0.15,
      }).addTo(map);
      layersRef.current.push(poly);
    } else if (pts.length === 2) {
      const line = L.polyline(pts.map((p) => [p.lat, p.lng]), { color: "#e23744", dashArray: "4" }).addTo(map);
      layersRef.current.push(line);
    }

    pts.forEach((p, i) => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: "#e23744",
        fillOpacity: 1,
      }).addTo(map);
      m.bindTooltip(`Point ${i + 1} — click to remove`);
      m.on("click", (e: any) => {
        e.originalEvent?.stopPropagation?.();
        L.DomEvent.stop(e);
        changeRef.current(ptsRef.current.filter((_, idx) => idx !== i));
      });
      layersRef.current.push(m);
    });
  };

  useEffect(() => { redraw(); }, [points]);

  useEffect(() => {
    if (!mapRef.current || !center) return;
    mapRef.current.setView([center.lat, center.lng], mapRef.current.getZoom());
  }, [center?.lat, center?.lng]);

  return <div ref={holder} className="h-[380px] w-full overflow-hidden rounded-2xl border" />;
}
