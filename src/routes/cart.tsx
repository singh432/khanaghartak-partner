import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandHeader } from "@/components/BrandHeader";
import { useCart } from "@/hooks/useCart";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { PageSpinner } from "@/components/PageState";
import { Plus, Minus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [
      { title: "Your Cart — KhanaGharTak" },
      { name: "description", content: "Review the items in your cart and proceed to checkout for fast home delivery." },
      { property: "og:title", content: "Your Cart — KhanaGharTak" },
      { property: "og:description", content: "Review the items in your cart and proceed to checkout for fast home delivery." },
      { property: "og:url", content: "https://khanaghartak.lovable.app/cart" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.lovable.app/cart" }],
  }),
});

function CartPage() {
  const navigate = useNavigate();
  const { items, ready, inc, dec, remove, subtotal, totalQty } = useCart();
  const pricing = usePricingSettings();

  const grand = subtotal + (subtotal > 0 ? pricing.platform_fee : 0);

  if (!ready) return <PageSpinner label="Loading your cart…" />;

  if (items.length === 0) {
    return (
      <div>
        <BrandHeader subtitle="Your cart" />
        <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
          <ShoppingBag className="h-14 w-14 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-bold">Your cart is empty</h1>
          <p className="mt-1 text-sm text-muted-foreground">Add tasty dishes to get started.</p>
          <Link to="/menu" className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
            Browse Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <BrandHeader subtitle={`${totalQty} item${totalQty > 1 ? "s" : ""} in cart`} />
      <div className="px-4 pt-4 space-y-3">
        <h1 className="sr-only">Your cart</h1>
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)]">
            {it.image_url && (
              <img src={it.image_url} alt={it.name} width={56} height={56} loading="lazy"
                className="h-14 w-14 rounded-lg object-cover" />
            )}
            <div className="flex-1">
              <p className="font-semibold leading-tight">{it.name}</p>
              <p className="text-xs text-muted-foreground">₹{it.price.toFixed(0)} × {it.qty} = <span className="font-semibold text-foreground">₹{(it.price * it.qty).toFixed(0)}</span></p>
            </div>
            <div className="flex items-center rounded-lg border-2 border-primary bg-primary text-primary-foreground">
              <button aria-label={`Remove one ${it.name}`} onClick={() => dec(it.id)} className="px-2 py-1"><Minus className="h-3 w-3" aria-hidden="true" /></button>
              <span className="px-1 text-xs font-bold tabular-nums">{it.qty}</span>
              <button aria-label={`Add one ${it.name}`} onClick={() => inc(it.id)} className="px-2 py-1"><Plus className="h-3 w-3" aria-hidden="true" /></button>
            </div>
            <button aria-label={`Remove ${it.name} from cart`} onClick={() => remove(it.id)} className="rounded-lg p-2 text-muted-foreground">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ))}

        <div className="mt-4 rounded-2xl border bg-card p-4 text-sm shadow-[var(--shadow-card)]">
          <Row label="Item total" value={`₹${subtotal.toFixed(0)}`} />
          <Row label="Platform fee" value={`₹${PLATFORM_FEE.toFixed(0)}`} />
          <div className="my-2 h-px bg-border" />
          <Row label="Grand total" value={`₹${grand.toFixed(0)}`} bold />
          <span className="mt-3 inline-block rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
            Cash on Delivery
          </span>
        </div>
      </div>

      <div
        className="fixed left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t bg-background p-4"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button onClick={() => navigate({ to: "/checkout" })}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)]">
          Proceed to Checkout · ₹{grand.toFixed(0)}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "text-base font-bold" : "text-sm"}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
