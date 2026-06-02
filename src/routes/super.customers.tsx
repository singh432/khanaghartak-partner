import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Search, Ban, Eye } from "lucide-react";

export const Route = createFileRoute("/super/customers")({ component: SuperCustomers });

type P = { id: string; full_name: string | null; phone: string | null; created_at: string };
type O = { id: string; total: number; status: string; created_at: string };

function SuperCustomers() {
  const [rows, setRows] = useState<P[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, { n: number; total: number }>>({});
  const [view, setView] = useState<{ user: P; orders: O[] } | null>(null);

  const load = async () => {
    const [{ data: profiles }, { data: blocks }, { data: orders }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,phone,created_at").order("created_at", { ascending: false }),
      supabase.from("customer_blocks").select("user_id"),
      supabase.from("orders").select("user_id,total"),
    ]);
    setRows((profiles ?? []) as P[]);
    setBlocked(new Set((blocks ?? []).map((b: any) => b.user_id)));
    const m: Record<string, { n: number; total: number }> = {};
    (orders ?? []).forEach((o: any) => {
      if (!m[o.user_id]) m[o.user_id] = { n: 0, total: 0 };
      m[o.user_id].n++;
      m[o.user_id].total += Number(o.total);
    });
    setCounts(m);
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
