import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Search, Bell, X, Eye } from "lucide-react";
import { firePartnerOrderAlert, silencePartnerOrderAlert } from "@/components/PartnerNotificationListener";

export const Route = createFileRoute("/admin/orders")({ component: AdminOrders });

type Order = {
  id: string; status: string; total: number; subtotal: number;
  delivery_fee: number; platform_fee: number; distance_km: number | null;
  customer_name: string;
  notes: string | null;
  items: { name: string; qty: number; price: number }[];
  rejection_reason: string | null;
  created_at: string;
};

const ORDER_COLUMNS =
  "id,status,total,subtotal,delivery_fee,platform_fee,distance_km,notes,items,rejection_reason,created_at";

function pick(row: Record<string, unknown>): Order {
  const o: Record<string, unknown> = {};
  for (const k of ORDER_COLUMNS.split(",")) o[k] = row[k];
  o.customer_name = (row["customer_first_name"] as string) || "Customer";
  let items = row["items"];
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  o.items = Array.isArray(items) ? (items as any[]) : [];
  return o as unknown as Order;
}

const STATUSES = ["placed", "accepted", "preparing", "out_for_delivery", "delivered", "rejected"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABEL: Record<Status, string> = {
  placed: "New", accepted: "Accepted", preparing: "Preparing",
  out_for_delivery: "Ready for Delivery", delivered: "Delivered", rejected: "Rejected",
};

function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let active = true;
    const seen = new Set<string>();
    let first = true;

    const load = async () => {
      const { data } = await supabase.rpc("owner_list_orders", { _limit: 200 } as any);
      if (!active) return;
      const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map(pick);
      const fresh = rows.filter((o) => !seen.has(o.id) && o.status === "placed");
      rows.forEach((o) => seen.add(o.id));
      setOrders(rows);
      if (fresh.length > 0) {
        for (const o of fresh) {
          firePartnerOrderAlert(
            o.id,
            "restaurant",
            "🚨 NEW ORDER RECEIVED!",
            `Order #${o.id.slice(0, 8).toUpperCase()} from ${o.customer_name} · ₹${o.total}`,
            "/admin/orders"
          );
        }
      } else {
        const remainingPlaced = rows.filter((o) => o.status === "placed");
        if (remainingPlaced.length === 0) {
          silencePartnerOrderAlert();
        }
      }
      first = false;
    };

    load();
    const t = setInterval(load, 8000);
    window.addEventListener("kgt:partner-order-alert", load);
    return () => {
      active = false;
      clearInterval(t);
      window.removeEventListener("kgt:partner-order-alert", load);
    };
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const filtered = useMemo(() => orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (q && !o.id.toLowerCase().includes(q.toLowerCase()) &&
        !o.customer_name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [orders, filter, q]);

  const updateStatus = async (id: string, status: Status, rejectionReason?: string | null) => {
    silencePartnerOrderAlert();
    const { error } = await supabase.rpc("owner_update_order_status", {
      _order_id: id, _status: status, _reason: rejectionReason ?? null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(`Order marked ${STATUS_LABEL[status]}`);
    setOrders((cur) => cur.map((o) => (o.id === id ? { ...o, status, rejection_reason: rejectionReason ?? o.rejection_reason } : o)));
  };

  const submitReject = async () => {
    if (!rejecting) return;
    await updateStatus(rejecting, "rejected", reason.trim() || null);
    setRejecting(null); setReason("");
  };


  return (
    <div className="pb-10">
      <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/03/15/audio_1842b29254.mp3" preload="auto" />

      <div className="space-y-3 p-4 md:p-6">
        <header className="hidden md:block">
          <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
            <Bell className="h-3 w-3 text-success" /> Receiving live orders
          </p>
        </header>

        <div className="flex items-center gap-2 rounded-xl border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60}
            placeholder="Search by order ID or customer name"
            className="h-10 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip on={filter === "all"} onClick={() => setFilter("all")}>All ({orders.length})</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} on={filter === s} onClick={() => setFilter(s)}>
              {STATUS_LABEL[s]} ({orders.filter((o) => o.status === s).length})
            </Chip>
          ))}
        </div>

        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="py-16 text-center text-sm text-muted-foreground">No orders match.</p>
          )}
          {filtered.map((o) => (
            <article
              key={o.id}
              data-order-id={o.id}
              data-order-items={JSON.stringify(o.items || [])}
              onClick={() => setSelectedOrder(o)}
              className="group relative cursor-pointer rounded-2xl border bg-card p-4 shadow-sm transition-all hover:border-primary/50 hover:shadow-md active:scale-[0.995]"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs font-bold">#{o.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-base font-semibold leading-tight">{o.customer_name}</p>
                  <p className="text-xs text-muted-foreground">Contact &amp; address shared with the rider</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${o.status === "placed" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {STATUS_LABEL[o.status as Status]}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOrder(o);
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Eye className="h-3 w-3" /> View Details
                  </button>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>

              {o.notes && <p className="mt-2 rounded-lg bg-accent px-2 py-1 text-xs">Note: {o.notes}</p>}
              {o.rejection_reason && <p className="mt-2 rounded-lg bg-destructive/10 px-2 py-1 text-xs text-destructive">Rejected: {o.rejection_reason}</p>}

              <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between py-0.5">
                    <span>{it.qty}× {it.name}</span>
                    <span className="font-semibold">₹{(it.price * it.qty).toFixed(0)}</span>
                  </div>
                ))}
                <div className="my-2 h-px bg-border" />
                <div className="flex justify-between text-sm font-bold"><span>Items total</span><span>₹{Number(o.subtotal).toFixed(0)}</span></div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                {o.status === "placed" && (<>
                  <Action onClick={() => updateStatus(o.id, "accepted")} primary>Accept</Action>
                  <Action onClick={() => { setRejecting(o.id); setReason(""); }} danger>Reject</Action>
                </>)}
                {o.status === "accepted" && <Action onClick={() => updateStatus(o.id, "preparing")} primary>Mark Preparing</Action>}
                {o.status === "preparing" && <Action onClick={() => updateStatus(o.id, "out_for_delivery")} primary>Ready for Delivery</Action>}
                {o.status === "out_for_delivery" && (
                  <p className="col-span-2 rounded-xl bg-secondary py-2.5 text-center text-xs font-semibold text-muted-foreground">
                    Waiting for the rider to mark it delivered
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="font-mono text-xs font-bold text-muted-foreground">Order #{selectedOrder.id.slice(0, 8).toUpperCase()}</p>
                <h3 className="text-base font-extrabold text-foreground">{selectedOrder.customer_name}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full bg-secondary p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-secondary/60 p-3 flex justify-between items-center text-xs">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Status</p>
                <span className="font-extrabold capitalize text-primary text-sm">{STATUS_LABEL[selectedOrder.status as Status] ?? selectedOrder.status}</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Ordered at</p>
                <p className="font-semibold text-foreground">{new Date(selectedOrder.created_at).toLocaleString()}</p>
              </div>
            </div>

            {selectedOrder.notes && (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-xs text-amber-800">
                <p className="font-bold">Customer Note:</p>
                <p>{selectedOrder.notes}</p>
              </div>
            )}

            <div className="rounded-xl border bg-background p-3 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer Ordered Items</p>
              <div className="divide-y divide-border/60">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 text-xs">
                      <div>
                        <span className="font-black text-primary text-sm mr-2">{it.qty}×</span>
                        <span className="font-bold text-foreground">{it.name}</span>
                      </div>
                      <span className="font-extrabold text-foreground">₹{(it.price * it.qty).toFixed(0)}</span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-center text-xs text-muted-foreground italic">No items listed</p>
                )}
              </div>
              <div className="border-t pt-2 mt-2 flex justify-between font-black text-sm">
                <span>Items Subtotal</span>
                <span>₹{Number(selectedOrder.subtotal).toFixed(0)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-base text-primary border-t pt-1">
                <span>Grand Total</span>
                <span>₹{Number(selectedOrder.total).toFixed(0)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              {selectedOrder.status === "placed" && (
                <>
                  <Action onClick={() => { updateStatus(selectedOrder.id, "accepted"); setSelectedOrder(null); }} primary>Accept Order</Action>
                  <Action onClick={() => { setRejecting(selectedOrder.id); setReason(""); setSelectedOrder(null); }} danger>Reject</Action>
                </>
              )}
              {selectedOrder.status === "accepted" && (
                <div className="col-span-2">
                  <Action onClick={() => { updateStatus(selectedOrder.id, "preparing"); setSelectedOrder(null); }} primary>Mark Preparing</Action>
                </div>
              )}
              {selectedOrder.status === "preparing" && (
                <div className="col-span-2">
                  <Action onClick={() => { updateStatus(selectedOrder.id, "out_for_delivery"); setSelectedOrder(null); }} primary>Ready for Delivery</Action>
                </div>
              )}
              {selectedOrder.status === "out_for_delivery" && (
                <p className="col-span-2 rounded-xl bg-secondary py-2.5 text-center text-xs font-semibold text-muted-foreground">
                  Waiting for rider to deliver
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center" onClick={() => setRejecting(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Reject this order?</h3>
              <button onClick={() => setRejecting(null)} aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Tell the customer why (optional).</p>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={3}
              placeholder="Item unavailable / Restaurant closed / High order volume"
              className="mt-3 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:border-ring" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setRejecting(null)} className="rounded-xl bg-secondary py-2.5 text-sm font-bold">Cancel</button>
              <button onClick={submitReject} className="rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground">Reject Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-foreground text-background" : "bg-secondary text-foreground/80"}`}>
      {children}
    </button>
  );
}
function Action({ onClick, children, primary, danger }: { onClick: () => void; children: React.ReactNode; primary?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`col-span-1 rounded-xl py-2.5 text-sm font-bold ${danger ? "bg-destructive text-destructive-foreground" : primary ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
      {children}
    </button>
  );
}
