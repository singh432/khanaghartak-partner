import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { Bike, MapPin, Phone, Package, LogOut, CheckCircle2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/rider")({
  component: RiderPanel,
  head: () => ({ meta: [{ title: "Rider Panel — KhanaGharTak" }] }),
});

type Order = {
  id: string; status: string; total: number;
  customer_name: string; customer_phone: string;
  address: string; landmark: string | null; notes: string | null;
  latitude: number | null; longitude: number | null;
  items: { name: string; qty: number; price: number }[];
  rider_id: string | null;
  restaurant_id: string | null;
  created_at: string;
};

type Restaurant = { id: string; name: string; address: string | null; phone: string | null };

function RiderPanel() {
  const { user, loading, isRider, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/rider" } as any });
  }, [user, loading, navigate]);

  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center>;
  if (!user) return null;
  if (!isRider) return <BecomeRider />;
  return <RiderDashboard riderId={user.id} onSignOut={signOut} />;
}

function BecomeRider() {
  const [busy, setBusy] = useState(false);
  const enroll = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("become_rider" as any);
    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("You're enrolled as a rider!");
    window.location.reload();
  };
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center p-6 text-center">
      <img src={khanaGharTakLogoUrl} alt="" className="h-20 w-20 rounded-2xl object-contain" />
      <h1 className="mt-4 text-2xl font-extrabold">Join as a Rider</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Accept delivery orders, view pinned customer locations, and earn on every drop.
      </p>
      <button onClick={enroll} disabled={busy}
        className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Become a Rider
      </button>
    </div>
  );
}

function RiderDashboard({ riderId, onSignOut }: { riderId: string; onSignOut: () => Promise<void> }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant>>({});
  const [tab, setTab] = useState<"available" | "mine">("available");

  const load = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .or(`and(status.eq.out_for_delivery,rider_id.is.null),rider_id.eq.${riderId}`)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    const list = (data ?? []) as unknown as Order[];
    setOrders(list);
    const rIds = [...new Set(list.map((o) => o.restaurant_id).filter(Boolean))] as string[];
    if (rIds.length) {
      const { data: rs } = await supabase.from("restaurants").select("id,name,address,phone").in("id", rIds);
      const map: Record<string, Restaurant> = {};
      (rs ?? []).forEach((r: any) => { map[r.id] = r; });
      setRestaurants(map);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("rider-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  const available = useMemo(() => orders.filter((o) => o.rider_id === null && o.status === "out_for_delivery"), [orders]);
  const mine = useMemo(() => orders.filter((o) => o.rider_id === riderId && o.status !== "delivered"), [orders, riderId]);

  const accept = async (id: string) => {
    const { error } = await supabase.from("orders").update({ rider_id: riderId }).eq("id", id).is("rider_id", null);
    if (error) toast.error(error.message); else toast.success("Order accepted!");
  };
  const markDelivered = async (id: string) => {
    const { error } = await supabase.from("orders").update({ status: "delivered" }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Marked delivered");
  };

  const list = tab === "available" ? available : mine;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src={khanaGharTakLogoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
          <div>
            <p className="text-sm font-extrabold leading-tight">Rider Panel</p>
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Bike className="h-3 w-3" /> KhanaGharTak</p>
          </div>
        </div>
        <button onClick={onSignOut} className="rounded-full p-2 text-muted-foreground hover:bg-secondary" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-1 p-3">
        <Tab on={tab === "available"} onClick={() => setTab("available")} label={`Available (${available.length})`} />
        <Tab on={tab === "mine"} onClick={() => setTab("mine")} label={`My Deliveries (${mine.length})`} />
      </div>

      <div className="space-y-3 px-3">
        {list.length === 0 && (
          <div className="rounded-2xl border bg-card p-8 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <p className="mt-3 text-sm text-muted-foreground">
              {tab === "available" ? "No orders waiting for pickup right now." : "You haven't accepted any deliveries yet."}
            </p>
          </div>
        )}
        {list.map((o) => {
          const r = o.restaurant_id ? restaurants[o.restaurant_id] : undefined;
          const mapHref = o.latitude && o.longitude
            ? `https://www.google.com/maps?q=${o.latitude},${o.longitude}`
            : `https://www.google.com/maps/search/${encodeURIComponent(o.address)}`;
          return (
            <article key={o.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-base font-bold leading-tight">{o.customer_name}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  ₹{Number(o.total).toFixed(0)} COD
                </span>
              </div>

              {r && (
                <div className="mt-3 rounded-xl bg-accent/40 p-3 text-xs">
                  <p className="font-bold text-foreground">Pickup: {r.name}</p>
                  {r.address && <p className="text-muted-foreground">{r.address}</p>}
                  {r.phone && <a href={`tel:${r.phone}`} className="mt-1 inline-flex items-center gap-1 font-semibold text-primary"><Phone className="h-3 w-3" /> {r.phone}</a>}
                </div>
              )}

              <div className="mt-3 rounded-xl bg-secondary p-3 text-xs">
                <p className="font-bold text-foreground">Drop: {o.address}</p>
                {o.landmark && <p className="text-muted-foreground">Landmark: {o.landmark}</p>}
                {o.notes && <p className="mt-1 text-muted-foreground italic">Note: {o.notes}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`tel:${o.customer_phone}`} className="inline-flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold">
                    <Phone className="h-3 w-3" /> {o.customer_phone}
                  </a>
                  <a href={mapHref} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    <MapPin className="h-3 w-3" /> Open in Maps
                  </a>
                </div>
              </div>

              <div className="mt-3 rounded-xl border p-3 text-xs">
                <p className="mb-1 font-bold">Items</p>
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>{it.qty}× {it.name}</span>
                    <span className="text-muted-foreground">₹{(it.price * it.qty).toFixed(0)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                {o.rider_id === null ? (
                  <button onClick={() => accept(o.id)}
                    className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
                    Accept this Delivery
                  </button>
                ) : (
                  <button onClick={() => markDelivered(o.id)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 text-sm font-bold text-success-foreground">
                    <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Tab({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={`h-10 rounded-lg text-sm font-bold transition ${on ? "bg-foreground text-background" : "bg-secondary text-foreground/70"}`}>
      {label}
    </button>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[100dvh] items-center justify-center">{children}</div>;
}
