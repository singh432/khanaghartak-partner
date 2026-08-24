import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, ShoppingBag, CheckCircle2, XCircle, Clock, IndianRupee } from "lucide-react";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { inRange, rangeLabel, todayInputValue, type DateRange } from "@/lib/date-range";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

const COMMISSION_RATE = 0.15;

type Stats = { total: number; placed: number; accepted: number; preparing: number; out: number; delivered: number; rejected: number; revenue: number; foodSales: number; platformCut: number; deliveryFees: number };
type Lifetime = { orders: number; revenue: number; foodSales: number; platformCut: number };

function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [, setLifetime] = useState<Lifetime | null>(null);
  const [deliveredRows, setDeliveredRows] = useState<any[]>([]);
  const [range, setRange] = useState<DateRange>({ kind: "all", date: todayInputValue() });

  const period = useMemo(() => {
    const list = deliveredRows.filter((r) => inRange(r.created_at, range));
    const foodSales = list.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
    return { orders: list.length, foodSales };
  }, [deliveredRows, range]);

  const load = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data } = await supabase.rpc("owner_list_orders", { _limit: 1000, _since: start.toISOString() } as any);
    const rows = (data ?? []) as any[];
    const s: Stats = { total: rows.length, placed: 0, accepted: 0, preparing: 0, out: 0, delivered: 0, rejected: 0, revenue: 0, foodSales: 0, platformCut: 0, deliveryFees: 0 };
    for (const r of rows) {
      if (r.status === "placed") s.placed++;
      else if (r.status === "accepted") s.accepted++;
      else if (r.status === "preparing") s.preparing++;
      else if (r.status === "out_for_delivery") s.out++;
      else if (r.status === "delivered") {
        s.delivered++;
        s.revenue += Number(r.total);
        s.foodSales += Number(r.subtotal ?? 0);
        s.platformCut += Number(r.platform_fee ?? 0);
        s.deliveryFees += Number(r.delivery_fee ?? 0);
      }
      else if (r.status === "rejected") s.rejected++;
    }
    setStats(s);

    const { data: allRows } = await supabase.from("orders")
      .select("total,subtotal,platform_fee,created_at").eq("status", "delivered");
    const lt: Lifetime = { orders: 0, revenue: 0, foodSales: 0, platformCut: 0 };
    for (const r of allRows ?? []) {
      lt.orders++;
      lt.revenue += Number(r.total);
      lt.foodSales += Number(r.subtotal ?? 0);
      lt.platformCut += Number(r.platform_fee ?? 0);
    }
    setLifetime(lt);
    setDeliveredRows((allRows ?? []) as any[]);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Today's Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live snapshot of orders since midnight</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Orders" value={stats?.total ?? "—"} icon={ShoppingBag} tone="primary" />
        <StatCard label="Pending" value={stats?.placed ?? "—"} icon={Clock} tone="warn" pulse={!!stats?.placed} />
        <StatCard label="Accepted" value={(stats?.accepted ?? 0) + (stats?.preparing ?? 0) + (stats?.out ?? 0)} icon={CheckCircle2} tone="success" />
        <StatCard label="Rejected" value={stats?.rejected ?? "—"} icon={XCircle} tone="danger" />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm md:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Food Sales Today</p>
          <div className="mt-2 flex items-end gap-2">
            <IndianRupee className="mb-1 h-6 w-6 text-primary" />
            <span className="text-4xl font-extrabold tracking-tight">{Number(stats?.foodSales ?? 0).toFixed(0)}</span>
            <span className="mb-1 text-xs text-muted-foreground">from delivered orders</span>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In Kitchen</p>
          <p className="mt-2 text-3xl font-extrabold">{(stats?.preparing ?? 0) + (stats?.accepted ?? 0)}</p>
          <p className="text-xs text-muted-foreground">orders being prepared</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Earnings — {rangeLabel(range)} ({period.orders} delivered)</p>
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Money label="Your Food Sales" value={period.foodSales} strong />
          <Money label={`KhanaGharTak Cut (${Math.round(COMMISSION_RATE * 100)}%)`} value={period.foodSales * COMMISSION_RATE} tone="text-destructive" />
          <Money label="Your Net Payout" value={period.foodSales * (1 - COMMISSION_RATE)} tone="text-success" />
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          KhanaGharTak keeps {Math.round(COMMISSION_RATE * 100)}% of your food value; delivery fee goes to the rider. Today's food sales: ₹{Number(stats?.foodSales ?? 0).toFixed(0)} · today's cut: ₹{((stats?.foodSales ?? 0) * COMMISSION_RATE).toFixed(0)}.
        </p>
      </div>


      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</p>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          <Pill label="New" value={stats?.placed ?? 0} color="bg-primary/15 text-primary" />
          <Pill label="Accepted" value={stats?.accepted ?? 0} color="bg-blue-500/15 text-blue-600" />
          <Pill label="Preparing" value={stats?.preparing ?? 0} color="bg-amber-500/15 text-amber-600" />
          <Pill label="Out for Delivery" value={stats?.out ?? 0} color="bg-purple-500/15 text-purple-600" />
          <Pill label="Delivered" value={stats?.delivered ?? 0} color="bg-success/15 text-success" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, pulse }: { label: string; value: number | string; icon: typeof TrendingUp; tone: "primary" | "warn" | "success" | "danger"; pulse?: boolean }) {
  const map: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    warn: "bg-amber-500/10 text-amber-600",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
  };
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className={`relative flex h-8 w-8 items-center justify-center rounded-lg ${map[tone]}`}>
          <Icon className="h-4 w-4" />
          {pulse && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-ping rounded-full bg-destructive" />}
        </span>
      </div>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function Money({ label, value, tone, strong }: { label: string; value: number; tone?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 ${strong ? "text-2xl" : "text-xl"} font-extrabold tracking-tight ${tone ?? ""}`}>₹{Number(value).toFixed(0)}</p>
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${color}`}>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-base font-extrabold">{value}</span>
    </div>
  );
}
