import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BrandHeader } from "@/components/BrandHeader";
import { useCart } from "@/hooks/useCart";
import { usePricingSettings } from "@/hooks/usePricingSettings";
import { useEffect, useState } from "react";
import { useLocationGate } from "@/hooks/useLocationGate";
import { fetchActiveZones, isLocationInServiceZone, type DeliveryZone } from "@/lib/zones";
import { PageSpinner } from "@/components/PageState";
import { AlertCircle, MapPin, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";

import { cartHasHandiNonVeg, HANDI_PREP_NOTE, cartHasCake, CAKE_PREP_NOTE } from "@/lib/portions";

export const Route = createFileRoute("/cart")({
  component: CartPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Your Cart — KhanaGharTak" },
      { name: "description", content: "Review the items in your cart and proceed to checkout for fast home delivery." },
      { property: "og:title", content: "Your Cart — KhanaGharTak" },
      { property: "og:description", content: "Review the items in your cart and proceed to checkout for fast home delivery." },
      { property: "og:url", content: "https://khanaghartak.in/cart" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/cart" }],
  }),
});

function CartPage() {
  const navigate = useNavigate();
  const { items, ready, inc, dec, remove, subtotal, totalQty } = useCart();
  const pricing = usePricingSettings();

  const { coords, status: locationStatus } = useLocationGate();
  const [activeZones, setActiveZones] = useState<DeliveryZone[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("kgt:delivery-address") || "";
    return "";
  });
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kgt:user-coords");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") return { lat: parsed.lat, lng: parsed.lng };
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    fetchActiveZones().then(setActiveZones).catch(() => {});
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setSelectedAddress(localStorage.getItem("kgt:delivery-address") || "");
      try {
        const raw = localStorage.getItem("kgt:user-coords");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") setSelectedCoords({ lat: parsed.lat, lng: parsed.lng });
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("kgt:address-changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("kgt:address-changed", handleStorage);
    };
  }, []);

  const effectiveCoords = selectedCoords || coords;
  const isOutsideZone = locationStatus === "outside_zone" || !isLocationInServiceZone(effectiveCoords, selectedAddress, activeZones);

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
          <Link to="/menu" search={{ r: undefined }} className="mt-6 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">
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
        {cartHasHandiNonVeg(items) && (
          <p className="rounded-xl border border-primary/30 bg-accent/40 px-3 py-2 text-xs font-medium">
            {HANDI_PREP_NOTE}
          </p>
        )}
        {cartHasCake(items) && (
          <p className="rounded-xl border border-primary/30 bg-accent/40 px-3 py-2 text-xs font-medium">
            {CAKE_PREP_NOTE}
          </p>
        )}
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
          <Row label="Food subtotal" value={`₹${subtotal.toFixed(0)}`} />
          <Row label="Platform fee" value={`₹${pricing.platform_fee.toFixed(0)}`} />
          <Row label="Delivery fee" value="Calculated at checkout" />
          <div className="my-2 h-px bg-border" />
          <Row label="Subtotal + fees" value={`₹${grand.toFixed(0)}+`} bold />
          <p className="mt-2 text-[11px] text-muted-foreground">Delivery is charged by distance from the kitchen to your pinned address.</p>
          <span className="mt-3 inline-block rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground">
            Cash on Delivery
          </span>
        </div>

        {isOutsideZone && (
          <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive">
            <div className="flex items-center gap-2 font-bold text-sm mb-1">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Delivery unavailable in your area</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              KhanaGharTak does not deliver to your selected location yet. Please change to an address in Shankargarh to place your order.
            </p>
            <button
              onClick={() => navigate({ to: "/location" })}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3.5 py-2 font-bold text-destructive-foreground active:scale-95 transition"
            >
              <MapPin className="h-3.5 w-3.5" /> Change delivery address
            </button>
          </div>
        )}
      </div>

      <div
        className="fixed left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t bg-background p-4"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => {
            if (isOutsideZone) return;
            navigate({ to: "/checkout" });
          }}
          disabled={isOutsideZone}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOutsideZone ? "Cannot Checkout Outside Service Area" : `Proceed to Checkout · ₹${grand.toFixed(0)}`}
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
