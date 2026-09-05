import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Loads the Google Maps JavaScript API once, client-side only.
// On custom domains (e.g. khanaghartak.in) it uses the workspace's own
// GOOGLE_API_KEY secret. On Lovable preview/published URLs it falls back
// to the Lovable-managed connector credentials so previews keep working.
let loader: Promise<any> | null = null;

const getGoogleMapsConfig = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ useOwnKey: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    if (data.useOwnKey) {
      const userKey = process.env["GOOGLE_API_KEY"];
      if (!userKey) {
        throw new Error("GOOGLE_API_KEY secret is not set. Add it in project settings.");
      }
      return { key: userKey, channel: null as string | null };
    }

    const key =
      process.env["GOOGLE_MAPS_BROWSER_KEY"] ||
      import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel =
      process.env["GOOGLE_MAPS_TRACKING_ID"] ||
      import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];

    if (!key) {
      throw new Error("Google Maps API key not configured");
    }

    return { key, channel: (channel as string | undefined) ?? null };
  });

export async function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("browser only"));
  if (loader) return loader;

  loader = new Promise(async (resolve, reject) => {
    try {
      const host = window.location.hostname;
      const useOwnKey = !(
        host.endsWith(".lovable.app") ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.startsWith("192.168.") ||
        host.startsWith("10.")
      );

      const { key, channel } = await getGoogleMapsConfig({ data: { useOwnKey } });
      const w = window as any;
      if (w.google?.maps?.Map) return resolve(w.google);

      const cbName = "__khg_initGoogleMaps";
      w[cbName] = () => resolve(w.google);

      const s = document.createElement("script");
      s.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&libraries=places,geometry&callback=${cbName}` +
        (channel ? `&channel=${encodeURIComponent(channel)}` : "");
      s.async = true;
      s.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(s);
    } catch (e: any) {
      reject(e);
    }
  });

  return loader;
}
