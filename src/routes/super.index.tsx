import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, ShoppingBag, IndianRupee, CheckCircle2, Clock, TrendingUp, Wallet } from "lucide-react";
import { sumPayouts, inr, RIDER_SHARE_RATE, COMMISSION_RATE } from "@/lib/payouts";

export const Route = createFileRoute("/super/")({ component: SuperDashboard });

type Stats = {
  totalRestaurants: number; activeRestaurants: number; totalCustomers: number;
  totalOrders: number; totalRevenue: number;
  todayOrders: number; pendingOrders: number; deliveredOrders: number;
  payout: ReturnType<typeof sumPayouts>;
  perRestaurant: { id: string; name: string; orders: number; payable: number }[];
  perRider: { id: string; name: string; orders: number; cash: number; earning: number; due: number }[];
  riderTodayDue: number;
};

function SuperDashboard() {
  const [s, setS] = useState<Stats | null>(null);

  const load = async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [restaurants, orders, today, profiles, riderProfiles] = await Promise.all([
      supabase.from("restaurants").select("id,status,name"),
      supabase.from("orders").select("status,total,subtotal,platform_fee,restaurant_id,rider_id,payment_method,created_at"),
      supabase.from("orders").select("status,total").gte("created_at", startOfDay.toISOString()),
      supabase.from("profiles").select("id"),
      supabase.from("rider_profiles").select("user_id,full_name"),
    ]);
    const rs = restaurants.data ?? [];
    const allOrders = orders.data ?? [];
    const todayOrders = today.data ?? [];
    const delivered = allOrders.filter((o: any) => o.status === "delivered");
    const revenue = delivered.reduce((s, o: any) => s + Number(o.total), 0);
    const payout = sumPayouts(delivered as any);

    const nameById: Record<string, string> = {};
    rs.forEach((r: any) => { nameById[r.id] = r.name; });
    const byRest: Record<string, { orders: number; payable: number }> = {};
    delivered.forEach((o: any) => {
      const id = o.restaurant_id ?? "unknown";
      const cur = byRest[id] ?? { orders: 0, payable: 0 };
      cur.orders += 1;
      cur.payable += Number(o.subtotal ?? 0) * (1 - COMMISSION_RATE);
      byRest[id] = cur;
    });
    const perRestaurant = Object.entries(byRest)
      .map(([id, v]) => ({ id, name: nameById[id] ?? "Unknown", ...v }))
      .sort((a, b) => b.payable - a.payable);

    const riderNames: Record<string, string> = {};
    (riderProfiles.data ?? []).forEach((r: any) => { riderNames[r.user_id] = r.full_name ?? r.user_id.slice(0, 8); });
    const byRider: Record<string, { orders: number; cash: number; earning: number; due: number }> = {};
    delivered.filter((o: any) => o.rider_id).forEach((o: any) => {
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

    const riderTodayDue = sumPayouts(
      delivered.filter((o: any) => o.rider_id && new Date(o.created_at) >= startOfDay) as any,
    ).deposit;

    setS({
      totalRestaurants: rs.length,
      activeRestaurants: rs.filter((r: any) => r.status === "active").length,
      totalCustomers: profiles.data?.length ?? 0,
      totalOrders: allOrders.length,
      totalRevenue: revenue,
      todayOrders: todayOrders.length,
      pendingOrders: allOrders.filter((o: any) => ["placed", "accepted", "preparing", "ready_for_pickup", "out_for_delivery"].includes(o.status)).length,
      deliveredOrders: delivered.length,
      payout,
      perRestaurant,
      perRider,
      riderTodayDue,
    });
  };


  useEffect(() => { load(); }, []);


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
        <Card label="Avg Order" value={s && s.totalOrders ? `₹${Math.round(s.totalRevenue / Math.max(s.deliveredOrders, 1))}` : "—"} icon={TrendingUp} />
      </div>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold">Payouts (delivered orders)</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Money label="Payable to Restaurants" value={s?.payout.restaurant ?? 0} tone="success" hint="85% of food value, all restaurants" />
          <Money label="KhanaGharTak Earning" value={s?.payout.platformGross ?? 0} hint="15% commission + platform fee" />
          <Money label="Payable to Riders" value={s?.payout.rider ?? 0} tone="warn" hint={`${Math.round(RIDER_SHARE_RATE * 100)}% of KhanaGharTak earning`} />
          <Money label="KhanaGharTak Net" value={s?.payout.platformNet ?? 0} hint={`${Math.round((1 - RIDER_SHARE_RATE) * 100)}% after rider payout`} />
        </div>

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
                  <td className="py-2 font-bold">{s?.deliveredOrders}</td>
                  <td className="py-2 text-right font-extrabold">{inr(s?.payout.restaurant ?? 0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-amber-600" />
          <h2 className="text-sm font-bold">Cash to collect from riders</h2>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Money label="Cash Collected (COD)" value={s?.payout.cash ?? 0} hint="collected from customers on delivery" />
          <Money label="Riders Keep" value={s?.payout.rider ?? 0} tone="success" hint={`${Math.round(RIDER_SHARE_RATE * 100)}% of KhanaGharTak earning`} />
          <Money label="Recoverable from Riders" value={s?.payout.deposit ?? 0} tone="warn" hint={`Today: ${inr(s?.riderTodayDue ?? 0)}`} />
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
