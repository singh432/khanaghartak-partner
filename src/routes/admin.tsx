import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";
import { LogOut, Search, Bell } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Order = {
  id: string; status: string; total: number; subtotal: number; delivery_fee: number;
  customer_name: string; customer_phone: string; address: string;
  landmark: string | null; notes: string | null;
  latitude: number | null; longitude: number | null;
  items: { name: string; qty: number; price: number }[];
  created_at: string;
};

const STATUSES = ["placed", "accepted", "preparing", "out_for_delivery", "delivered", "rejected"] as const;
type Status = typeof STATUSES[number];

const STATUS_LABEL: Record<Status, string> = {
  placed: "New", accepted: "Accepted", preparing: "Preparing",
  out_for_delivery: "Out for Delivery", delivered: "Delivered", rejected: "Rejected",
};

function AdminPage() {
  const navigate = useNavigate();
  const { user, loading, isAdmin, signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  // load + realtime
  useEffect(() => {
    if (!user || !isAdmin) return;
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setOrders((data ?? []) as unknown as Order[]));
    const channel = supabase.channel("admin-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as Order;
        setOrders((cur) => [o, ...cur]);
        toast.success(`New order from ${o.customer_name}`, { duration: 6000 });
        try { audioRef.current?.play().catch(() => {}); } catch {}
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("New Order Received", { body: `from ${o.customer_name} · ₹${o.total}` });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, (payload) => {
        const o = payload.new as Order;
        setOrders((cur) => cur.map((x) => x.id === o.id ? o : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin]);

  // request browser notif perm once
  useEffect(() => {
    if (isAdmin && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [isAdmin]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filter !== "all" && o.status !== filter) return false;
      if (q && !o.id.toLowerCase().includes(q.toLowerCase()) &&
          !o.customer_name.toLowerCase().includes(q.toLowerCase()) &&
          !o.customer_phone.includes(q)) return false;
      return true;
    });
  }, [orders, filter, q]);

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(`Order marked ${STATUS_LABEL[status]}`);
  };

  if (loading) return <div className="p-8 text-center text-sm">Loading…</div>;

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <img src={logo} width={56} height={56} alt="" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-lg font-bold">Restaurant Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin access. Ask the owner to grant you the
          <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-xs">restaurant_admin</code> role
          in the backend.
        </p>
        <p className="mt-4 text-xs text-muted-foreground break-all">Your user ID: {user.id}</p>
        <button onClick={signOut} className="mt-6 rounded-full bg-secondary px-4 py-2 text-sm">Sign out</button>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/03/15/audio_1842b29254.mp3" preload="auto" />

      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <img src={logo} width={32} height={32} alt="" className="h-8 w-8" />
          <div>
            <p className="text-sm font-bold leading-tight">Restaurant Admin</p>
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Bell className="h-3 w-3 text-success" /> Live orders
            </p>
          </div>
        </div>
        <button onClick={signOut} className="rounded-full p-2 text-muted-foreground"><LogOut className="h-4 w-4" /></button>
      </header>

      <div className="space-y-2 px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl border bg-card px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60}
            placeholder="Search by order ID, name, phone"
            className="h-10 flex-1 bg-transparent text-sm outline-none" />
        </div>
        <div className="flex gap-2 overflow-x-auto scroll-hide">
          <Chip on={filter === "all"} onClick={() => setFilter("all")}>All ({orders.length})</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} on={filter === s} onClick={() => setFilter(s)}>
              {STATUS_LABEL[s]} ({orders.filter((o) => o.status === s).length})
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 space-y-3 px-4">
        {filtered.length === 0 && (
          <p className="py-16 text-center text-sm text-muted-foreground">No orders match.</p>
        )}
        {filtered.map((o) => (
          <article key={o.id} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs font-bold">#{o.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-base font-semibold leading-tight">{o.customer_name}</p>
                <a href={`tel:${o.customer_phone}`} className="text-xs text-primary underline">{o.customer_phone}</a>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${o.status === "placed" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {STATUS_LABEL[o.status as Status]}
              </span>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>

            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Address: </span>{o.address}
              {o.landmark && <span className="text-muted-foreground"> · {o.landmark}</span>}
            </p>
            {o.latitude && o.longitude && (
              <a target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                className="mt-1 inline-block text-xs font-semibold text-primary underline">
                Open in Maps ({o.latitude.toFixed(4)}, {o.longitude.toFixed(4)})
              </a>
            )}
            {o.notes && <p className="mt-2 rounded-lg bg-accent px-2 py-1 text-xs">Note: {o.notes}</p>}

            <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
              {o.items.map((it, idx) => (
                <div key={idx} className="flex justify-between py-0.5">
                  <span>{it.qty}× {it.name}</span>
                  <span className="font-semibold">₹{(it.price * it.qty).toFixed(0)}</span>
                </div>
              ))}
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Subtotal</span><span>₹{Number(o.subtotal).toFixed(0)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Delivery</span><span>₹{Number(o.delivery_fee).toFixed(0)}</span></div>
              <div className="mt-1 flex justify-between text-sm font-bold"><span>COD total</span><span>₹{Number(o.total).toFixed(0)}</span></div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {o.status === "placed" && (<>
                <Action onClick={() => updateStatus(o.id, "accepted")} primary>Accept</Action>
                <Action onClick={() => updateStatus(o.id, "rejected")} danger>Reject</Action>
              </>)}
              {o.status === "accepted" && <Action onClick={() => updateStatus(o.id, "preparing")} primary>Mark Preparing</Action>}
              {o.status === "preparing" && <Action onClick={() => updateStatus(o.id, "out_for_delivery")} primary>Out for Delivery</Action>}
              {o.status === "out_for_delivery" && <Action onClick={() => updateStatus(o.id, "delivered")} primary>Mark Delivered</Action>}
            </div>
          </article>
        ))}
      </div>
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
