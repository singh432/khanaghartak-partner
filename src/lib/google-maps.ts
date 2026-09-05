// Loads the Google Maps JavaScript API once, client-side only.
let loader: Promise<any> | null = null;

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (loader) return loader;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as string | undefined;

  loader = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.google?.maps?.Map) return resolve(w.google);
    if (!key) return reject(new Error("Google Maps key missing"));

    const cbName = "__khg_initGoogleMaps";
    w[cbName] = () => resolve(w.google);
    const s = document.createElement("script");
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&libraries=places,geometry&callback=${cbName}` +
      (channel ? `&channel=${channel}` : "");
    s.async = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });

  return loader;
}
