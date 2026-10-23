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

export function haversineDistanceKm(a: ZonePoint, b: ZonePoint): number {
  const R = 6371.0;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const SHANKARGARH_CENTER = { lat: 25.1842, lng: 81.6212 };
export const SHANKARGARH_RADIUS_KM = 12.0;

export const CHAKGHAT_CENTER = { lat: 25.0275, lng: 81.7375 };
export const CHAKGHAT_RADIUS_KM = 15.0;

export function zoneForPoint(p: ZonePoint, zones: DeliveryZone[]): DeliveryZone | null {
  if (!p || typeof p.lat !== "number" || typeof p.lng !== "number" || isNaN(p.lat) || isNaN(p.lng)) return null;
  if (!zones || zones.length === 0) return null;

  // 1. Strict point-in-polygon match (authoritative)
  const directMatch = zones.find((z) => z.is_active && pointInPolygon(p, z.polygon));
  if (directMatch) return directMatch;

  // 2. Measure closest distance to EACH active zone
  let bestZone: DeliveryZone | null = null;
  let minDistance = Infinity;

  for (const z of zones) {
    if (!z.is_active || !z.polygon || z.polygon.length === 0) continue;
    let dZone = Infinity;
    for (const pt of z.polygon) {
      const d = haversineDistanceKm(p, pt);
      if (d < dZone) dZone = d;
    }
    const centerLat = z.polygon.reduce((acc, pt) => acc + pt.lat, 0) / z.polygon.length;
    const centerLng = z.polygon.reduce((acc, pt) => acc + pt.lng, 0) / z.polygon.length;
    const dCentroid = haversineDistanceKm(p, { lat: centerLat, lng: centerLng });
    const effDist = Math.min(dZone, dCentroid);

    if (effDist < minDistance) {
      minDistance = effDist;
      bestZone = z;
    }
  }

  // If closest zone boundary is within 6km buffer (e.g. edge of town or GPS drift), assign to that zone
  if (bestZone && minDistance <= 6.0) {
    return bestZone;
  }

  // 3. Proximity check to known operational centers (with strict comparison so closest wins)
  const dChakghat = haversineDistanceKm(p, CHAKGHAT_CENTER);
  const dShankar = haversineDistanceKm(p, SHANKARGARH_CENTER);

  if (dChakghat <= CHAKGHAT_RADIUS_KM && dChakghat < dShankar) {
    const cz = zones.find((z) => z.is_active && z.name.toLowerCase().includes("chakghat"));
    if (cz) return cz;
  }

  if (dShankar <= SHANKARGARH_RADIUS_KM && dShankar < dChakghat) {
    const sz = zones.find((z) => z.is_active && (z.name.toLowerCase().includes("shankar") || z.name.toLowerCase().includes("main")));
    if (sz) return sz;
  }

  return null;
}

export function zoneForAddress(address: string | null | undefined, zones: DeliveryZone[]): DeliveryZone | null {
  if (!address || !address.trim() || !zones || zones.length === 0) return null;
  const s = address.toLowerCase().trim();

  // 1. Direct match on zone name or city
  for (const z of zones) {
    if (!z.is_active) continue;
    const nameLower = z.name.toLowerCase().trim();
    const cityLower = (z.city || "").toLowerCase().trim();
    if (nameLower.length >= 3 && s.includes(nameLower)) return z;
    if (cityLower.length >= 3 && s.includes(cityLower)) return z;
  }

  // 2. Chakghat keywords
  if (
    s.includes("chakghat") ||
    s.includes("chak ghat") ||
    s.includes("486226") ||
    s.includes("teonthar") ||
    s.includes("tamasa") ||
    s.includes("ghuma")
  ) {
    const cz = zones.find((z) => z.is_active && z.name.toLowerCase().includes("chakghat"));
    if (cz) return cz;
  }

  // 3. Shankargarh keywords
  if (
    s.includes("shankargarh") ||
    s.includes("shankergarh") ||
    s.includes("212108") ||
    s.includes("raja market") ||
    s.includes("station road") ||
    s.includes("bara road") ||
    s.includes("lalita nagar") ||
    s.includes("main bazaar")
  ) {
    const sz = zones.find((z) => z.is_active && (z.name.toLowerCase().includes("shankar") || z.name.toLowerCase().includes("main")));
    if (sz) return sz;
  }

  return null;
}

export function resolveCustomerZone(
  coords: ZonePoint | null | undefined,
  address: string | null | undefined,
  zones: DeliveryZone[] = []
): DeliveryZone | null {
  if (coords && typeof coords.lat === "number" && typeof coords.lng === "number" && !isNaN(coords.lat) && !isNaN(coords.lng)) {
    const z = zoneForPoint(coords, zones);
    if (z) return z;
  }
  if (address && address.trim().length > 0) {
    const z = zoneForAddress(address, zones);
    if (z) return z;
  }
  return null;
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

const SERVICEABLE_KEYWORDS = [
  // Shankargarh keywords
  "shankargarh",
  "shankergarh",
  "212108",
  "raja market",
  "station road",
  "bara road",
  "lalita nagar",
  "main bazaar",
  // Chakghat keywords
  "chakghat",
  "chak ghat",
  "486226",
  "teonthar",
  "ghuma",
  "tamasa",
];

const OUTSIDE_KEYWORDS = [
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
 * Covers both Shankargarh Zone and Chakghat Zone, plus any dynamically added zones in Supabase.
 */
export function isLocationInServiceZone(
  coords: { lat: number; lng: number } | null | undefined,
  address: string | null | undefined,
  activeZones: DeliveryZone[] = []
): boolean {
  if ((!coords || typeof coords.lat !== "number") && (!address || !address.trim())) {
    // Neither coordinates nor address determined yet
    return true;
  }
  return resolveCustomerZone(coords, address, activeZones) != null;
}
