import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Search, Ban, Eye } from "lucide-react";
import { fetchAll } from "@/lib/supabase-paged";
import { inr } from "@/lib/payouts";

export const Route = createFileRoute("/super/customers")({
  component: SuperCustomers,
  head: () => ({
    meta: [
      { title: "Customers & Analytics — KhanaGharTak Super Admin" },
      { name: "description", content: "Customer list plus conversion, repeat-rate, delivered/cancelled and average order value analytics." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Customers & Analytics — KhanaGharTak Super Admin" },
      { property: "og:description", content: "Customer list plus conversion, repeat-rate, delivered/cancelled and average order value analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type P = { id: string; full_name: string | null; phone: string | null; created_at: string };
type O = { id: string; total: number; status: string; created_at: string };

function SuperCustomers() {
  const [rows, setRows] = useState<P[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, { n: number; total: number }>>({});
  const [view, setView] = useState<{ user: P; orders: O[] } | null>(null);
  const [orderRows, setOrderRows] = useState<{ user_id: string; total: number; status: string }[]>([]);

  const load = async () => {
    const [profiles, blocks, orders] = await Promise.all([
      fetchAll<P>(() => supabase.from("profiles").select("id,full_name,phone,created_at").order("created_at", { ascending: false })),
      fetchAll(() => supabase.from("customer_blocks").select("user_id")),
      fetchAll(() => supabase.from("orders").select("user_id,total,status")),
    ]);
    setRows(profiles);
    setBlocked(new Set((blocks ?? []).map((b: any) => b.user_id)));
    const m: Record<string, { n: number; total: number }> = {};
    orders.forEach((o: any) => {
      if (!m[o.user_id]) m[o.user_id] = { n: 0, total: 0 };
      m[o.user_id].n++;
      m[o.user_id].total += Number(o.total);
    });
    setCounts(m);
    setOrderRows(orders as any);
  };

  useEffect(() => { load(); }, []);

  const toggleBlock = async (id: string) => {
    if (blocked.has(id)) {
      const { error } = await supabase.from("customer_blocks").delete().eq("user_id", id);
      if (error) return toast.error(error.message);
      toast.success("Unblocked");
    } else {
      const reason = prompt("Reason for blocking?") ?? "";
      const { error } = await supabase.from("customer_blocks").insert({ user_id: id, reason });
      if (error) return toast.error(error.message);
      toast.success("Blocked");
    }
    load();
  };

  const viewHistory = async (u: P) => {
    const { data } = await supabase.from("orders").select("id,total,status,created_at").eq("user_id", u.id).order("created_at", { ascending: false });
    setView({ user: u, orders: (data ?? []) as O[] });
  };

  const analytics = (() => {
    const totalCustomers = rows.length;
    const ordering = new Map<string, number>();
    orderRows.forEach((o) => ordering.set(o.user_id, (ordering.get(o.user_id) ?? 0) + 1));
    const withOrders = ordering.size;
    const repeat = [...ordering.values()].filter((n) => n > 1).length;
    const delivered = orderRows.filter((o) => o.status === "delivered");
    const cancelled = orderRows.filter((o) => ["cancelled", "rejected"].includes(o.status)).length;
    const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
    return {
      totalCustomers,
      conversion: totalCustomers ? Math.round((withOrders / totalCustomers) * 100) : 0,
      withOrders,
      repeat,
      repeatRate: withOrders ? Math.round((repeat / withOrders) * 100) : 0,
      delivered: delivered.length,
      cancelled,
      aov: delivered.length ? revenue / delivered.length : 0,
    };
  })();

  const filtered = rows.filter(r => !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (r.phone ?? "").includes(q));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">{rows.length} registered</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone"
            className="h-10 w-72 rounded-xl border bg-card pl-9 pr-3 text-sm outline-none" />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Metric label="Total customers" value={String(analytics.totalCustomers)} />
        <Metric label="First-order conversion" value={`${analytics.conversion}%`} hint={`${analytics.withOrders} ordered`} />
        <Metric label="Repeat customers" value={String(analytics.repeat)} hint={`${analytics.repeatRate}% of buyers`} />
        <Metric label="Delivered orders" value={String(analytics.delivered)} />
        <Metric label="Cancelled orders" value={String(analytics.cancelled)} />
        <Metric label="Average order value" value={inr(analytics.aov)} />
      </section>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Spent</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const c = counts[r.id] ?? { n: 0, total: 0 };
              const isBlocked = blocked.has(r.id);
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">{r.full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">{c.n}</td>
                  <td className="px-4 py-3 font-semibold">₹{c.total.toFixed(0)}</td>
                  <td className="px-4 py-3">
                    {isBlocked ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">Blocked</span>
                      : <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-bold text-success">Active</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => viewHistory(r)} className="rounded-lg bg-secondary p-2" title="History"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => toggleBlock(r.id)} className={`rounded-lg p-2 ${isBlocked ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`} title={isBlocked ? "Unblock" : "Block"}>
                        <Ban className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No customers</td></tr>}
          </tbody>
        </table>
      </div>

      {view && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setView(null)}>
          <div className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{view.user.full_name}</h2>
            <p className="text-xs text-muted-foreground">{view.user.phone}</p>
            <div className="mt-4 space-y-2">
              {view.orders.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{o.id.slice(0, 8)}</span>
                  <span className="capitalize">{o.status.replace(/_/g, " ")}</span>
                  <span className="font-semibold">₹{Number(o.total).toFixed(0)}</span>
                </div>
              ))}
              {view.orders.length === 0 && <p className="text-center text-sm text-muted-foreground">No orders yet</p>}
            </div>
            <button onClick={() => setView(null)} className="mt-5 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
