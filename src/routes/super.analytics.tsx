import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";

export const Route = createFileRoute("/super/analytics")({ component: SuperAnalytics });

type O = { restaurant_id: string | null; items: any; total: number; status: string; created_at: string };

function SuperAnalytics() {
  const [orders, setOrders] = useState<O[]>([]);
  const [rmap, setRmap] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from("restaurants").select("id,name").then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { m[r.id] = r.name; });
      setRmap(m);
    });
    const start = new Date(); start.setDate(start.getDate() - 30);
    supabase.from("orders").select("restaurant_id,items,total,status,created_at").gte("created_at", start.toISOString()).then(({ data }) => setOrders((data ?? []) as O[]));
  }, []);

  const daily = useMemo(() => {
    const m: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      m[d.toISOString().slice(0, 10)] = 0;
    }
    orders.forEach(o => {
      if (o.status !== "delivered") return;
      const k = new Date(o.created_at).toISOString().slice(0, 10);
      if (k in m) m[k] += Number(o.total);
    });
    return Object.entries(m).map(([d, v]) => ({ day: d.slice(5), revenue: Math.round(v) }));
  }, [orders]);

  const topRestaurants = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach(o => { if (o.restaurant_id) m[o.restaurant_id] = (m[o.restaurant_id] ?? 0) + Number(o.total); });
    return Object.entries(m).map(([id, v]) => ({ name: rmap[id] ?? id.slice(0,6), revenue: Math.round(v) }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [orders, rmap]);

  const topItems = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach(o => {
      const items = Array.isArray(o.items) ? o.items : [];
      items.forEach((it: any) => { m[it.name] = (m[it.name] ?? 0) + (Number(it.qty) || 0); });
    });
    return Object.entries(m).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [orders]);

  const totalEarnings = orders.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </header>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Earnings (30d)</p>
        <p className="mt-2 text-4xl font-extrabold">₹{totalEarnings.toFixed(0)}</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-bold">Daily Revenue (last 7 days)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold">Top Restaurants</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRestaurants}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="mb-4 text-sm font-bold">Most Ordered Foods</p>
          <ul className="space-y-2">
            {topItems.map((it, i) => (
              <li key={it.name} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                <span><span className="mr-2 font-bold text-primary">#{i + 1}</span>{it.name}</span>
                <span className="font-semibold">{it.qty}×</span>
              </li>
            ))}
            {topItems.length === 0 && <p className="text-sm text-muted-foreground">No data yet</p>}
          </ul>
        </div>
      </div>
    </div>
  );
}
