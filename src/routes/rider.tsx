import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { Bike, MapPin, Phone, Package, LogOut, CheckCircle2, Loader2, Clock } from "lucide-react";

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

type Offer = {
  order_id: string;
  restaurant_name: string | null;
  restaurant_address: string | null;
  drop_area: string | null;
  total: number;
  item_count: number;
  distance_km: number | null;
  expires_at: string;
};

type Restaurant = { id: string; name: string; address: string | null; phone: string | null };
type RiderProfile = {
  status: "pending" | "approved" | "rejected" | "suspended";
  full_name: string | null;
  phone: string | null;
  vehicle: string | null;
  base_latitude: number | null;
  base_longitude: number | null;
};


function RiderPanel() {
  const { user, loading, isRider, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { as: "rider" } as any });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setProfileChecked(false);
    (async () => {
      const { data } = await (supabase.from("rider_profiles") as any)
        .select("status, full_name, phone, vehicle, base_latitude, base_longitude")
        .eq("user_id", user.id)
        .maybeSingle();
      if (active) {
        setProfile((data as RiderProfile | null) ?? null);
        setProfileChecked(true);
      }
    })();
    return () => { active = false; };
  }, [user, isRider]);

  if (loading || (user && !profileChecked)) return <Center><Loader2 className="h-6 w-6 animate-spin text-primary" /></Center>;
  if (!user) return null;
  if (!isRider || !profile) return <BecomeRider />;
  if (profile.status !== "approved") return <RiderPending profile={profile} onSignOut={signOut} />;
  return <RiderDashboard riderId={user.id} onSignOut={signOut} />;
}

