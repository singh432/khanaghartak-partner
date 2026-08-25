import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandHeader } from "@/components/BrandHeader";
import { PageError, PageSpinner } from "@/components/PageState";
import { withTimeout } from "@/lib/supabase-query";

export const Route = createFileRoute("/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "My Orders — KhanaGharTak" },
      { name: "description", content: "Track your past and active orders from KhanaGharTak in one place." },
      { property: "og:title", content: "My Orders — KhanaGharTak" },
      { property: "og:description", content: "Track your past and active orders from KhanaGharTak in one place." },
      { property: "og:url", content: "https://khanaghartak.in/orders" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/orders" }],
  }),
});

type Order = {
  id: string; status: string; total: number; created_at: string;
  items: { name: string; qty: number }[];
};

const STATUS_COLOR: Record<string, string> = {
  placed: "bg-accent text-accent-foreground",
  accepted: "bg-primary/15 text-primary",
  preparing: "bg-primary/15 text-primary",
  out_for_delivery: "bg-primary/15 text-primary",
  delivered: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-destructive/15 text-destructive",
};

function OrdersPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login", search: { as: "customer" } }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setFetching(true);
    setError(null);
    withTimeout(supabase.from("orders").select("id,status,total,created_at,items")
      .order("created_at", { ascending: false })
    ).then(({ data, error }) => {
      if (!active) return;
      if (error) throw error;
      setOrders((data ?? []) as unknown as Order[]);
    }).catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Could not load orders");
    }).finally(() => {
      if (active) setFetching(false);
    });
    return () => { active = false; };
  }, [user]);

  if (loading) return <PageSpinner label="Checking your session…" />;
  if (!user) return <PageSpinner label="Opening sign in…" />;

  return (
    <div className="pb-10">
      <BrandHeader subtitle="My orders" />
      <div className="space-y-3 px-4 pt-4">
        <h1 className="text-xl font-extrabold tracking-tight">My orders</h1>
        {fetching && <PageSpinner label="Loading your orders…" />}
        {error && <PageError message={error} onRetry={() => window.location.reload()} />}
        {!fetching && !error && orders.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">No orders yet.</p>
        )}
        {!fetching && !error && orders.map((o) => (
          <Link key={o.id} to="/order/$id" params={{ id: o.id }}
            className="block rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs font-bold">{o.id.slice(0, 8).toUpperCase()}</p>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_COLOR[o.status] ?? "bg-secondary"}`}>
                {o.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
            </p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
              <span className="font-bold">₹{Number(o.total).toFixed(0)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
