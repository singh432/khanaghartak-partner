import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageError, PageSpinner } from "@/components/PageState";
import { withTimeout } from "@/lib/supabase-query";
import { CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/order/$id")({ component: OrderSuccess });

type Order = {
  id: string; status: string; total: number; subtotal: number;
  delivery_fee: number; platform_fee: number; distance_km: number | null;
  customer_name: string; created_at: string; address: string;
};

function OrderSuccess() {
  const { id } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    withTimeout(supabase.from("orders")
      .select("id,status,total,subtotal,delivery_fee,platform_fee,distance_km,customer_name,created_at,address")
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

  if (loading) return <PageSpinner label="Loading order…" />;
  if (error) return <PageError message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <div className="fade-in">
        <CheckCircle2 className="mx-auto h-20 w-20 text-success" />
        <h1 className="mt-4 text-2xl font-extrabold">Order placed!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The kitchen has been notified and is preparing your food.
        </p>
      </div>

      <div className="mt-8 w-full max-w-sm rounded-2xl border bg-card p-5 text-left shadow-[var(--shadow-card)]">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Order ID</p>
        <p className="font-mono text-sm font-bold">{id.slice(0, 8).toUpperCase()}</p>
        {order && (
          <>
            <div className="my-3 h-px bg-border" />
            <p className="text-sm"><span className="text-muted-foreground">Name: </span>{order.customer_name}</p>
            <p className="mt-1 text-sm"><span className="text-muted-foreground">Address: </span>{order.address}</p>
            <p className="mt-1 text-sm"><span className="text-muted-foreground">Amount to pay (COD): </span><span className="font-bold">₹{Number(order.total).toFixed(0)}</span></p>
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

      <Link to="/home" className="mt-8 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
        Back to home
      </Link>
      <Link to="/orders" className="mt-3 text-sm font-medium text-primary underline">Track all my orders</Link>
    </div>
  );
}
