import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bike, MapPin, Navigation } from "lucide-react";

type RiderLoc = {
  latitude: number;
  longitude: number;
  updated_at: string;
  rider_name: string | null;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function ago(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)} min ago`;
}

/**
 * Shows the assigned rider's live position for an order.
 * Data comes from the `order_rider_location` RPC which only returns a
 * position to the customer who owns the order (and staff), while the
 * delivery is in progress.
 */
export function RiderLiveTracker({
  orderId,
  dropLat,
  dropLng,
}: {
  orderId: string;
  dropLat?: number | null;
  dropLng?: number | null;
}) {
  const [loc, setLoc] = useState<RiderLoc | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchLoc = async () => {
      const { data } = await supabase.rpc("order_rider_location" as any, { _order_id: orderId });
      if (!active) return;
      const row = Array.isArray(data) ? (data[0] as RiderLoc | undefined) : undefined;
      setLoc(row ?? null);
      setChecked(true);
    };
    fetchLoc();
    const t = setInterval(fetchLoc, 10000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [orderId]);

  if (!checked) return null;

  if (!loc) {
    return (
      <div className="mt-4 w-full max-w-sm rounded-2xl border bg-card p-4 text-left">
        <p className="inline-flex items-center gap-2 text-sm font-bold">
          <Bike className="h-4 w-4 text-primary" /> Live rider tracking
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Live location will appear here as soon as a rider picks up your order.
        </p>
      </div>
    );
  }

  const km =
    dropLat != null && dropLng != null
      ? haversineKm(loc.latitude, loc.longitude, dropLat, dropLng)
      : null;
  const d = 0.012;
  const bbox = `${loc.longitude - d},${loc.latitude - d},${loc.longitude + d},${loc.latitude + d}`;
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${loc.latitude},${loc.longitude}`;

  return (
    <div className="mt-4 w-full max-w-sm overflow-hidden rounded-2xl border bg-card text-left">
      <div className="flex items-center justify-between gap-2 p-4 pb-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-bold">
            <Bike className="h-4 w-4 text-primary" />
            {loc.rider_name ? `${loc.rider_name} is on the way` : "Rider is on the way"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Updated {ago(loc.updated_at)}
            {km != null && ` · ~${km.toFixed(1)} km away`}
          </p>
        </div>
        <span className="pulse-dot" />
      </div>

      <iframe
        title="Rider live location"
        src={mapSrc}
        className="h-56 w-full border-0"
        loading="lazy"
      />

      <div className="flex items-center justify-between gap-2 p-3">
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> Live position refreshes every 10s
        </p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
        >
          <Navigation className="h-3 w-3" /> View in Maps
        </a>
      </div>
    </div>
  );
}