function BecomeRider() {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", vehicle: "" });

  const enroll = async (e: FormEvent) => {
    e.preventDefault();
    if (form.full_name.trim().length < 2) return toast.error("Enter your full name");
    if (form.phone.trim().length < 7) return toast.error("Enter a valid phone");
    setBusy(true);
    const { error } = await supabase.rpc("become_rider" as any, {
      _full_name: form.full_name.trim(),
      _phone: form.phone.trim(),
      _vehicle: form.vehicle.trim() || null,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    toast.success("Submitted! Awaiting admin approval.");
    window.location.reload();
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center p-6">
      <img src={khanaGharTakLogoUrl} alt="" className="h-16 w-16 rounded-2xl object-contain" />
      <h1 className="mt-4 text-2xl font-extrabold text-center">Join as a Rider</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">Submit your details. Once a super admin approves, you can start accepting deliveries.</p>
      <form onSubmit={enroll} className="mt-5 w-full space-y-3">
        <input className="w-full rounded-xl border bg-card px-3 py-3 text-sm" placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={80} />
        <input className="w-full rounded-xl border bg-card px-3 py-3 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
        <input className="w-full rounded-xl border bg-card px-3 py-3 text-sm" placeholder="Vehicle (e.g. Bike — DL 1A 1234)" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} maxLength={80} />
        <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-6 font-bold text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit application
        </button>
      </form>
    </div>
  );
}

function RiderPending({ profile, onSignOut }: { profile: RiderProfile; onSignOut: () => Promise<void> }) {
  const map: Record<string, { title: string; body: string; tone: string }> = {
    pending: { title: "Waiting for approval", body: "Your rider application is under review. You can't accept deliveries yet.", tone: "text-amber-600 bg-amber-500/10" },
    rejected: { title: "Application not approved", body: "Your rider application was rejected. Please contact support.", tone: "text-destructive bg-destructive/10" },
    suspended: { title: "Account suspended", body: "Your rider account has been suspended by KhanaGharTak.", tone: "text-destructive bg-destructive/10" },
  };
  const info = map[profile.status] ?? map.pending;
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center p-6 text-center">
      <img src={khanaGharTakLogoUrl} alt="" className="h-16 w-16 rounded-2xl object-contain" />
      <h1 className="mt-4 text-xl font-extrabold tracking-tight">{info.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{info.body}</p>
      <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold capitalize ${info.tone}`}>
        <Clock className="h-3 w-3" /> {profile.status}
      </div>
      {profile.full_name && (
        <div className="mt-5 w-full rounded-2xl border bg-card p-4 text-left text-sm">
          <p className="font-bold">{profile.full_name}</p>
          {profile.phone && <p className="text-muted-foreground">{profile.phone}</p>}
          {profile.vehicle && <p className="text-muted-foreground">{profile.vehicle}</p>}
        </div>
      )}
      <button onClick={onSignOut} className="mt-6 w-full rounded-xl border py-2.5 text-sm font-semibold">Sign out</button>
    </div>
  );
}

function buildMapsUrl(o: Order) {
  if (o.latitude && o.longitude && !(o.latitude === 0 && o.longitude === 0)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(o.address)}`;
}

function openMaps(o: Order) {
  const url = buildMapsUrl(o);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) {
    // popup blocked — fall back to top-level navigation
    window.location.href = url;
  }
}

function RiderDashboard({
  riderId,
  profile,
  onSignOut,
}: { riderId: string; profile: RiderProfile; onSignOut: () => Promise<void> }) {
  const [mineOrders, setMineOrders] = useState<Order[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, Restaurant>>({});
  const [tab, setTab] = useState<"available" | "mine">("available");
  const [hasBase, setHasBase] = useState(
    profile.base_latitude != null && profile.base_longitude != null,
  );

  const load = async () => {
    // "Mine" orders: full details visible via RLS only for orders assigned to this rider
    const { data: mine, error: mineErr } = await supabase
      .from("orders")
      .select("*")
      .eq("rider_id", riderId)
      .neq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(100);
    if (mineErr) { toast.error(mineErr.message); return; }
    const mineList = (mine ?? []) as unknown as Order[];
    setMineOrders(mineList);

    // Live offers made to this rider only — no customer PII until accepted
    const { data: offerData, error: offerErr } = await supabase.rpc("rider_list_offers" as any);
    if (offerErr) { toast.error(offerErr.message); return; }
    setOffers((offerData ?? []) as unknown as Offer[]);

    const rIds = [...new Set(mineList.map((o) => o.restaurant_id).filter(Boolean))] as string[];
    if (rIds.length) {
      const { data: rs } = await supabase.from("restaurants").select("id,name,address,phone").in("id", rIds);
      const map: Record<string, Restaurant> = {};
      (rs ?? []).forEach((r: any) => { map[r.id] = r; });
      setRestaurants(map);
    }
  };


  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riderId]);

  const accept = async (id: string) => {
    const { error } = await supabase.rpc("rider_accept_order" as any, { _order_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Order accepted!");
    setTab("mine");
    await load();
  };
  const markDelivered = async (id: string) => {
    const { error } = await supabase.rpc("rider_mark_delivered" as any, { _order_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Marked delivered");
    await load();
  };


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
        <Tab on={tab === "available"} onClick={() => setTab("available")} label={`Available (${availableOrders.length})`} />
        <Tab on={tab === "mine"} onClick={() => setTab("mine")} label={`My Deliveries (${mineOrders.length})`} />
      </div>

      <div className="space-y-3 px-3">
        {tab === "available" && availableOrders.length === 0 && (
          <EmptyState text="No orders waiting for pickup right now." />
        )}
        {tab === "mine" && mineOrders.length === 0 && (
          <EmptyState text="You haven't accepted any deliveries yet." />
        )}

        {tab === "available" && availableOrders.map((o) => {
          const r = o.restaurant_id ? restaurants[o.restaurant_id] : undefined;
          return (
            <article key={o.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-bold text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-base font-bold leading-tight">{o.item_count} item{o.item_count === 1 ? "" : "s"}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  ₹{Number(o.total).toFixed(0)} COD
                </span>
              </div>

              {r && (
                <div className="mt-3 rounded-xl bg-accent/40 p-3 text-xs">
                  <p className="font-bold text-foreground">Pickup: {r.name}</p>
                  {r.address && <p className="text-muted-foreground">{r.address}</p>}
                </div>
              )}

              <div className="mt-3 rounded-xl bg-secondary p-3 text-xs">
                <p className="font-bold text-foreground">Drop area: {o.drop_area ?? "—"}</p>
                <p className="mt-1 text-muted-foreground italic">Customer contact and exact address unlock after you accept.</p>
              </div>

              <div className="mt-3">
                <button onClick={() => accept(o.id)}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground">
                  Accept this Delivery
                </button>
              </div>
            </article>
          );
        })}

        {tab === "mine" && mineOrders.map((o) => {
          const r = o.restaurant_id ? restaurants[o.restaurant_id] : undefined;
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
                  <button type="button" onClick={() => openMaps(o)}
                    className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                    <MapPin className="h-3 w-3" /> Open in Maps
                  </button>
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
                <button onClick={() => markDelivered(o.id)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success py-3 text-sm font-bold text-success-foreground">
                  <CheckCircle2 className="h-4 w-4" /> Mark Delivered
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <Package className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <p className="mt-3 text-sm text-muted-foreground">{text}</p>
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
