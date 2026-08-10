import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Launch offer: free delivery from 15 Aug for the first 50 orders. */
export function FreeDeliveryBanner() {
  const [promo, setPromo] = useState<{ active: boolean; remaining: number } | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("free_delivery_status").then(
      ({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (active && row) setPromo({ active: !!row.active, remaining: Number(row.remaining ?? 0) });
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);

  if (!promo?.active) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-success/40 bg-success/10 p-3">
      <span className="text-xl">🎉</span>
      <div>
        <p className="text-sm font-bold text-success">FREE delivery on your order</p>
        <p className="text-[11px] text-muted-foreground">
          Launch offer from 15 August · first 50 orders only
          {promo.remaining ? ` · ${promo.remaining} left` : ""}
        </p>
      </div>
    </div>
  );
}
