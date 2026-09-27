import { supabase } from "@/integrations/supabase/client";

export type ZonePoint = { lat: number; lng: number };

export type DeliveryZone = {
  id: string;
  name: string;
  city: string | null;
  polygon: ZonePoint[];
  is_active: boolean;
  delivery_charge: number | null;
};

export const OUTSIDE_ZONE_MESSAGE = "Sorry, we don't deliver to this location yet.";

/** Ray-casting point-in-polygon. Mirrors public.point_in_polygon in SQL. */
export function pointInPolygon(p: ZonePoint, polygon: ZonePoint[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    if (yj === yi) continue;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function zoneForPoint(p: ZonePoint, zones: DeliveryZone[]): DeliveryZone | null {
  return zones.find((z) => z.is_active && pointInPolygon(p, z.polygon)) ?? null;
}

function normalise(rows: any[]): DeliveryZone[] {
  return (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city ?? null,
    polygon: Array.isArray(r.polygon)
      ? r.polygon
          .filter((pt: any) => typeof pt?.lat === "number" && typeof pt?.lng === "number")
          .map((pt: any) => ({ lat: pt.lat, lng: pt.lng }))
      : [],
    is_active: !!r.is_active,
    delivery_charge: r.delivery_charge === null || r.delivery_charge === undefined ? null : Number(r.delivery_charge),
  }));
}

export async function fetchActiveZones(): Promise<DeliveryZone[]> {
  const { data } = await (supabase.from("delivery_zones") as any)
    .select("id,name,city,polygon,is_active,delivery_charge")
    .eq("is_active", true);
  return normalise(data ?? []);
}

export async function fetchAllZones(): Promise<DeliveryZone[]> {
  const { data } = await (supabase.from("delivery_zones") as any)
    .select("id,name,city,polygon,is_active,delivery_charge")
    .order("name");
  return normalise(data ?? []);
}

const SHANKARGARH_IN_KEYWORDS = [
  "shankargarh",
  "shankergarh",
  "212108",
  "raja market",
  "station road",
  "bara road",
  "lalita nagar",
  "main bazaar",
];

const OUTSIDE_KEYWORDS = [
  "rewa",
  "civil lines",
  "katra",
  "naini",
  "lucknow",
  "kanpur",
  "delhi",
  "noida",
  "gurugram",
  "gurgaon",
  "varanasi",
  "satna",
  "jabalpur",
  "banda",
  "chitrakoot",
  "mirzapur",
  "jaunpur",
  "fatehpur",
];

/**
 * Authoritative check to determine if a delivery location is within KhanaGharTak service zone.
 * If neither coordinates nor a recognized in-zone address is available, returns false.
 */
export function isLocationInServiceZone(
  coords: { lat: number; lng: number } | null | undefined,
  address: string | null | undefined,
  activeZones: DeliveryZone[] = []
): boolean {
  // 1. If explicit coordinates are available:
  if (coords && typeof coords.lat === "number" && typeof coords.lng === "number" && !isNaN(coords.lat) && !isNaN(coords.lng)) {
    // Haversine check to Shankargarh center (25.1842, 81.6212) <= 10km
    const R = 6371.0;
    const dLat = ((coords.lat - 25.1842) * Math.PI) / 180;
    const dLng = ((coords.lng - 81.6212) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((25.1842 * Math.PI) / 180) *
        Math.cos((coords.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    if (dist <= 10.0) return true;

    // Active polygon delivery zones check
    if (activeZones.length > 0 && zoneForPoint(coords, activeZones) != null) {
      return true;
    }
    // Coordinates are outside all supported zones
    return false;
  }

  // 2. If address text is provided without coordinates:
  if (address && address.trim().length > 0) {
    const s = address.toLowerCase().trim();
    const matchesOutside = OUTSIDE_KEYWORDS.some((kw) => s.includes(kw));
    const matchesInside = SHANKARGARH_IN_KEYWORDS.some((kw) => s.includes(kw));

    if (matchesInside && !s.includes("rewa") && !s.includes("civil lines")) {
      return true;
    }
    if (matchesOutside) {
      return false;
    }
    // Unrecognized address with no coordinates: do NOT assume inside zone
    return false;
  }

  // 3. No address and no coordinates
  return false;
}
