import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, ShoppingBag, IndianRupee, CheckCircle2, Clock, TrendingUp, Wallet, Map as MapIcon } from "lucide-react";
import { sumPayouts, inr, RIDER_SHARE_RATE, restaurantPayout } from "@/lib/payouts";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { inRange, rangeLabel, todayInputValue, type DateRange } from "@/lib/date-range";
import { fetchAll } from "@/lib/supabase-paged";
import { fetchAllZones, type DeliveryZone } from "@/lib/zones";

export const Route = createFileRoute("/super/")({ component: SuperDashboard });

type RawData = {
  restaurants: any[];
  allOrders: any[];
  riderProfiles: any[];
  profiles: any[];
  customerCount: number;
  loaded: boolean;
};

function SuperDashboard() {
  const [raw, setRaw] = useState<RawData>({ restaurants: [], allOrders: [], riderProfiles: [], profiles: [], customerCount: 0, loaded: false });
  const [payoutRange, setPayoutRange] = useState<DateRange>({ kind: "all", date: todayInputValue() });
  const [zones, setZones] = useState<DeliveryZone[]>([]);

  const load = async () => {
    const [restaurants, orders, customerCount, riderProfiles] = await Promise.all([
      fetchAll(() => supabase.from("restaurants").select("id,status,name")),
      fetchAll(() => supabase.from("orders").select("status,total,subtotal,platform_fee,delivery_fee,discount,restaurant_id,rider_id,payment_method,created_at,zone_id")),
      supabase.from("profiles").select("id", { count: "exact", head: true }).then(({ count }) => count ?? 0),
      fetchAll(() => supabase.from("rider_profiles").select("user_id,full_name")),
    ]);
    setRaw({
      restaurants,
      allOrders: orders,
      profiles: [],
      customerCount,
      riderProfiles,
      loaded: true,
    });
  };

  useEffect(() => { load(); fetchAllZones().then(setZones).catch(() => {}); }, []);

  const startOfDay = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const stats = useMemo(() => {
    const rs = raw.restaurants;
    const allOrders = raw.allOrders;
    const delivered = allOrders.filter((o: any) => o.status === "delivered");
    const filteredDelivered = delivered.filter((o: any) => inRange(o.created_at, payoutRange));

    const grossOrderValue = delivered.reduce((s, o: any) => s + Number(o.total), 0);
    const lifetimePayout = sumPayouts(delivered as any);
    const payout = sumPayouts(filteredDelivered as any);

    const nameById: Record<string, string> = {};
    rs.forEach((r: any) => { nameById[r.id] = r.name; });
    const byRest: Record<string, { orders: number; payable: number }> = {};
    filteredDelivered.forEach((o: any) => {
      const id = o.restaurant_id ?? "unknown";
      const cur = byRest[id] ?? { orders: 0, payable: 0 };
      cur.orders += 1;
      cur.payable += restaurantPayout(o as any);
      byRest[id] = cur;
    });
    const perRestaurant = Object.entries(byRest)
      .map(([id, v]) => ({ id, name: nameById[id] ?? "Unknown", ...v }))
      .sort((a, b) => b.payable - a.payable);

    const riderNames: Record<string, string> = {};
    (raw.riderProfiles ?? []).forEach((r: any) => { riderNames[r.user_id] = r.full_name ?? r.user_id.slice(0, 8); });
    const byRider: Record<string, { orders: number; cash: number; earning: number; due: number }> = {};
    filteredDelivered.filter((o: any) => o.rider_id).forEach((o: any) => {
      const id = o.rider_id as string;
      const cur = byRider[id] ?? { orders: 0, cash: 0, earning: 0, due: 0 };
      const one = sumPayouts([o]);
      cur.orders += 1;
      cur.cash += one.cash;
      cur.earning += one.rider;
      cur.due += one.deposit;
      byRider[id] = cur;
    });
    const perRider = Object.entries(byRider)
      .map(([id, v]) => ({ id, name: riderNames[id] ?? id.slice(0, 8), ...v }))
      .sort((a, b) => b.due - a.due);

    // Zone-wise performance for the selected range
    const zoneName: Record<string, string> = {};
    zones.forEach((z) => { zoneName[z.id] = z.name; });
    const byZone: Record<string, { orders: number; delivered: number; cancelled: number; revenue: number; net: number }> = {};
    allOrders.filter((o: any) => inRange(o.created_at, payoutRange)).forEach((o: any) => {
      const id = (o.zone_id as string) ?? "unassigned";
      const cur = byZone[id] ?? { orders: 0, delivered: 0, cancelled: 0, revenue: 0, net: 0 };
      cur.orders += 1;
      if (o.status === "delivered") {
        cur.delivered += 1;
        cur.revenue += Number(o.total ?? 0);
        cur.net += sumPayouts([o] as any).platformNet;
      }
      if (o.status === "cancelled" || o.status === "rejected") cur.cancelled += 1;
      byZone[id] = cur;
    });
    const perZone = Object.entries(byZone)
      .map(([id, v]) => ({ id, name: zoneName[id] ?? "Unassigned", ...v }))
      .sort((a, b) => b.revenue - a.revenue);

    const todayOrders = allOrders.filter((o: any) => new Date(o.created_at) >= startOfDay);
    const riderTodayDue = sumPayouts(
      delivered.filter((o: any) => o.rider_id && new Date(o.created_at) >= startOfDay) as any,
    ).deposit;

    return {
      totalRestaurants: rs.length,
      activeRestaurants: rs.filter((r: any) => r.status === "active").length,
      totalCustomers: raw.customerCount,
      totalOrders: allOrders.length,
      totalRevenue: lifetimePayout.platformGross,
      grossOrderValue,
      todayOrders: todayOrders.length,
      pendingOrders: allOrders.filter((o: any) => ["placed", "accepted", "preparing", "ready_for_pickup", "out_for_delivery"].includes(o.status)).length,
      deliveredOrders: delivered.length,
      filteredDeliveredCount: filteredDelivered.length,
      payout,
      perRestaurant,
      perRider,
      perZone,
      riderTodayDue,
    };
  }, [raw, payoutRange, startOfDay, zones]);

  const s = raw.loaded ? stats : null;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Platform Overview</h1>
        <p className="text-sm text-muted-foreground">All restaurants, orders, and customers across KhanaGharTak</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Total Restaurants" value={s?.totalRestaurants ?? "—"} icon={Store} />
        <Card label="Active Restaurants" value={s?.activeRestaurants ?? "—"} icon={CheckCircle2} tone="success" />
        <Card label="Total Customers" value={s?.totalCustomers ?? "—"} icon={Users} />
        <Card label="Total Orders" value={s?.totalOrders ?? "—"} icon={ShoppingBag} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Platform Revenue</p>
          <div className="mt-2 flex items-end gap-2">
            <IndianRupee className="mb-1 h-6 w-6 text-primary" />
            <span className="text-4xl font-extrabold tracking-tight">{Number(s?.totalRevenue ?? 0).toFixed(0)}</span>
            <span className="mb-1 text-xs text-muted-foreground">from delivered orders</span>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's Orders</p>
          <p className="mt-2 text-3xl font-extrabold">{s?.todayOrders ?? "—"}</p>
          <p className="text-xs text-muted-foreground">since midnight</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card label="Pending" value={s?.pendingOrders ?? "—"} icon={Clock} tone="warn" />
        <Card label="Delivered" value={s?.deliveredOrders ?? "—"} icon={CheckCircle2} tone="success" />
        <Card label="Avg Order" value={s && s.totalOrders ? `₹${Math.round(s.grossOrderValue / Math.max(s.deliveredOrders, 1))}` : "—"} icon={TrendingUp} />
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapIcon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Zone-wise performance — {rangeLabel(payoutRange)}</h2>
          </div>
          <DateRangeFilter value={payoutRange} onChange={setPayoutRange} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Zone</th><th className="py-2">Orders</th><th className="py-2">Delivered</th>
                <th className="py-2">Cancelled</th><th className="py-2 text-right">Revenue</th><th className="py-2 text-right">Net profit</th>
              </tr>
            </thead>
            <tbody>
              {(s?.perZone ?? []).map((z) => (
                <tr key={z.id} className="border-t">
                  <td className="py-2 font-medium">{z.name}</td>
                  <td className="py-2 text-muted-foreground">{z.orders}</td>
                  <td className="py-2 text-muted-foreground">{z.delivered}</td>
                  <td className="py-2 text-muted-foreground">{z.cancelled}</td>
                  <td className="py-2 text-right font-bold">{inr(z.revenue)}</td>
                  <td className="py-2 text-right font-bold text-success">{inr(z.net)}</td>
                </tr>
              ))}
              {(s?.perZone.length ?? 0) === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No orders in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Payouts — {rangeLabel(payoutRange)}</h2>
          </div>
          <DateRangeFilter value={payoutRange} onChange={setPayoutRange} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Money label="Customer Payments" value={s?.payout.orderTotal ?? 0} hint="actual amount paid on delivered orders" />
          <Money label="Payable to Restaurants" value={s?.payout.restaurant ?? 0} tone="success" hint="85% of food value" />
          <Money label="Gross Platform Revenue" value={s?.payout.platformGross ?? 0} hint="15% commission + platform fee + delivery fee" />
          <Money label="Customer Discounts" value={-(s?.payout.discount ?? 0)} tone="warn" hint="funded by KhanaGharTak; never counted as earning" />
          {(s?.payout.adjustment ?? 0) !== 0 && <Money label="Other Adjustments" value={s?.payout.adjustment ?? 0} tone="warn" hint="stored payment variance requiring review" />}
          <Money label="Actual Platform Earning" value={s?.payout.platformActual ?? 0} hint="customer payments minus restaurant payable" />
          <Money label="Payable to Riders" value={s?.payout.rider ?? 0} tone="warn" hint={`${Math.round(RIDER_SHARE_RATE * 100)}% of gross platform revenue`} />
          <Money label="KhanaGharTak Final Net" value={s?.payout.platformNet ?? 0} hint="actual earning after rider payout" />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Reconciliation: customer payments − restaurant payable − rider payout = final net. Gross revenue − discounts + other adjustments = actual platform earning.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="py-2">Restaurant</th><th className="py-2">Delivered</th><th className="py-2 text-right">Payable</th></tr>
            </thead>
            <tbody>
              {(s?.perRestaurant ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2 text-muted-foreground">{r.orders}</td>
                  <td className="py-2 text-right font-bold text-success">{inr(r.payable)}</td>
                </tr>
              ))}
              {(s?.perRestaurant.length ?? 0) === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-sm text-muted-foreground">No delivered orders yet</td></tr>
              )}
              {(s?.perRestaurant.length ?? 0) > 0 && (
                <tr className="border-t bg-secondary/40">
                  <td className="py-2 font-bold">Total</td>
                  <td className="py-2 font-bold">{s?.filteredDeliveredCount}</td>
                  <td className="py-2 text-right font-extrabold">{inr(s?.payout.restaurant ?? 0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-bold">Cash to collect from riders — {rangeLabel(payoutRange)}</h2>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Money label="Cash Collected (COD)" value={s?.payout.cash ?? 0} hint="collected from customers on delivery" />
          <Money label="Riders Keep" value={s?.payout.rider ?? 0} tone="success" hint={`${Math.round(RIDER_SHARE_RATE * 100)}% of gross platform revenue`} />
          <Money label="Recoverable from Riders" value={s?.payout.deposit ?? 0} tone="warn" hint={payoutRange.kind === "today" ? "today's COD minus rider share" : `Today: ${inr(s?.riderTodayDue ?? 0)}`} />
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2">Rider</th><th className="py-2">Delivered</th>
                <th className="py-2 text-right">Cash Collected</th><th className="py-2 text-right">Rider Cut</th><th className="py-2 text-right">To Collect</th>
              </tr>
            </thead>
            <tbody>
              {(s?.perRider ?? []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2 font-medium">{r.name}</td>
                  <td className="py-2 text-muted-foreground">{r.orders}</td>
                  <td className="py-2 text-right">{inr(r.cash)}</td>
                  <td className="py-2 text-right text-success">{inr(r.earning)}</td>
                  <td className="py-2 text-right font-bold text-amber-600">{inr(r.due)}</td>
                </tr>
              ))}
              {(s?.perRider.length ?? 0) === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No rider deliveries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone?: "success" | "warn" }) {
  const c = tone === "success" ? "bg-success/10 text-success" : tone === "warn" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary";
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${c}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function Money({ label, value, tone, hint }: { label: string; value: number; tone?: "success" | "warn"; hint?: string }) {
  const c = tone === "success" ? "text-success" : tone === "warn" ? "text-amber-600" : "text-primary";
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold tracking-tight ${c}`}>{inr(value)}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
