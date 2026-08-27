import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { track } from "@/lib/analytics";
import { useFormDraft } from "@/hooks/useFormDraft";

import { usePricingSettings, ROAD_FACTOR } from "@/hooks/usePricingSettings";
import { computeDeliveryCharge, amountToFreeDelivery, isSundayIST, SUNDAY_OFFER_MIN, sundayOfferActive } from "@/lib/delivery-pricing";
import { distanceKm as haversineKm } from "@/lib/geo";
import { BrandHeader } from "@/components/BrandHeader";

import { PageSpinner } from "@/components/PageState";
import { PhoneVerification } from "@/components/PhoneVerification";

import { withTimeout } from "@/lib/supabase-query";
import { MapPin, Navigation, Loader2, Wallet, AlertTriangle } from "lucide-react";
import { MIN_ORDER_VALUE } from "@/lib/order-rules";
import { cartHasHandiNonVeg, HANDI_PREP_NOTE, cartHasCake, CAKE_PREP_NOTE } from "@/lib/portions";
import { fetchActiveZones, zoneForPoint, OUTSIDE_ZONE_MESSAGE, type DeliveryZone } from "@/lib/zones";

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
  const [restaurantClosed, setRestaurantClosed] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [gate, setGate] = useState<({ needs_otp: boolean; phone_verified: boolean; cod_allowed: boolean; disabled_until: string | null; blocked: boolean } & { phone: string }) | null>(null);
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);

  useEffect(() => { fetchActiveZones().then(setZones).catch(() => setZones([])); }, []);


  const phoneDigits = form.phone.replace(/[^0-9]/g, "").slice(-10);
  const refreshGate = () => {
    if (!user || phoneDigits.length !== 10) {
      setGate(null);
      return;
    }
    const requestedPhone = phoneDigits;
    supabase.rpc("cod_status", { _phone: requestedPhone }).then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setGate({ ...row, phone: requestedPhone });
    }, () => {});
  };
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(refreshGate, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, phoneDigits]);


  const draftKey = user ? `kgt-draft-checkout-${user.id}` : null;
  const clearDraft = useFormDraft(draftKey, { form, coords }, (d) => {
    if (d.form) setForm((cur) => ({ ...cur, ...d.form }));
    if (d.coords) setCoords(d.coords);
  });

  useEffect(() => { if (!loading && !user) navigate({ to: "/login", search: { as: "customer" } }); }, [user, loading, navigate]);
  useEffect(() => { if (!placed && !loading && ready && items.length === 0) navigate({ to: "/menu", search: { r: undefined } }); }, [items, loading, ready, navigate, placed]);

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

  // Prefill an already verified mobile number so checkout never re-asks for OTP.
  useEffect(() => {
    if (!user) return;
    withTimeout(supabase.from("verified_phones").select("phone").eq("user_id", user.id)
      .order("verified_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
        if (data?.phone) setForm((cur) => (cur.phone.replace(/\D/g, "").length === 10 ? cur : { ...cur, phone: data.phone }));
      })).catch(() => {});
  }, [user]);


  // Fetch restaurant coords + open state from first cart item
  useEffect(() => {
    if (!ready || items.length === 0) return;
    let active = true;
    (async () => {
      const { data: mi } = await supabase
        .from("menu_items")
        .select("restaurant_id")
        .eq("id", items[0].menu_item_id)
        .maybeSingle();
      if (!active || !mi?.restaurant_id) return;
      const { data: r } = await supabase
        .from("restaurants")
        .select("latitude, longitude, is_open")
        .eq("id", mi.restaurant_id)
        .maybeSingle();
      if (!active) return;
      setRestaurantClosed(!!r && r.is_open !== true);
      if (r?.latitude != null && r?.longitude != null) {
        setRestaurantCoords({ lat: r.latitude, lng: r.longitude });
      }
    })();
    return () => { active = false; };
  }, [ready, items]);

  // Auto-pick the current location once so the delivery fee shows without an extra tap.
  useEffect(() => {
    if (!user || coords || typeof navigator === "undefined" || !navigator.geolocation) return;
    let active = true;
    navigator.geolocation.getCurrentPosition(
      (p) => { if (active) setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); },
      () => {},
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    );
    return () => { active = false; };
  }, [user, coords]);

  const distanceKm = useMemo(() => {
    if (!coords || !restaurantCoords) return null;
    return haversineKm(restaurantCoords, coords) * ROAD_FACTOR;
  }, [coords, restaurantCoords]);

  const baseDeliveryFee =
    distanceKm != null
      ? computeDeliveryCharge(subtotal, distanceKm, pricing.delivery_slabs, pricing.delivery_extra_per_km)
      : 0;
  const sundayOffer = isSundayIST();
  const sundayFree = sundayOfferActive(subtotal);
  const toFreeDelivery = amountToFreeDelivery(subtotal, pricing.delivery_slabs);
  const deliveryFee = baseDeliveryFee;
  const outOfRange = distanceKm != null && distanceKm > pricing.max_delivery_radius_km;
  const grand = subtotal + (distanceKm != null && !outOfRange ? deliveryFee : 0) + pricing.platform_fee;
  const shortfall = Math.max(0, MIN_ORDER_VALUE - subtotal);
  const belowMin = shortfall > 0;
  const currentGate = gate?.phone === phoneDigits ? gate : null;
  const codBlocked = !!currentGate && (!currentGate.cod_allowed || currentGate.blocked);



  if (loading || !ready) return <PageSpinner label="Preparing checkout…" />;
  if (!user) return <PageSpinner label="Opening sign in…" />;

  const pinLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success("Current location saved"); },
      (e) => toast.error(e.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const placeOrder = async () => {
    track("checkout_started", { value: subtotal });
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (restaurantClosed) return toast.error("This restaurant is closed right now. Please order when it reopens.");
    if (belowMin) return toast.error(`Minimum order value is ₹${MIN_ORDER_VALUE}. Add ₹${shortfall.toFixed(0)} more.`);
    if (currentGate?.blocked) return toast.error("This phone number is blocked. Please contact support.");
    if (currentGate?.needs_otp) return toast.error("Please verify your phone number to place the order.");
    if (currentGate && !currentGate.cod_allowed) return toast.error("Cash on Delivery is temporarily disabled for your account.");

    if (!coords) return toast.error("Please share your current location");
    if (outOfRange) return toast.error("Sorry, this restaurant does not deliver to your selected location.");
    if (!user) return;

    setPlacing(true);
    track("payment_started", { value: subtotal, meta: { method: "cod" } });
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
    if (error || !data) {
      track("payment_failed" as never, { value: subtotal, repeatable: true, meta: { error: error?.message ?? "unknown" } });
      return toast.error(error?.message ?? "Could not place order");
    }
    const orderId = data as unknown as string;
    track("payment_success", { order_id: orderId, value: subtotal, meta: { method: "cod" } });
    track("order_placed", { order_id: orderId, value: subtotal });
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
          <Field label="Contact number">
            <input className="ck-input" value={form.phone} maxLength={15} inputMode="tel"
              onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          {currentGate?.phone_verified && !currentGate.blocked && (
            <p className="text-xs font-semibold text-success">✓ Mobile number verified</p>
          )}
          {currentGate?.blocked && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This phone number has been blocked by our team. Please contact support on +91 97117 20846.</span>
            </div>
          )}
          {!currentGate?.blocked && currentGate?.needs_otp && (
            <PhoneVerification phone={form.phone} onVerified={refreshGate} />
          )}


          <Field label="Address">
            <textarea className="ck-input" rows={3} value={form.address} maxLength={300}
              onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>

          <button onClick={pinLocation}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-accent/40 py-3 text-sm font-semibold text-primary">
            <Navigation className="h-4 w-4" />
            {coords ? "Update my current location" : "Use my current location"}
          </button>
          {coords && distanceKm != null && !outOfRange && (
            <div className="flex items-center gap-1 text-xs text-success">
              <MapPin className="h-3.5 w-3.5" /> Current location saved · ~{distanceKm.toFixed(1)} km from kitchen
            </div>
          )}

          {restaurantClosed && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>This kitchen is closed right now, so orders can’t be placed. Please try again when it reopens.</span>
            </div>
          )}

          {outOfRange && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Sorry, this restaurant does not deliver to your selected location. (~{distanceKm!.toFixed(1)} km, max {pricing.max_delivery_radius_km} km)</span>
            </div>
          )}
        </Section>


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

        <Section title="Order summary">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between py-1 text-sm">
              <span>{it.name} × {it.qty}</span>
              <span className="font-semibold">₹{(it.price * it.qty).toFixed(0)}</span>
            </div>
          ))}
          <div className="my-2 h-px bg-border" />
          <Row label="Food subtotal" value={`₹${subtotal.toFixed(0)}`} />
          <Row
            label={distanceKm != null ? `Delivery fee (${distanceKm.toFixed(1)} km)` : "Delivery fee"}
            value={
              distanceKm != null
                ? outOfRange
                  ? "—"
                  : deliveryFee === 0
                    ? "FREE"
                    : `₹${deliveryFee.toFixed(0)}`
                : "Share location"
            }
          />
          {sundayFree && (
            <p className="text-xs font-semibold text-success">
              Sunday offer applied — FREE DELIVERY on orders above ₹{SUNDAY_OFFER_MIN} 🎉
            </p>
          )}
          {sundayOffer && !sundayFree && (
            <p className="text-xs font-semibold text-primary">
              Sunday offer: add ₹{Math.ceil(SUNDAY_OFFER_MIN - subtotal)} more for FREE DELIVERY 🚚
            </p>
          )}
          {!sundayOffer && toFreeDelivery > 0 && (
            <p className="text-xs font-semibold text-primary">
              Add ₹{toFreeDelivery} more to unlock FREE DELIVERY 🚚
            </p>
          )}
          <Row label="Platform fee" value={`₹${pricing.platform_fee.toFixed(0)}`} />
          <div className="my-2 h-px bg-border" />
          <Row label="Grand total" value={outOfRange ? "—" : `₹${grand.toFixed(0)}`} bold />
        </Section>

        <Section title="Payment">
          <div className={`flex items-center gap-3 rounded-xl border-2 p-3 ${codBlocked ? "border-destructive/40 bg-destructive/5" : "border-primary bg-accent/50"}`}>
            <Wallet className={`h-5 w-5 ${codBlocked ? "text-destructive" : "text-primary"}`} />
            <div className="flex-1">
              <p className="text-sm font-semibold">Cash on Delivery</p>
              <p className="text-[11px] text-muted-foreground">
                {codBlocked
                  ? "Temporarily unavailable for your account"
                  : `Pay ₹${outOfRange ? "—" : grand.toFixed(0)} when your order arrives`}
              </p>
            </div>
            {!codBlocked && <span className="h-4 w-4 rounded-full border-4 border-primary" />}
          </div>
          {currentGate && !currentGate.cod_allowed && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Cash on Delivery is paused for your account after repeated undelivered orders
                {currentGate.disabled_until ? ` until ${new Date(currentGate.disabled_until).toLocaleDateString("en-IN")}` : ""}.
                Prepaid orders only — please contact support on +91 97117 20846.
              </span>
            </div>
          )}
        </Section>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t bg-background p-4">
        {belowMin && (
          <p className="mb-2 text-center text-xs font-semibold text-destructive">
            Minimum order value is ₹{MIN_ORDER_VALUE}. Add ₹{shortfall.toFixed(0)} more to place this order.
          </p>
        )}
        <button onClick={placeOrder} disabled={placing || belowMin || !coords || outOfRange || restaurantClosed || codBlocked}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-60">
          {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {codBlocked
            ? "Cash on Delivery unavailable"
            : belowMin
              ? `Add ₹${shortfall.toFixed(0)} more to order`
              : !coords
                ? "Share location to continue"
                : outOfRange
                  ? "Outside delivery area"
                  : `Place Order · ₹${grand.toFixed(0)}`}
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
