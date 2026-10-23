import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isRestaurantOpen } from "@/lib/hours";
import { cartHasHandiNonVeg, HANDI_PREP_NOTE, cartHasCake, CAKE_PREP_NOTE } from "@/lib/portions";
import { BrandHeader } from "@/components/BrandHeader";
import { PageSpinner } from "@/components/PageState";
import { ShoppingBag, Plus, Minus, Trash2, ArrowRight, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Your Cart — KhanaGharTak" },
      { name: "description", content: "Review your selected dishes and proceed to checkout." },
      { property: "og:title", content: "Your Cart — KhanaGharTak" },
      { property: "og:description", content: "Review your selected dishes and proceed to checkout." },
      { property: "og:url", content: "https://khanaghartak.in/cart" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/cart" }],
  }),
});

export function CartPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, ready, inc, dec, remove, clear, subtotal, totalQty } = useCart();

  const [restaurantName, setRestaurantName] = useState<string>("");
  const [restaurantClosed, setRestaurantClosed] = useState(false);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", search: { as: "customer" } });
    }
  }, [user, authLoading, navigate]);

  // Fetch restaurant details for cart header
  useEffect(() => {
    if (!ready || items.length === 0) return;
    let active = true;
    const rId = items[0]?.restaurant_id;
    if (!rId) return;

    supabase
      .from("restaurants")
      .select("id, name, is_open, opening_time, closing_time")
      .eq("id", rId)
      .maybeSingle()
      .then(({ data: r }) => {
        if (!active || !r) return;
        setRestaurantName(r.name || "");
        setRestaurantClosed(!isRestaurantOpen(r as any));
      });

    return () => {
      active = false;
    };
  }, [ready, items]);

  if (!ready || authLoading) return <PageSpinner label="Loading your cart…" />;

  // Empty Cart State
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <BrandHeader subtitle="Your cart" />
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <div className="grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-primary">
            <ShoppingBag className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-xl font-bold">Your cart is empty</h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
            Discover delicious dishes from local kitchens and order with fast doorstep delivery.
          </p>
          <Link
            to="/home"
            className="mt-6 rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] active:scale-95 transition"
          >
            Browse Restaurants
          </Link>
        </div>
      </div>
    );
  }

  const firstRestaurantId = items[0]?.restaurant_id;

  return (
    <div className="pb-36 bg-background min-h-screen">
      <BrandHeader subtitle={`Cart · ${totalQty} item${totalQty > 1 ? "s" : ""}`} />

      <div className="px-4 pt-4 space-y-4 max-w-lg mx-auto">
        {/* Preparation Notes */}
        {cartHasHandiNonVeg(items) && (
          <p className="rounded-xl border border-primary/30 bg-accent/40 px-3 py-2 text-xs font-medium text-foreground">
            {HANDI_PREP_NOTE}
          </p>
        )}
        {cartHasCake(items) && (
          <p className="rounded-xl border border-primary/30 bg-accent/40 px-3 py-2 text-xs font-medium text-foreground">
            {CAKE_PREP_NOTE}
          </p>
        )}

        {/* Restaurant Status Warning */}
        {restaurantClosed && (
          <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This kitchen is currently closed. You can review your cart, but orders can only be placed when it reopens.</span>
          </div>
        )}

        {/* CART ITEMS LIST */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div>
              <h2 className="text-sm font-bold text-foreground">Selected Items</h2>
              {restaurantName && <p className="text-xs text-muted-foreground">From {restaurantName}</p>}
            </div>
            {firstRestaurantId && (
              <Link
                to="/menu"
                search={{ r: firstRestaurantId }}
                className="text-xs font-bold text-primary hover:underline"
              >
                + Add more
              </Link>
            )}
          </div>

          <div className="space-y-3 divide-y divide-border/30">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 pt-2.5 first:pt-0">
                {it.image_url && (
                  <img
                    src={it.image_url}
                    alt={it.name}
                    width={52}
                    height={52}
                    loading="lazy"
                    className="h-13 w-13 rounded-xl object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{it.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ₹{it.price.toFixed(0)} × {it.qty} ={" "}
                    <span className="font-bold text-foreground">₹{(it.price * it.qty).toFixed(0)}</span>
                  </p>
                </div>
                <div className="flex items-center rounded-lg border-2 border-primary bg-primary text-primary-foreground shrink-0">
                  <button
                    aria-label={`Remove one ${it.name}`}
                    onClick={() => dec(it.id)}
                    className="px-2 py-1 active:scale-90"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="px-1 text-xs font-bold tabular-nums">{it.qty}</span>
                  <button
                    aria-label={`Add one ${it.name}`}
                    onClick={() => inc(it.id)}
                    className="px-2 py-1 active:scale-90"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  aria-label={`Remove ${it.name} from cart`}
                  onClick={() => remove(it.id)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive active:scale-90 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* FOOD SUBTOTAL SUMMARY (Clean & Simple) */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Item Subtotal</span>
            <span className="text-base font-extrabold text-foreground">₹{subtotal.toFixed(0)}</span>
          </div>

          <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
            💡 <strong>Overall charges</strong> (delivery fee, platform fee & discounts) will be calculated on the next checkout page once you confirm your delivery location.
          </div>
        </div>
      </div>

      {/* FIXED BOTTOM ACTION BAR */}
      <div
        className="fixed left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t bg-background/95 backdrop-blur px-4 py-3 shadow-lg"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => navigate({ to: "/checkout" })}
          disabled={restaurantClosed || items.length === 0}
          className="flex h-12 w-full items-center justify-between rounded-2xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition"
        >
          <span>Proceed to Checkout</span>
          <span className="flex items-center gap-1">
            ₹{subtotal.toFixed(0)} <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
