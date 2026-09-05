import { createServerFn } from "@tanstack/react-start";

// Loads the Google Maps JavaScript API once, client-side only.
// Always uses the project's own GOOGLE_API_KEY so custom domains never
// receive the Lovable-managed browser key.
let loader: Promise<any> | null = null;

const getGoogleMapsConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const key = process.env["GOOGLE_API_KEY"];
    if (!key) {
      throw new Error("GOOGLE_API_KEY secret is not configured");
    }
    return { key };
  });

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (loader) return loader;

  loader = new Promise(async (resolve, reject) => {
    try {
      const { key } = await getGoogleMapsConfig();
      const w = window as any;
      if (w.google?.maps?.Map) return resolve(w.google);

      const cbName = "__khg_initGoogleMaps";
      w[cbName] = () => resolve(w.google);

      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places,geometry&callback=${cbName}`;
      s.async = true;
      s.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(s);
    } catch (e: any) {
      reject(e);
    }
  });

  return loader;
}
