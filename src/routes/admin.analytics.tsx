import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

export const Route = createFileRoute("/admin/analytics")({ component: AdminAnalytics });

type O = { items: any; total: number; status: string; created_at: string };

function AdminAnalytics() {
  const [orders, setOrders] = useState<O[]>([]);

  useEffect(() => {
    const start = new Date(); start.setDate(start.getDate() - 30);
    supabase.rpc("owner_list_orders", { _limit: 1000, _since: start.toISOString() } as any)
      .then(({ data }) => setOrders((data ?? []) as unknown as O[]));
  }, []);

  const daily = useMemo(() => {
    const m: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); m[d.toISOString().slice(0,10)] = 0; }
    orders.forEach(o => { if (o.status !== "delivered") return; const k = new Date(o.created_at).toISOString().slice(0,10); if (k in m) m[k] += Number(o.total); });
    return Object.entries(m).map(([d, v]) => ({ day: d.slice(5), revenue: Math.round(v) }));
  }, [orders]);

  const topItems = useMemo(() => {
    const m: Record<string, number> = {};
    orders.forEach(o => { const items = Array.isArray(o.items) ? o.items : []; items.forEach((it: any) => { m[it.name] = (m[it.name] ?? 0) + (Number(it.qty) || 0); }); });
    return Object.entries(m).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 8);
  }, [orders]);

  const revenue = orders.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Last 30 days</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue (30d)</p>
          <p className="mt-1 text-3xl font-extrabold">₹{revenue.toFixed(0)}</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Orders (30d)</p>
          <p className="mt-1 text-3xl font-extrabold">{orders.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-bold">Daily Revenue (last 7 days)</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} /></LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-bold">Top Selling Items</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItems}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="qty" fill="hsl(var(--primary))" /></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
