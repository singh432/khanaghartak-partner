import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Power, Trash2, Search } from "lucide-react";

export const Route = createFileRoute("/super/restaurants")({ component: SuperRestaurants });

type R = {
  id: string; name: string; owner_id: string | null; phone: string | null;
  address: string | null; status: string; is_open: boolean | null;
};

function SuperRestaurants() {
  const [rows, setRows] = useState<R[]>([]);
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = async () => {
    const { data } = await supabase.from("restaurants").select("id,name,owner_id,address,status,is_open,created_at").order("created_at", { ascending: false });
    const { data: phones } = await supabase.rpc("super_list_restaurant_phones" as any);
    const pmap: Record<string, string | null> = {};
    ((phones ?? []) as any[]).forEach((p) => { pmap[p.id] = p.phone; });
    setRows(((data ?? []) as any[]).map((r) => ({ ...r, phone: pmap[r.id] ?? null })) as R[]);
    const { data: oc } = await supabase.from("orders").select("restaurant_id");
    const map: Record<string, number> = {};
    (oc ?? []).forEach((o: any) => { if (o.restaurant_id) map[o.restaurant_id] = (map[o.restaurant_id] ?? 0) + 1; });
    setCounts(map);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("restaurants").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Restaurant ${status}`);
    load();
  };

  const setOpen = async (id: string, is_open: boolean) => {
    const { error } = await supabase.from("restaurants").update({ is_open }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(is_open ? "Restaurant opened" : "Restaurant closed");
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this restaurant and all its menu/orders linkage?")) return;
    const { error } = await supabase.from("restaurants").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Restaurant deleted");
    load();
  };

  const filtered = rows.filter((r) =>
    !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.phone ?? "").includes(q)
  );

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Restaurants</h1>
          <p className="text-sm text-muted-foreground">{rows.length} total · {rows.filter(r => r.status === "active").length} active</p>
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
            <tr><th className="px-4 py-3">Restaurant</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Orders</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground truncate max-w-[260px]">{r.address ?? "—"}</td>
                <td className="px-4 py-3">{counts[r.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => setStatus(r.id, "active")} className="rounded-lg bg-success/10 p-2 text-success" title="Approve"><Check className="h-4 w-4" /></button>
                        <button onClick={() => setStatus(r.id, "rejected")} className="rounded-lg bg-destructive/10 p-2 text-destructive" title="Reject"><X className="h-4 w-4" /></button>
                      </>
                    )}
                    {r.status === "active" && (
                      <button onClick={() => setStatus(r.id, "inactive")} className="rounded-lg bg-amber-500/10 p-2 text-amber-600" title="Deactivate"><Power className="h-4 w-4" /></button>
                    )}
                    {r.status === "inactive" && (
                      <button onClick={() => setStatus(r.id, "active")} className="rounded-lg bg-success/10 p-2 text-success" title="Activate"><Power className="h-4 w-4" /></button>
                    )}
                    <button onClick={() => del(r.id)} className="rounded-lg bg-destructive/10 p-2 text-destructive" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No restaurants</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-success/15 text-success",
    pending: "bg-amber-500/15 text-amber-600",
    inactive: "bg-muted text-muted-foreground",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${map[status] ?? "bg-muted"}`}>{status}</span>;
}
