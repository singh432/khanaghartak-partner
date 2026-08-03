import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Bike, Loader2, Truck } from "lucide-react";

export const Route = createFileRoute("/super/deliveries")({
  component: SuperDeliveries,
  head: () => ({ meta: [{ title: "Deliveries — KhanaGharTak Super Admin" }] }),
});

type Order = {
  id: string;
  status: string;
  total: number;
  rider_id: string | null;
  restaurant_id: string | null;
  address: string;
  landmark: string | null;
  created_at: string;
};

type Offer = {
  order_id: string;
  rider_id: string;
  rank: number;
  status: string;
  distance_km: number | null;
  expires_at: string | null;
};

type Rider = { user_id: string; full_name: string | null; phone: string | null; status: string };

function SuperDeliveries() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: o }, { data: of }, { data: rd }, { data: rs }] = await Promise.all([
      supabase
        .from("orders")
        .select("id,status,total,rider_id,restaurant_id,address,landmark,created_at")
        .in("status", ["preparing", "accepted", "out_for_delivery"])
        .order("created_at", { ascending: false })
        .limit(60),
      (supabase.from("delivery_offers") as any)
        .select("order_id,rider_id,rank,status,distance_km,expires_at")
        .order("rank", { ascending: true }),
      (supabase.from("rider_profiles") as any)
        .select("user_id,full_name,phone,status")
        .eq("status", "approved"),
      supabase.from("restaurants").select("id,name"),
    ]);
    setOrders((o ?? []) as unknown as Order[]);
    setOffers((of ?? []) as unknown as Offer[]);
    setRiders((rd ?? []) as unknown as Rider[]);
    const map: Record<string, string> = {};
    (rs ?? []).forEach((r: any) => { map[r.id] = r.name; });
    setRestaurants(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const assign = async (orderId: string, riderId: string) => {
    if (!riderId) return;
    setBusy(orderId);
    const { error } = await supabase.rpc("super_assign_rider" as any, {
      _order_id: orderId,
      _rider_id: riderId,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rider assigned");
    load();
  };

  const riderName = (id: string) =>
    riders.find((r) => r.user_id === id)?.full_name ?? id.slice(0, 8);

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-extrabold">Deliveries & rider offers</h1>
      </div>

      {orders.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No live orders right now.
        </div>
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const chain = offers.filter((f) => f.order_id === o.id).sort((a, b) => a.rank - b.rank);
          const exhausted = chain.length > 0 && !chain.some((c) => ["queued", "active", "accepted"].includes(c.status));
          return (
            <article key={o.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-sm font-bold">{o.restaurant_id ? restaurants[o.restaurant_id] ?? "Kitchen" : "Kitchen"}</p>
                  <p className="text-xs text-muted-foreground">{o.landmark || o.address}</p>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold capitalize">{o.status.replace(/_/g, " ")}</span>
                  <p className="mt-1 text-sm font-bold">₹{Number(o.total).toFixed(0)}</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-secondary/60 p-3 text-xs">
                <p className="mb-1 font-bold">Offer chain</p>
                {chain.length === 0 && <p className="text-muted-foreground">No offers dispatched yet (starts when the kitchen marks it Preparing).</p>}
                {chain.map((c) => (
                  <div key={`${c.order_id}-${c.rider_id}`} className="flex items-center justify-between py-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Bike className="h-3 w-3" /> #{c.rank} {riderName(c.rider_id)}
                      {c.distance_km != null && <span className="text-muted-foreground"> · {Number(c.distance_km).toFixed(1)} km</span>}
                    </span>
                    <span className={`font-bold capitalize ${
                      c.status === "accepted" ? "text-success" :
                      c.status === "active" ? "text-primary" :
                      c.status === "expired" ? "text-destructive" : "text-muted-foreground"
                    }`}>{c.status}</span>
                  </div>
                ))}
                {exhausted && !o.rider_id && (
                  <p className="mt-2 font-bold text-destructive">All riders passed — assign manually.</p>
                )}
              </div>

              {o.rider_id ? (
                <p className="mt-3 text-xs font-bold text-success">Assigned to {riderName(o.rider_id)}</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <select
                    defaultValue=""
                    disabled={busy === o.id}
                    onChange={(e) => assign(o.id, e.target.value)}
                    className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm"
                  >
                    <option value="">Assign a rider manually…</option>
                    {riders.map((r) => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.full_name ?? r.user_id.slice(0, 8)}{r.phone ? ` · ${r.phone}` : ""}
                      </option>
                    ))}
                  </select>
                  {busy === o.id && <Loader2 className="mt-2.5 h-5 w-5 animate-spin text-primary" />}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
