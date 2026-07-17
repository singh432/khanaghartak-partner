import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PricingSettings = {
  platform_fee: number;
  delivery_per_km: number;
  max_delivery_radius_km: number;
};

const DEFAULTS: PricingSettings = {
  platform_fee: 10,
  delivery_per_km: 10,
  max_delivery_radius_km: 10,
};

// Simple in-memory cache so multiple components on one page share the fetch.
let cache: PricingSettings | null = null;
let inflight: Promise<PricingSettings> | null = null;

export async function fetchPricingSettings(): Promise<PricingSettings> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase
        .from("platform_settings")
        .select("platform_fee, delivery_per_km, max_delivery_radius_km")
        .limit(1)
        .maybeSingle();
      const v: PricingSettings = {
        platform_fee: Number(data?.platform_fee ?? DEFAULTS.platform_fee),
        delivery_per_km: Number(data?.delivery_per_km ?? DEFAULTS.delivery_per_km),
        max_delivery_radius_km: Number(
          data?.max_delivery_radius_km ?? DEFAULTS.max_delivery_radius_km,
        ),
      };
      cache = v;
      return v;
    } catch {
      return DEFAULTS;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function usePricingSettings() {
  const [settings, setSettings] = useState<PricingSettings | null>(cache);
  useEffect(() => {
    let active = true;
    fetchPricingSettings().then((v) => {
      if (active) setSettings(v);
    });
    return () => {
      active = false;
    };
  }, []);
  return settings ?? DEFAULTS;
}

/** Delivery charge rounded to nearest rupee (road distance × per-km). */
export function computeDeliveryFee(distanceKm: number, perKm: number): number {
  return Math.max(0, Math.round(distanceKm * perKm));
}

/** Straight-line km × 1.3 road factor. */
export const ROAD_FACTOR = 1.3;
