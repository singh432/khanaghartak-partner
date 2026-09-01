import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Pause, Play, Search, Bike } from "lucide-react";

export const Route = createFileRoute("/super/riders")({ component: SuperRiders });

type R = {
  user_id: string; full_name: string | null; phone: string | null;
  vehicle: string | null; status: string; created_at: string;
};

function SuperRiders() {
  const [rows, setRows] = useState<R[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    const { data, error } = await (supabase.from("rider_profiles") as any)
      .select("user_id, full_name, phone, vehicle, status, created_at")
      .order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as R[]);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (user_id: string, status: string) => {
    const { error } = await supabase.rpc("set_rider_status" as any, { _user_id: user_id, _status: status });
    if (error) return toast.error(error.message);
    toast.success(`Rider ${status}`);
    load();
  };

  const rank = (s: string) => (s === "pending" ? 0 : s === "approved" ? 1 : 2);
  const filtered = rows
    .filter((r) => !q || (r.full_name ?? "").toLowerCase().includes(q.toLowerCase()) || (r.phone ?? "").includes(q))
    .slice()
    .sort((a, b) => rank(a.status) - rank(b.status));

  const pending = rows.filter((r) => r.status === "pending").length;
  const approved = rows.filter((r) => r.status === "approved").length;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight inline-flex items-center gap-2"><Bike className="h-6 w-6" /> Riders</h1>
          <p className="text-sm text-muted-foreground">{rows.length} total · {pending} pending · {approved} approved</p>
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
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.user_id} className="border-t">
                <td className="px-4 py-3 font-semibold">{r.full_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.vehicle ?? "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => setStatus(r.user_id, "approved")} className="rounded-lg bg-success/10 p-2 text-success" title="Approve"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setStatus(r.user_id, "rejected")} className="rounded-lg bg-destructive/10 p-2 text-destructive" title="Reject"><X className="h-4 w-4" /></button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button onClick={() => setStatus(r.user_id, "suspended")} className="rounded-lg bg-amber-500/10 p-2 text-amber-600" title="Suspend"><Pause className="h-4 w-4" /></button>
                    )}
                    {(r.status === "suspended" || r.status === "rejected") && (
                      <button onClick={() => setStatus(r.user_id, "approved")} className="rounded-lg bg-success/10 p-2 text-success" title="Approve"><Play className="h-4 w-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">No riders</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-success/15 text-success",
    pending: "bg-amber-500/15 text-amber-600",
    suspended: "bg-muted text-muted-foreground",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${map[status] ?? "bg-muted"}`}>{status}</span>;
}
