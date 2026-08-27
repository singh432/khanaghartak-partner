import { supabase } from "@/integrations/supabase/client";

export type ZonePoint = { lat: number; lng: number };

export type DeliveryZone = {
  id: string;
  name: string;
  city: string | null;
  polygon: ZonePoint[];
  is_active: boolean;
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
  }));
}

export async function fetchActiveZones(): Promise<DeliveryZone[]> {
  const { data } = await (supabase.from("delivery_zones") as any)
    .select("id,name,city,polygon,is_active")
    .eq("is_active", true);
  return normalise(data ?? []);
}

export async function fetchAllZones(): Promise<DeliveryZone[]> {
  const { data } = await (supabase.from("delivery_zones") as any)
    .select("id,name,city,polygon,is_active")
    .order("name");
  return normalise(data ?? []);
}
