import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandHeader } from "@/components/BrandHeader";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

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
};

function OrdersPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("id,status,total,created_at,items")
      .order("created_at", { ascending: false })
      .then(({ data }) => setOrders((data ?? []) as unknown as Order[]));
  }, [user]);

  return (
    <div className="pb-10">
      <BrandHeader subtitle="My orders" />
      <div className="space-y-3 px-4 pt-4">
        {orders.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">No orders yet.</p>
        )}
        {orders.map((o) => (
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
