import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Flag, XCircle } from "lucide-react";
import { restaurantPayout, platformEarning } from "@/lib/payouts";

export const Route = createFileRoute("/super/orders")({ component: SuperOrders });

type O = {
  id: string; restaurant_id: string | null; customer_name: string;
  total: number; subtotal: number; platform_fee: number; delivery_fee: number;
  status: string; created_at: string; is_fake: boolean; user_id: string;
  rider_id: string | null;
};



type Range = "today" | "week" | "month" | "all";

function SuperOrders() {
  const [orders, setOrders] = useState<O[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, string>>({});
  const [riders, setRiders] = useState<Record<string, string>>({});
  const [range, setRange] = useState<Range>("today");
  const [rest, setRest] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [refresh, setRefresh] = useState(0);
  const [rejectFor, setRejectFor] = useState<O | null>(null);
  const [reason, setReason] = useState("");
  const [fakeFor, setFakeFor] = useState<O | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("restaurants").select("id,name").then(({ data }) => {
      const map: Record<string, string> = {};
      (data ?? []).forEach((r: any) => { map[r.id] = r.name; });
      setRestaurants(map);
    });
    (supabase.from("rider_profiles") as any)
      .select("user_id,full_name")
      .then(({ data }: { data: any[] | null }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((r: any) => { map[r.user_id] = r.full_name ?? r.user_id.slice(0, 8); });
        setRiders(map);
      });
  }, []);

  useEffect(() => {
    let q = supabase.from("orders").select("id,restaurant_id,customer_name,total,subtotal,platform_fee,delivery_fee,status,created_at,is_fake,user_id,rider_id").order("created_at", { ascending: false }).limit(500);
    if (range !== "all") {
      const d = new Date();
      if (range === "today") d.setHours(0, 0, 0, 0);
      else if (range === "week") d.setDate(d.getDate() - 7);
      else if (range === "month") d.setDate(d.getDate() - 30);
      q = q.gte("created_at", d.toISOString());
    }
    q.then(({ data }) => setOrders((data ?? []) as O[]));
  }, [range, refresh]);

  const runFlagFake = async (o: O, next: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("super_flag_fake_order", { _order_id: o.id, _fake: next });
    setBusy(false);
    setFakeFor(null);
    if (error) return toast.error(error.message);
    toast.success(next ? "Order marked as fake" : "Fake flag removed");
    setRefresh((n) => n + 1);
  };

  const flagFake = (o: O) => {
    if (!o.is_fake) return setFakeFor(o);
    void runFlagFake(o, false);
  };

  const confirmReject = async () => {
    if (!rejectFor) return;
    setBusy(true);
    const { error } = await supabase.rpc("super_cancel_order" as any, { _order_id: rejectFor.id, _reason: reason.trim() || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    setRejectFor(null);
    setReason("");
    toast.success("Order cancelled");
    setRefresh((n) => n + 1);
  };

  const closed = (s: string) => ["delivered", "cancelled", "rejected"].includes(s);

  const filtered = useMemo(() => orders.filter(o =>
    (rest === "all" || o.restaurant_id === rest) &&
    (status === "all" || o.status === status)
  ), [orders, rest, status]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">All Orders</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} orders</p>
      </header>

      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-3">
        <Select value={range} onChange={setRange as any} options={[["today","Today"],["week","This Week"],["month","This Month"],["all","All Time"]]} />
        <Select value={rest} onChange={setRest} options={[["all","All Restaurants"], ...Object.entries(restaurants)]} />
        <Select value={status} onChange={setStatus} options={[["all","All Statuses"],["placed","Placed"],["accepted","Accepted"],["preparing","Preparing"],["ready_for_pickup","Ready"],["out_for_delivery","Out"],["delivered","Delivered"],["cancelled","Cancelled"],["rejected","Rejected"]]} />
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Order ID</th><th className="px-4 py-3">Restaurant</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Restaurant ₹</th><th className="px-4 py-3">KhanaGharTak ₹</th><th className="px-4 py-3">Order ₹</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Rider</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td className="px-4 py-3">{restaurants[o.restaurant_id ?? ""] ?? "—"}</td>
                <td className="px-4 py-3">{o.customer_name}</td>
                <td className="px-4 py-3 font-semibold text-success">₹{restaurantPayout(o).toFixed(0)}</td>
                <td className="px-4 py-3 font-semibold text-primary">₹{platformEarning(o).toFixed(0)}</td>
                <td className="px-4 py-3 text-muted-foreground">₹{Number(o.total).toFixed(0)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{o.status.replace(/_/g, " ")}</span>
                  {o.is_fake && <span className="ml-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">Fake</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{o.rider_id ? riders[o.rider_id] ?? o.rider_id.slice(0, 8) : "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(o.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => flagFake(o)} title={o.is_fake ? "Unmark fake" : "Mark as fake"}
                      className={`rounded-lg p-2 ${o.is_fake ? "bg-destructive text-destructive-foreground" : "bg-secondary text-destructive"}`}>
                      <Flag className="h-4 w-4" />
                    </button>
                    {!closed(o.status) && (
                      <button onClick={() => { setRejectFor(o); setReason(""); }} title="Reject / cancel this order"
                        className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-2 text-xs font-bold text-destructive-foreground">
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No orders</td></tr>}
          </tbody>
        </table>
      </div>

      {rejectFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setRejectFor(null)}>
          <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Reject order</h2>
            <p className="mt-1 text-xs text-muted-foreground">Order {rejectFor.id.slice(0, 8)} · {rejectFor.customer_name}</p>
            <textarea
              autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="mt-3 h-24 w-full resize-none rounded-lg border bg-background p-2 text-sm outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setRejectFor(null)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Keep order</button>
              <button disabled={busy} onClick={confirmReject} className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60">
                {busy ? "Rejecting…" : "Reject order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fakeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setFakeFor(null)}>
          <div className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Mark as fake?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Two fake orders temporarily disable Cash on Delivery for this customer.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button disabled={busy} onClick={() => setFakeFor(null)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Cancel</button>
              <button disabled={busy} onClick={() => runFlagFake(fakeFor, true)} className="rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-60">
                {busy ? "Saving…" : "Mark fake"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border bg-card px-3 text-sm outline-none">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
