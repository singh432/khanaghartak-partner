import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { platformNetEarning } from "@/lib/payouts";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { FUNNEL_STEPS } from "@/lib/analytics";

export const Route = createFileRoute("/super/analytics")({ component: SuperAnalytics });

type O = { restaurant_id: string | null; items: any; total: number; subtotal: number; platform_fee: number; delivery_fee: number; status: string; created_at: string };
type Ev = { event: string; session_id: string; user_id: string | null; device: string | null; created_at: string };

type Preset = "today" | "yesterday" | "7d" | "30d" | "custom";

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function presetBounds(preset: Preset, from: string, to: string): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  const plus = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  if (preset === "today") return { from: today, to: plus(today, 1) };
  if (preset === "yesterday") return { from: plus(today, -1), to: today };
  if (preset === "7d") return { from: plus(today, -6), to: plus(today, 1) };
  if (preset === "30d") return { from: plus(today, -29), to: plus(today, 1) };
  const f = from ? new Date(`${from}T00:00:00`) : plus(today, -6);
  const t = to ? plus(new Date(`${to}T00:00:00`), 1) : plus(today, 1);
  return { from: f, to: t };
}

function SuperAnalytics() {
  const [orders, setOrders] = useState<O[]>([]);
  const [rmap, setRmap] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Ev[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [preset, setPreset] = useState<Preset>("7d");
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date()));

  const bounds = useMemo(() => presetBounds(preset, from, to), [preset, from, to]);

  useEffect(() => {
    supabase.from("restaurants").select("id,name").then(({ data }) => {
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { m[r.id] = r.name; });
      setRmap(m);
    });
    const start = new Date(); start.setDate(start.getDate() - 30);
    supabase.from("orders").select("restaurant_id,items,total,subtotal,platform_fee,delivery_fee,status,created_at").gte("created_at", start.toISOString()).then(({ data }) => setOrders((data ?? []) as O[]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingEvents(true);
    supabase
      .from("analytics_events")
      .select("event,session_id,user_id,device,created_at")
      .gte("created_at", bounds.from.toISOString())
      .lt("created_at", bounds.to.toISOString())
      .order("created_at", { ascending: false })
      .limit(50000)
      .then(({ data }) => {
        if (cancelled) return;
        setEvents((data ?? []) as Ev[]);
        setLoadingEvents(false);
      });
    return () => { cancelled = true; };
  }, [bounds.from, bounds.to]);

  const funnel = useMemo(() => {
    const rows = FUNNEL_STEPS.map((s) => {
      const evs = events.filter((e) => e.event === s.event);
      const users = new Set(evs.map((e) => e.user_id ?? e.session_id)).size;
      const last = evs[0]?.created_at ?? null;
      const mobile = new Set(evs.filter((e) => e.device === "mobile").map((e) => e.session_id)).size;
      const desktop = new Set(evs.filter((e) => e.device !== "mobile").map((e) => e.session_id)).size;
      return { ...s, users, events: evs.length, last, mobile, desktop };
    });
    const top = rows[0]?.users ?? 0;
    return rows.map((r, i) => {
      const prev = i === 0 ? r.users : rows[i - 1].users;
      const conv = prev > 0 ? (r.users / prev) * 100 : 0;
      return {
        ...r,
        conv: i === 0 ? 100 : conv,
        drop: i === 0 ? 0 : 100 - conv,
        lost: i === 0 ? 0 : Math.max(0, prev - r.users),
        ofTop: top > 0 ? (r.users / top) * 100 : 0,
      };
    });
  }, [events]);

  const biggestDrop = useMemo(() => {
    const c = funnel.slice(1).sort((a, b) => b.lost - a.lost)[0];
    return c && c.lost > 0 ? c : null;
  }, [funnel]);

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
    return Object.entries(m).map(([id, v]) => ({ name: rmap[id] ?? id.slice(0, 6), revenue: Math.round(v) }))
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

  const totalEarnings = orders.filter(o => o.status === "delivered").reduce((s, o) => s + platformNetEarning(o as any), 0);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Customer conversion funnel & revenue</p>
      </header>

      {/* ---- Funnel filters ---- */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3 shadow-sm">
        {([["today", "Today"], ["yesterday", "Yesterday"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Custom"]] as [Preset, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setPreset(k)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${preset === k ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground/80"}`}>
            {label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={from} max={iso(new Date())} onChange={(e) => setFrom(e.target.value)}
              aria-label="From date" className="h-9 rounded-lg border bg-background px-2 text-xs outline-none" />
            <span className="text-xs text-muted-foreground">to</span>
            <input type="date" value={to} max={iso(new Date())} onChange={(e) => setTo(e.target.value)}
              aria-label="To date" className="h-9 rounded-lg border bg-background px-2 text-xs outline-none" />
          </div>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {bounds.from.toLocaleDateString("en-IN")} – {new Date(bounds.to.getTime() - 1).toLocaleDateString("en-IN")}
        </span>
      </div>

      {/* ---- Funnel visual ---- */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Conversion Funnel</p>
          <p className="text-[11px] text-muted-foreground">{loadingEvents ? "Loading…" : `${events.length} events`}</p>
        </div>

        {biggestDrop && (
          <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
            Biggest drop-off: {biggestDrop.label} — {biggestDrop.lost} users lost ({biggestDrop.drop.toFixed(1)}%)
          </p>
        )}

        <div className="space-y-2">
          {funnel.map((s, i) => (
            <div key={s.event}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">{i + 1}. {s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.users} users · {s.events} events · {s.conv.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-4 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(s.ofTop, s.users > 0 ? 2 : 0)}%` }} />
              </div>
            </div>
          ))}
          {!loadingEvents && events.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No tracked activity in this period yet.</p>
          )}
        </div>
      </div>

      {/* ---- Funnel table ---- */}
      <div className="overflow-x-auto rounded-2xl border bg-card p-5 shadow-sm">
        <p className="mb-4 text-sm font-bold">Step details</p>
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="py-2">Step</th>
              <th className="py-2">Users</th>
              <th className="py-2">Events</th>
              <th className="py-2">Conv. from prev</th>
              <th className="py-2">Drop-off</th>
              <th className="py-2">Mobile / Desktop</th>
              <th className="py-2">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((s, i) => (
              <tr key={s.event} className="border-b last:border-0">
                <td className="py-2 font-semibold">{i + 1}. {s.label}</td>
                <td className="py-2 tabular-nums">{s.users}</td>
                <td className="py-2 tabular-nums">{s.events}</td>
                <td className="py-2 tabular-nums">{i === 0 ? "—" : `${s.conv.toFixed(1)}%`}</td>
                <td className={`py-2 tabular-nums ${s.drop > 50 ? "font-bold text-destructive" : ""}`}>
                  {i === 0 ? "—" : `${s.drop.toFixed(1)}% (${s.lost})`}
                </td>
                <td className="py-2 tabular-nums">{s.mobile} / {s.desktop}</td>
                <td className="py-2">{fmt(s.last)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- Revenue (existing) ---- */}
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
