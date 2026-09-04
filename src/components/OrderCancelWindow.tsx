import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Pencil, XCircle, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart, type Portion } from "@/hooks/useCart";

const WINDOW_MS = 2 * 60 * 1000;

export type OrderLine = { id: string; name: string; portion?: string; price: number; qty: number };

export function OrderCancelWindow({
  orderId,
  createdAt,
  status,
  items,
}: {
  orderId: string;
  createdAt?: string;
  status?: string;
  items?: OrderLine[];
}) {
  const navigate = useNavigate();
  const cart = useCart();
  const [busy, setBusy] = useState<null | "edit" | "cancel">(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!createdAt) return;
    const tick = () => setLeft(Math.max(0, new Date(createdAt).getTime() + WINDOW_MS - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [createdAt]);

  const cancellable =
    !!createdAt && left > 0 && !!status && !["cancelled", "rejected", "delivered", "out_for_delivery"].includes(status);

  if (!cancellable) return null;

  const mm = Math.floor(left / 60000);
  const ss = Math.floor((left % 60000) / 1000).toString().padStart(2, "0");

  const cancel = async (mode: "edit" | "cancel") => {
    setBusy(mode);
    const { error } = await supabase.rpc("customer_cancel_order", { _order_id: orderId });
    if (error) {
      setBusy(null);
      return toast.error(error.message);
    }

    if (mode === "cancel") {
      setBusy(null);
      toast.success("Order cancelled");
      return;
    }

    // restore the ordered items into the cart so the customer can edit and re-order
    const lines = items ?? [];
    const ids = [...new Set(lines.map((l) => l.id))];
    const { data: menu } = await supabase
      .from("menu_items")
      .select("id, name, image_url, veg_type")
      .in("id", ids);
    const byId = new Map((menu ?? []).map((m) => [m.id, m]));

    cart.clear();
    for (const line of lines) {
      const m = byId.get(line.id);
      const base = {
        menu_item_id: line.id,
        portion: (line.portion ?? "full") as Portion,
        name: m?.name ?? line.name,
        price: Number(line.price),
        image_url: m?.image_url ?? null,
        veg_type: (m?.veg_type === "nonveg" ? "nonveg" : "veg") as "veg" | "nonveg",
      };
      for (let i = 0; i < Number(line.qty || 1); i++) cart.add(base);
    }
    setBusy(null);
    toast.success("Order cancelled — edit your items and place it again");
    navigate({ to: "/cart" });
  };

  return (
    <div className="mt-4 w-full max-w-sm rounded-2xl border-2 border-dashed border-primary/40 bg-accent/30 p-4 text-left">
      <p className="flex items-center gap-2 text-xs font-semibold text-primary">
        <Timer className="h-3.5 w-3.5" /> You can edit or cancel for {mm}:{ss}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        We send your order to the kitchen after this timer ends.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          disabled={!!busy}
          onClick={() => cancel("edit")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-primary/40 bg-card py-2.5 text-sm font-bold text-primary disabled:opacity-60"
        >
          <Pencil className="h-4 w-4" /> {busy === "edit" ? "Working…" : "Edit items"}
        </button>
        <button
          disabled={!!busy}
          onClick={() => cancel("cancel")}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" /> {busy === "cancel" ? "Cancelling…" : "Cancel order"}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Editing cancels this order and moves the items back to your cart.
      </p>
    </div>
  );
}
