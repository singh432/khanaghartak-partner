import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_DELIVERY_SLABS,
  DEFAULT_EXTRA_PER_KM,
  type DeliverySlab,
} from "@/lib/delivery-pricing";

export type PricingSettings = {
  platform_fee: number;
  delivery_per_km: number;
  max_delivery_radius_km: number;
  delivery_slabs: DeliverySlab[];
  delivery_extra_per_km: number;
};

const DEFAULTS: PricingSettings = {
  platform_fee: 10,
  delivery_per_km: 10,
  max_delivery_radius_km: 7,
  delivery_slabs: DEFAULT_DELIVERY_SLABS,
  delivery_extra_per_km: DEFAULT_EXTRA_PER_KM,
};

// Simple in-memory cache so multiple components on one page share the fetch.
let cache: PricingSettings | null = null;
let inflight: Promise<PricingSettings> | null = null;

export async function fetchPricingSettings(): Promise<PricingSettings> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      // platform_settings is admin-only; this SECURITY DEFINER RPC exposes just the pricing fields.
      const { data: rows } = await supabase.rpc("public_pricing");
      const data = (Array.isArray(rows) ? rows[0] : rows) as {
        platform_fee?: number | null;
        delivery_per_km?: number | null;
        max_delivery_radius_km?: number | null;
      } | null;
      const raw = data as (typeof data & {
        delivery_slabs?: unknown;
        delivery_extra_per_km?: number | null;
      }) | null;
      const slabs = Array.isArray(raw?.delivery_slabs)
        ? (raw!.delivery_slabs as DeliverySlab[])
        : DEFAULTS.delivery_slabs;
      const v: PricingSettings = {
        platform_fee: Number(data?.platform_fee ?? DEFAULTS.platform_fee),
        delivery_per_km: Number(data?.delivery_per_km ?? DEFAULTS.delivery_per_km),
        max_delivery_radius_km: Number(
          data?.max_delivery_radius_km ?? DEFAULTS.max_delivery_radius_km,
        ),
        delivery_slabs: slabs.length ? slabs : DEFAULTS.delivery_slabs,
        delivery_extra_per_km: Number(
          raw?.delivery_extra_per_km ?? DEFAULTS.delivery_extra_per_km,
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


/** Straight-line km × 1.3 road factor. */
export const ROAD_FACTOR = 1.3;
