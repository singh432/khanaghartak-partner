// Service-area constants for KhanaGharTak.
// Center: Shankargarh, Prayagraj, UP.
export const SERVICE_CENTER = { lat: 25.1842, lng: 81.6212 } as const;
export const SERVICE_RADIUS_KM = 10;

export type LatLng = { lat: number; lng: number };

// Haversine distance in kilometres between two points.
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371; // km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceFromServiceCenterKm(p: LatLng): number {
  return distanceKm(SERVICE_CENTER, p);
}

export function isWithinServiceArea(p: LatLng): boolean {
  return distanceFromServiceCenterKm(p) <= SERVICE_RADIUS_KM;
}
