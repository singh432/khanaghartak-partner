import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageError, PageSpinner } from "@/components/PageState";
import { RiderLiveTracker } from "@/components/RiderLiveTracker";
import { OrderCancelWindow, type OrderLine } from "@/components/OrderCancelWindow";
import { withTimeout } from "@/lib/supabase-query";
import { speak, ORDER_VOICE } from "@/lib/voice";

import { CheckCircle2, Clock, Phone, XCircle } from "lucide-react";


export const Route = createFileRoute("/order/$id")({ component: OrderSuccess });

type Order = {
  id: string; status: string; total: number; subtotal: number;
  delivery_fee: number; platform_fee: number; discount?: number | null; distance_km: number | null;
  customer_name: string; created_at: string; address: string;
  latitude: number | null; longitude: number | null;
  items: OrderLine[] | null;
};

function OrderSuccess() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<{ restaurant_name: string; phone: string | null } | null>(null);

  const delivered = order?.status === "delivered";
  useEffect(() => {
    if (!delivered) { setContact(null); return; }
    let active = true;
    supabase.rpc("order_restaurant_contact", { _order_id: id }).then(({ data }) => {
      if (!active) return;
      const row = Array.isArray(data) ? data[0] : null;
      if (row) setContact(row as { restaurant_name: string; phone: string | null });
    });
    return () => { active = false; };
  }, [id, delivered]);


  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    withTimeout(supabase.from("orders")
      .select("id,status,total,subtotal,delivery_fee,platform_fee,discount,distance_km,customer_name,created_at,address,latitude,longitude,items")
      .eq("id", id).maybeSingle()).then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        setOrder(data as Order | null);
      }).catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load order");
      }).finally(() => {
        if (active) setLoading(false);
      });
    const channel = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => setOrder((o) => ({ ...(o ?? {} as Order), ...(payload.new as Order) })))
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [id]);

  // Speak the current order status once per change.
  const status = order?.status;
  useEffect(() => {
    if (!status) return;
    const line = ORDER_VOICE[status];
    if (line) speak(line);
  }, [status]);

  if (loading) return <PageSpinner label="Loading order…" />;

  if (error) return <PageError message={error} onRetry={() => window.location.reload()} />;


  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="fade-in">
        {order?.status === "cancelled" ? (
          <>
            <XCircle className="mx-auto h-20 w-20 text-destructive" />
            <h1 className="mt-4 text-2xl font-extrabold">Order cancelled</h1>
            <p className="mt-1 text-sm text-muted-foreground">This order was cancelled. You can order again anytime.</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
            <h1 className="mt-4 text-2xl font-extrabold">Order placed!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              The kitchen has been notified and is preparing your food.
            </p>
          </>
        )}
      </div>

      <div className="mt-8 w-full max-w-sm rounded-2xl border bg-card p-5 text-left shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Order ID</p>
        <p className="font-mono text-sm font-bold">{id.slice(0, 8).toUpperCase()}</p>
        {order && (
          <>
            <div className="my-3 h-px bg-border" />
            <p className="text-sm"><span className="text-muted-foreground">Name: </span>{order.customer_name}</p>
            <p className="mt-1 text-sm"><span className="text-muted-foreground">Address: </span>{order.address}</p>
            <div className="mt-3 space-y-1 text-sm">
              <Row label="Items total" value={`₹${Number(order.subtotal ?? 0).toFixed(0)}`} />
              <Row label={`Delivery${order.distance_km != null ? ` (${Number(order.distance_km).toFixed(1)} km)` : ""}`} value={`₹${Number(order.delivery_fee ?? 0).toFixed(2)}`} />
              <Row label="Platform fee" value={`₹${Number(order.platform_fee ?? 0).toFixed(0)}`} />
              {Number(order.discount ?? 0) > 0 && (
                <Row label="First order offer (5% off)" value={`− ₹${Number(order.discount).toFixed(0)}`} />
              )}
              <div className="my-1 h-px bg-border" />
              <Row label="Grand total (COD)" value={`₹${Number(order.total).toFixed(2)}`} bold />
            </div>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold">
              <span className="capitalize">{order.status.replace(/_/g, " ")}</span>
              <span className="pulse-dot" />
            </p>
          </>
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Estimated delivery: 30–40 min
        </p>
      </div>

      {contact?.phone && (
        <div className="mt-4 w-full max-w-sm rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Issue with your items?</p>
          <p className="mt-1 text-sm font-semibold">{contact.restaurant_name}</p>
          <a
            href={`tel:${contact.phone}`}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Phone className="h-4 w-4" /> Call restaurant
          </a>
        </div>
      )}

      {order?.status !== "cancelled" && (
        <div className="mt-4 w-full max-w-sm rounded-2xl border bg-card p-4 text-left shadow-[var(--shadow-card)]">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Need help with this order?</p>
          <p className="mt-1 text-sm font-semibold">KhanaGharTak Support</p>
          <p className="mt-0.5 text-xs text-muted-foreground">For any order help, call us directly.</p>
          <a
            href="tel:+919711720846"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <Phone className="h-4 w-4" /> Call KhanaGharTak
          </a>
        </div>
      )}

      <OrderCancelWindow
        orderId={id}
        createdAt={order?.created_at}
        status={order?.status}
        items={order?.items ?? []}
      />

      <RiderLiveTracker orderId={id} dropLat={order?.latitude} dropLng={order?.longitude} />


      <Link to="/home" className="mt-8 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
        Back to home
      </Link>
      <Link to="/orders" className="mt-3 text-sm font-medium text-primary underline">Track all my orders</Link>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : "text-sm"}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
