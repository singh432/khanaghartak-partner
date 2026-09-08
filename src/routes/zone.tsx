import { createFileRoute, useNavigate, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bike, ClipboardList, Loader2, MapPin, ShieldAlert, Store, Users, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { inRange, rangeLabel, todayInputValue, type DateRange } from "@/lib/date-range";
import { sumPayouts, inr } from "@/lib/payouts";
import type { ZonePoint } from "@/lib/zones";
import { isRestaurantOpen, hoursLabel } from "@/lib/hours";
import { useMinuteTick } from "@/hooks/useMinuteTick";


const ZoneMapEditor = lazy(() => import("@/components/ZoneMapEditor.client"));

export const Route = createFileRoute("/zone")({
  component: ZoneManagerPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Zone Manager — KhanaGharTak" },
      { name: "description", content: "Manage orders, restaurants, riders and customers for your assigned KhanaGharTak delivery zone." },
      { property: "og:title", content: "Zone Manager — KhanaGharTak" },
      { property: "og:description", content: "Manage orders, restaurants, riders and customers for your assigned KhanaGharTak delivery zone." },
      { property: "og:type", content: "website" },
    ],
  }),
});

type Zone = { id: string; name: string; city: string | null; is_active: boolean; polygon: ZonePoint[] | null };
type Order = {
  id: string; restaurant_name: string | null; status: string; total: number; subtotal: number;
  platform_fee: number; delivery_fee: number; discount: number; customer_name: string; customer_phone: string;
  address: string; landmark: string | null; rider_id: string | null; rider_name: string | null; created_at: string;
};
type Rider = { user_id: string; full_name: string | null; phone: string | null; status: string; is_online: boolean };
type Rest = { id: string; name: string; status: string; is_open: boolean; address: string | null; phone: string | null; opening_time?: string | null; closing_time?: string | null };
type Cust = { user_id: string; full_name: string | null; phone: string | null; orders_count: number; total_spent: number | null; last_order_at: string };

type Tab = "orders" | "restaurants" | "riders" | "customers" | "map";

function ZoneManagerPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [restaurants, setRestaurants] = useState<Rest[]>([]);
  const [customers, setCustomers] = useState<Cust[]>([]);
  const [tab, setTab] = useState<Tab>("orders");
  const [range, setRange] = useState<DateRange>({ kind: "today", date: todayInputValue() });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [points, setPoints] = useState<ZonePoint[]>([]);
  const [savingMap, setSavingMap] = useState(false);
  const now = useMinuteTick();


  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", search: { as: "manager" } });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.rpc("zone_my_zones" as any).then(({ data }) => {
      const list = (data ?? []) as unknown as Zone[];
      setZones(list);
      setZoneId((cur) => cur || list[0]?.id || "");
      setLoading(false);
    });
  }, [user]);

  const load = async (id: string) => {
    if (!id) return;
    const [{ data: o }, { data: rd }, { data: rs }, { data: cs }] = await Promise.all([
      supabase.rpc("zone_list_orders" as any, { _zone_id: id, _limit: 300 }),
      supabase.rpc("zone_list_riders" as any, { _zone_id: id }),
      supabase.rpc("zone_list_restaurants" as any, { _zone_id: id }),
      supabase.rpc("zone_list_customers" as any, { _zone_id: id }),
    ]);
    setOrders((o ?? []) as unknown as Order[]);
    setRiders((rd ?? []) as unknown as Rider[]);
    const rests = (rs ?? []) as unknown as Rest[];
    // Opening/closing hours drive the live Open/Closed badge.
    const ids = rests.map((r) => r.id);
    if (ids.length) {
      const { data: hrs } = await supabase.from("restaurants").select("id,opening_time,closing_time").in("id", ids);
      const hmap: Record<string, { opening_time: string | null; closing_time: string | null }> = {};
      ((hrs ?? []) as any[]).forEach((h) => { hmap[h.id] = { opening_time: h.opening_time, closing_time: h.closing_time }; });
      setRestaurants(rests.map((r) => ({ ...r, ...(hmap[r.id] ?? {}) })));
    } else {
      setRestaurants(rests);
    }
    setCustomers((cs ?? []) as unknown as Cust[]);
  };


  useEffect(() => {
    if (!zoneId) return;
    load(zoneId);
    const t = setInterval(() => load(zoneId), 20000);
    return () => clearInterval(t);
  }, [zoneId]);

  const currentZone = zones.find((z) => z.id === zoneId) ?? null;

  useEffect(() => {
    const poly = currentZone?.polygon;
    setPoints(Array.isArray(poly) ? (poly as ZonePoint[]) : []);
  }, [zoneId, currentZone?.polygon]);

  const saveBoundary = async () => {
    if (!zoneId) return;
    if (points.length < 3) return toast.error("Draw at least 3 boundary points on the map");
    setSavingMap(true);
    const { error } = await (supabase.from("delivery_zones") as any)
      .update({ polygon: points as any })
      .eq("id", zoneId);
    setSavingMap(false);
    if (error) return toast.error(error.message);
    toast.success("Zone boundary saved");
    setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, polygon: points } : z)));
  };

  const sortedRiders = useMemo(() => {
    const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
    return riders.slice().sort((a, b) => rank(a.status) - rank(b.status));
  }, [riders]);

  const sortedRestaurants = useMemo(() => {
    return restaurants.slice().sort((a, b) => {
      const openA = isRestaurantOpen(a, now);
      const openB = isRestaurantOpen(b, now);
      if (openA !== openB) return openA ? -1 : 1;
      return 0;
    });
  }, [restaurants, now]);

  const filtered = useMemo(() => orders.filter((o) => inRange(o.created_at, range)), [orders, range]);

  const stats = useMemo(() => {
    const delivered = filtered.filter((o) => o.status === "delivered");
    const pay = sumPayouts(delivered as any);
    return {
      orders: filtered.length,
      delivered: delivered.length,
      cancelled: filtered.filter((o) => ["cancelled", "rejected"].includes(o.status)).length,
      revenue: delivered.reduce((s, o) => s + Number(o.total), 0),
      restaurant: pay.restaurant,
      rider: pay.rider,
      net: pay.platformNet,
    };
  }, [filtered]);

  const setRiderStatus = async (userId: string, status: string) => {
    setBusy(userId);
    const { error } = await supabase.rpc("zone_set_rider_status" as any, { _user_id: userId, _status: status });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Rider ${status}`);
    load(zoneId);
  };

  const setRestaurantOpen = async (id: string, isOpen: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("zone_set_restaurant_open" as any, { _restaurant_id: id, _is_open: isOpen });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(isOpen ? "Restaurant opened" : "Restaurant closed");
    load(zoneId);
  };

  const assign = async (orderId: string, riderId: string) => {
    if (!riderId) return;
    setBusy(orderId);
    const { error } = await supabase.rpc("zone_assign_rider" as any, { _order_id: orderId, _rider_id: riderId });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Rider assigned");
    load(zoneId);
  };

  if (authLoading || loading) {
    return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return null;

  if (zones.length === 0) {
    return (
      <div className="p-6 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-lg font-bold">No zone assigned</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is not a manager of any delivery zone yet. Ask the platform owner to assign you one.
        </p>
        <button onClick={signOut} className="mt-6 rounded-full bg-secondary px-4 py-2 text-sm">Sign out</button>
      </div>
    );
  }

  const activeRiders = riders.filter((r) => r.status === "approved");

  return (
    <div className="min-h-screen bg-secondary/30 pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-3">
        <img src={khanaGharTakLogoUrl} width={36} height={36} alt="" className="h-9 w-9 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Zone Manager</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="h-9 rounded-lg border bg-background px-2 text-xs">
          {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
        <button onClick={signOut} aria-label="Sign out" className="rounded-full bg-secondary p-2"><LogOut className="h-4 w-4" /></button>
      </header>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 text-primary" /> {rangeLabel(range)}
          </div>
          <DateRangeFilter value={range} onChange={setRange} />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="Orders" value={String(stats.orders)} />
          <Stat label="Delivered" value={String(stats.delivered)} />
          <Stat label="Cancelled" value={String(stats.cancelled)} />
          <Stat label="Revenue" value={inr(stats.revenue)} />
          <Stat label="Restaurant payout" value={inr(stats.restaurant)} />
          <Stat label="Rider payout" value={inr(stats.rider)} />
          <Stat label="Net profit" value={inr(stats.net)} />
        </div>

        <nav className="flex gap-2 overflow-x-auto">
          {([
            ["orders", "Orders", ClipboardList],
            ["restaurants", "Restaurants", Store],
            ["riders", "Riders", Bike],
            ["customers", "Customers", Users],
            ["map", "Zone map", MapPin],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold ${tab === key ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>

        {tab === "map" && (
          <section className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold">{currentZone?.name} boundary</p>
                <p className="text-xs text-muted-foreground">
                  You can edit only your own zone. Click the map to add a point · click a point to remove it · {points.length} point{points.length === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="flex gap-2">
                {points.length > 0 && (
                  <button onClick={() => setPoints([])} className="h-10 rounded-xl bg-secondary px-4 text-xs font-semibold">Clear</button>
                )}
                <button onClick={saveBoundary} disabled={savingMap}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground">
                  {savingMap && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save boundary
                </button>
              </div>
            </div>
            <div className="mt-3">
              <ClientOnly fallback={<div className="h-[380px] w-full animate-pulse rounded-2xl border bg-secondary/40" />}>
                <Suspense fallback={<div className="h-[380px] w-full animate-pulse rounded-2xl border bg-secondary/40" />}>
                  <ZoneMapEditor points={points} onChange={setPoints} center={points[0]} />
                </Suspense>
              </ClientOnly>
            </div>
          </section>
        )}

        {tab === "orders" && (
          <div className="space-y-3">
            {filtered.length === 0 && <Empty>No orders in this range.</Empty>}
            {filtered.map((o) => (
              <article key={o.id} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[11px] font-bold text-muted-foreground">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-sm font-bold">{o.restaurant_name ?? "Kitchen"}</p>
                    <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone}</p>
                    <p className="text-xs text-muted-foreground">{o.landmark || o.address}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold capitalize">{o.status.replace(/_/g, " ")}</span>
                    <p className="mt-1 text-sm font-bold">₹{Number(o.total).toFixed(0)}</p>
                  </div>
                </div>
                {o.rider_id ? (
                  <p className="mt-2 text-xs font-bold text-success">Rider: {o.rider_name ?? o.rider_id.slice(0, 8)}</p>
                ) : (
                  <div className="mt-2 flex items-center gap-2">
                    <select defaultValue="" disabled={busy === o.id} onChange={(e) => assign(o.id, e.target.value)}
                      className="h-10 flex-1 rounded-xl border bg-background px-3 text-sm">
                      <option value="">Assign a rider…</option>
                      {activeRiders.map((r) => (
                        <option key={r.user_id} value={r.user_id}>{r.full_name ?? r.user_id.slice(0, 8)}{r.phone ? ` · ${r.phone}` : ""}</option>
                      ))}
                    </select>
                    {busy === o.id && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {tab === "restaurants" && (
          <div className="space-y-2">
            {restaurants.length === 0 && <Empty>No restaurants in this zone.</Empty>}
            {restaurants.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.address ?? "—"}{r.phone ? ` · ${r.phone}` : ""}
                    {hoursLabel(r.opening_time, r.closing_time) ? ` · ${hoursLabel(r.opening_time, r.closing_time)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold">
                  <span className="rounded-full bg-secondary px-2 py-1 capitalize">{r.status}</span>
                  <span className={`rounded-full px-2 py-1 ${isRestaurantOpen(r, now) ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{isRestaurantOpen(r, now) ? "Open" : "Closed"}</span>

                  <button disabled={busy === r.id} onClick={() => setRestaurantOpen(r.id, !r.is_open)}
                    className="rounded-full border px-2.5 py-1 disabled:opacity-50">
                    {r.is_open ? "Close" : "Open"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "riders" && (
          <div className="space-y-2">
            {riders.length === 0 && <Empty>No riders in this zone.</Empty>}
            {sortedRiders.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.full_name ?? r.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{r.phone ?? "—"}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-[11px] font-bold">
                  <span className="rounded-full bg-secondary px-2 py-1 capitalize">{r.status}</span>
                  <span className={`rounded-full px-2 py-1 ${r.is_online ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>{r.is_online ? "Online" : "Offline"}</span>
                  {r.status !== "approved" && (
                    <button disabled={busy === r.user_id} onClick={() => setRiderStatus(r.user_id, "approved")}
                      className="rounded-full bg-success/10 px-2.5 py-1 text-success disabled:opacity-50">Approve</button>
                  )}
                  {r.status === "pending" && (
                    <button disabled={busy === r.user_id} onClick={() => setRiderStatus(r.user_id, "rejected")}
                      className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive disabled:opacity-50">Reject</button>
                  )}
                  {r.status === "approved" && (
                    <button disabled={busy === r.user_id} onClick={() => setRiderStatus(r.user_id, "suspended")}
                      className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-600 disabled:opacity-50">Suspend</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "customers" && (
          <div className="space-y-2">
            {customers.length === 0 && <Empty>No customers yet.</Empty>}
            {customers.map((c) => (
              <div key={c.user_id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.full_name ?? "Customer"}</p>
                  <p className="text-xs text-muted-foreground">{c.phone ?? "—"}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="font-bold">{c.orders_count} orders</p>
                  <p className="text-muted-foreground">{inr(Number(c.total_spent ?? 0))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
