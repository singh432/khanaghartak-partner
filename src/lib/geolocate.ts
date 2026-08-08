import type { LatLng } from "@/lib/geo";

/**
 * Robust browser geolocation:
 * 1. Tries a high-accuracy GPS fix with a generous timeout.
 * 2. On timeout/failure, retries with low accuracy (network/wifi) which is
 *    much faster indoors and on desktops.
 */
export function getCurrentLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Location is not supported on this device"));
      return;
    }

    const ok = (pos: GeolocationPosition) =>
      resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });

    const fallback = () => {
      navigator.geolocation.getCurrentPosition(
        ok,
        (err) => reject(new Error(describeGeoError(err))),
        { enableHighAccuracy: false, timeout: 30000, maximumAge: 10 * 60 * 1000 },
      );
    };

    navigator.geolocation.getCurrentPosition(
      ok,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error(describeGeoError(err)));
          return;
        }
        fallback();
      },
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 60000 },
    );
  });
}

export function describeGeoError(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED)
    return "Location permission denied. Allow location access in your browser settings and try again.";
  if (err.code === err.POSITION_UNAVAILABLE)
    return "Could not determine your location. Turn on GPS / location services and try again.";
  return "Getting your location took too long. Move near a window or enter the coordinates manually.";
}
