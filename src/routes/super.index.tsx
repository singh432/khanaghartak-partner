import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Store, Users, ShoppingBag, IndianRupee, CheckCircle2, Clock, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/super/")({ component: SuperDashboard });

type Stats = {
  totalRestaurants: number; activeRestaurants: number; totalCustomers: number;
  totalOrders: number; totalRevenue: number;
  todayOrders: number; pendingOrders: number; deliveredOrders: number;
};

function SuperDashboard() {
  const [s, setS] = useState<Stats | null>(null);

  const load = async () => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const [restaurants, orders, today, profiles] = await Promise.all([
      supabase.from("restaurants").select("id,status"),
      supabase.from("orders").select("status,total"),
      supabase.from("orders").select("status,total").gte("created_at", startOfDay.toISOString()),
      supabase.from("profiles").select("id"),
    ]);
    const rs = restaurants.data ?? [];
    const allOrders = orders.data ?? [];
    const todayOrders = today.data ?? [];
    const revenue = allOrders.filter((o: any) => o.status === "delivered").reduce((s, o: any) => s + Number(o.total), 0);
    setS({
      totalRestaurants: rs.length,
      activeRestaurants: rs.filter((r: any) => r.status === "active").length,
      totalCustomers: profiles.data?.length ?? 0,
      totalOrders: allOrders.length,
      totalRevenue: revenue,
      todayOrders: todayOrders.length,
      pendingOrders: allOrders.filter((o: any) => ["placed", "accepted", "preparing", "ready_for_pickup", "out_for_delivery"].includes(o.status)).length,
      deliveredOrders: allOrders.filter((o: any) => o.status === "delivered").length,
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
