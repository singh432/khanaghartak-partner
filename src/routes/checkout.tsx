import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useFormDraft } from "@/hooks/useFormDraft";

import { usePricingSettings, computeDeliveryFee, ROAD_FACTOR } from "@/hooks/usePricingSettings";
import { distanceKm as haversineKm } from "@/lib/geo";
import { BrandHeader } from "@/components/BrandHeader";
import { PageSpinner } from "@/components/PageState";
import { withTimeout } from "@/lib/supabase-query";
import { MapPin, Navigation, Loader2, Wallet, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Checkout — KhanaGharTak" },
      { name: "description", content: "Confirm your delivery details and place your Cash on Delivery order with KhanaGharTak." },
      { property: "og:title", content: "Checkout — KhanaGharTak" },
      { property: "og:description", content: "Confirm your delivery details and place your Cash on Delivery order with KhanaGharTak." },
      { property: "og:url", content: "https://khanaghartak.in/checkout" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/checkout" }],
  }),
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone"),
  address: z.string().trim().min(8, "Add a complete address").max(300),
  landmark: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(200).optional(),
});

function CheckoutPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { items, ready, subtotal, clear } = useCart();
  const pricing = usePricingSettings();
  const [form, setForm] = useState({ name: "", phone: "", address: "", landmark: "", notes: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);

  const draftKey = user ? `kgt-draft-checkout-${user.id}` : null;
  const clearDraft = useFormDraft(draftKey, { form, coords }, (d) => {
    if (d.form) setForm((cur) => ({ ...cur, ...d.form }));
    if (d.coords) setCoords(d.coords);
  });

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => { if (!placed && !loading && ready && items.length === 0) navigate({ to: "/menu" }); }, [items, loading, ready, navigate, placed]);

  // Load saved profile
  useEffect(() => {
    if (!user) return;
    withTimeout(supabase.from("profiles").select("full_name, phone, address, landmark, latitude, longitude")
      .eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          // keep anything the user already typed (restored draft or live input)
          setForm((cur) => ({
            name: cur.name || data.full_name || "",
            phone: cur.phone || data.phone || "",
            address: cur.address || data.address || "",
            landmark: cur.landmark || data.landmark || "",
            notes: cur.notes,
          }));
          if (data.latitude && data.longitude) {
            setCoords((cur) => cur ?? { lat: data.latitude!, lng: data.longitude! });
          }
        }
      })).catch(() => {});
  }, [user]);


  // Fetch restaurant coords from first cart item
  useEffect(() => {
    if (!ready || items.length === 0) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("menu_items")
        .select("restaurants:restaurant_id(latitude, longitude)")
        .eq("id", items[0].menu_item_id)
        .maybeSingle();
      if (!active) return;
      const r = (data as { restaurants: { latitude: number | null; longitude: number | null } | null } | null)?.restaurants;
      if (r?.latitude != null && r?.longitude != null) {
        setRestaurantCoords({ lat: r.latitude, lng: r.longitude });
      }
    })();
    return () => { active = false; };
  }, [ready, items]);

  const distanceKm = useMemo(() => {
    if (!coords || !restaurantCoords) return null;
    return haversineKm(restaurantCoords, coords) * ROAD_FACTOR;
  }, [coords, restaurantCoords]);

  const deliveryFee = distanceKm != null ? computeDeliveryFee(distanceKm, pricing.delivery_per_km) : 0;
  const outOfRange = distanceKm != null && distanceKm > pricing.max_delivery_radius_km;
  const grand = subtotal + (distanceKm != null && !outOfRange ? deliveryFee : 0) + pricing.platform_fee;

  if (loading || !ready) return <PageSpinner label="Preparing checkout…" />;
  if (!user) return <PageSpinner label="Opening sign in…" />;

  const pinLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Location pinned"); },
      (e) => toast.error(e.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const placeOrder = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!coords) return toast.error("Please pin your delivery location");
    if (outOfRange) return toast.error("Sorry, this restaurant does not deliver to your selected location.");
    if (!user) return;
    setPlacing(true);
    const { data, error } = await supabase.rpc("place_order", {
      _items: items.map((i) => ({ id: i.menu_item_id, portion: i.portion, qty: i.qty })),
      _customer_name: form.name,
      _customer_phone: form.phone,
      _address: form.address,
      _landmark: form.landmark || undefined,
      _notes: form.notes || undefined,
      _latitude: coords.lat,
      _longitude: coords.lng,
    });
    setPlacing(false);
    if (error || !data) return toast.error(error?.message ?? "Could not place order");
    setPlaced(true);
    clearDraft();
    clear();
    navigate({ to: "/order/$id", params: { id: data as unknown as string } });

    // fire-and-forget: saving the profile must never block the redirect
    supabase.from("profiles").upsert({
      id: user.id, full_name: form.name, phone: form.phone,
      address: form.address, landmark: form.landmark || null,
      latitude: coords.lat, longitude: coords.lng,
    }, { onConflict: "id" }).then(() => {}, () => {});
  };

  return (
    <div className="pb-32">
      <BrandHeader subtitle="Checkout" />
      <div className="px-4 pt-4 space-y-5">
        <h1 className="text-xl font-extrabold tracking-tight">Checkout</h1>
        <Section title="Delivery details">
          <Field label="Name">
            <input className="ck-input" value={form.name} maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="ck-input" value={form.phone} maxLength={15} inputMode="tel"
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <textarea className="ck-input" rows={3} value={form.address} maxLength={300}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Landmark">
            <input className="ck-input" value={form.landmark} maxLength={120}
              onChange={(e) => setForm({ ...form, landmark: e.target.value })} />
          </Field>
          <Field label="Delivery notes">
            <input className="ck-input" placeholder="e.g. ring the bell, less spicy"
              value={form.notes} maxLength={200}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <button onClick={pinLocation}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-accent/40 py-3 text-sm font-semibold text-primary">
            <Navigation className="h-4 w-4" />
            {coords ? `Re-pin location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` : "Pin exact delivery location"}
          </button>
          {coords && distanceKm != null && !outOfRange && (
            <div className="flex items-center gap-1 text-xs text-success">
              <MapPin className="h-3.5 w-3.5" /> Location pinned · ~{distanceKm.toFixed(1)} km from kitchen
            </div>
          )}
          {outOfRange && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Sorry, this restaurant does not deliver to your selected location. (~{distanceKm!.toFixed(1)} km, max {pricing.max_delivery_radius_km} km)</span>
            </div>
          )}
        </Section>

        <Section title="Order summary">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between py-1 text-sm">
              <span>{it.name} × {it.qty}</span>
              <span className="font-semibold">₹{(it.price * it.qty).toFixed(0)}</span>
            </div>
          ))}
          <div className="my-2 h-px bg-border" />
          <Row label="Items total" value={`₹${subtotal.toFixed(0)}`} />
          <Row
            label={distanceKm != null ? `Delivery charge (${distanceKm.toFixed(1)} km × ₹${pricing.delivery_per_km})` : "Delivery charge"}
            value={distanceKm != null ? (outOfRange ? "—" : `₹${deliveryFee.toFixed(0)}`) : "Pin location"}
          />
          <Row label="Platform fee" value={`₹${pricing.platform_fee.toFixed(0)}`} />
          <div className="my-2 h-px bg-border" />
          <Row label="Grand total" value={outOfRange ? "—" : `₹${grand.toFixed(0)}`} bold />
        </Section>

        <Section title="Payment">
          <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-accent/50 p-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Cash on Delivery</p>
              <p className="text-[11px] text-muted-foreground">Pay ₹{outOfRange ? "—" : grand.toFixed(0)} when your order arrives</p>
            </div>
            <span className="h-4 w-4 rounded-full border-4 border-primary" />
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t bg-background p-4">
        <button onClick={placeOrder} disabled={placing || !coords || outOfRange}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-60">
          {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!coords ? "Pin location to continue" : outOfRange ? "Outside delivery area" : `Place Order · ₹${grand.toFixed(0)}`}
        </button>
      </div>

      <style>{`.ck-input { width:100%; border-radius: 12px; padding: 12px 14px; background: var(--color-input); border: 1px solid var(--color-border); font-size: 14px; outline: none; } .ck-input:focus { border-color: var(--color-ring);} `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
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
