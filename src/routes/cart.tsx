import { createFileRoute, Link, useNavigate, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useLocationGate } from "@/hooks/useLocationGate";
import { usePricingSettings, ROAD_FACTOR } from "@/hooks/usePricingSettings";
import { computeDeliveryCharge } from "@/lib/delivery-pricing";
import { distanceKm as haversineKm, type LatLng } from "@/lib/geo";
import { isRestaurantOpen } from "@/lib/hours";
import { estimateEta } from "@/lib/eta";
import { primeVoice } from "@/lib/voice";
import { track } from "@/lib/analytics";
import { useFormDraft } from "@/hooks/useFormDraft";
import { withTimeout } from "@/lib/supabase-query";
import { cartHasHandiNonVeg, HANDI_PREP_NOTE, cartHasCake, CAKE_PREP_NOTE } from "@/lib/portions";
import { fetchActiveZones, resolveCustomerZone, isLocationInServiceZone, OUTSIDE_ZONE_MESSAGE, type DeliveryZone } from "@/lib/zones";
import { BrandHeader } from "@/components/BrandHeader";
import { PageSpinner } from "@/components/PageState";
import { PhoneVerification } from "@/components/PhoneVerification";
import { isPartnerApp } from "@/lib/capacitor";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Navigation,
  Loader2,
  Wallet,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  UtensilsCrossed,
} from "lucide-react";

const LocationPicker = lazy(() => import("@/components/LocationPicker.client"));

export const Route = createFileRoute("/cart")({
  component: UnifiedCartPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Your Cart & Checkout — KhanaGharTak" },
      { name: "description", content: "Review items, add delivery address, and place your order with Cash on Delivery." },
      { property: "og:title", content: "Your Cart & Checkout — KhanaGharTak" },
      { property: "og:description", content: "Review items, add delivery address, and place your order with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/cart" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/cart" }],
  }),
});

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, "Please enter a valid phone number"),
  address: z.string().trim().min(5, "Please enter your complete delivery address").max(300),
});

export function UnifiedCartPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { items, ready, inc, dec, remove, clear, subtotal, totalQty } = useCart();
  const pricing = usePricingSettings();
  const { coords: liveGpsCoords, status: locationStatus, request: requestLocation } = useLocationGate();

  // Form states
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Restaurant states
  const [restaurantCoords, setRestaurantCoords] = useState<LatLng | null>(null);
  const [restaurantZoneId, setRestaurantZoneId] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState<string>("");
  const [restaurantClosed, setRestaurantClosed] = useState(false);

  // Order status
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [gate, setGate] = useState<({ needs_otp: boolean; phone_verified: boolean; cod_allowed: boolean; disabled_until: string | null; blocked: boolean } & { phone: string }) | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [firstOrder, setFirstOrder] = useState(false);

  // 1. Fetch active delivery zones
  useEffect(() => {
    fetchActiveZones().then(setZones).catch(() => setZones([]));
  }, []);

  // 2. Fetch first order discount eligibility
  useEffect(() => {
    if (!user) {
      setFirstOrder(false);
      return;
    }
    supabase.rpc("first_order_discount_status").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      setFirstOrder(!!row?.eligible);
    }, () => {});
  }, [user]);

  // 3. COD gate check for phone number
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

  // 4. Draft preservation
  const draftKey = user ? `kgt-draft-checkout-${user.id}` : null;
  const clearDraft = useFormDraft(draftKey, { form, coords }, (d) => {
    if (d.form) setForm((cur) => ({ ...cur, ...d.form }));
    if (d.coords) setCoords(d.coords);
  });

  // 5. Auth check
  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login", search: { as: "customer" } });
  }, [user, authLoading, navigate]);

  // 6. Prefill from user profile & localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const localAddr = localStorage.getItem("kgt:delivery-address");
      if (localAddr) setForm((cur) => ({ ...cur, address: cur.address || localAddr }));

      try {
        const rawCoords = localStorage.getItem("kgt:user-coords");
        if (rawCoords) {
          const parsed = JSON.parse(rawCoords);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            setCoords((cur) => cur ?? { lat: parsed.lat, lng: parsed.lng });
          }
        }
      } catch {}
    }

    if (!user) return;
    withTimeout(
      supabase
        .from("profiles")
        .select("full_name, phone, address, latitude, longitude")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setForm((cur) => ({
              name: cur.name || data.full_name || "",
              phone: cur.phone || data.phone || (user.phone ? user.phone.replace("+91", "") : ""),
              address: cur.address || data.address || "",
            }));
            if (data.latitude && data.longitude) {
              setCoords((cur) => cur ?? { lat: data.latitude!, lng: data.longitude! });
            }
          }
        })
    ).catch(() => {});
  }, [user]);

  // 7. Auto-bind live GPS coords if user has allowed location
  useEffect(() => {
    if (liveGpsCoords && !coords) {
      setCoords(liveGpsCoords);
    }
  }, [liveGpsCoords, coords]);

  // 8. Fetch restaurant coordinates, name, and zone from first cart item
  useEffect(() => {
    if (!ready || items.length === 0) return;
    let active = true;
    (async () => {
      const rId = items[0]?.restaurant_id;
      if (!rId) return;

      const { data: r } = await supabase
        .from("restaurants")
        .select("id, name, latitude, longitude, is_open, opening_time, closing_time, zone_id")
        .eq("id", rId)
        .maybeSingle();

      if (!active || !r) return;
      setRestaurantName(r.name || "");
      setRestaurantClosed(!isRestaurantOpen(r as any));
      setRestaurantZoneId(r.zone_id ?? null);
      if (r.latitude != null && r.longitude != null) {
        setRestaurantCoords({ lat: r.latitude, lng: r.longitude });
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, items]);

  // 9. Dynamic distance and delivery fee calculations on the SAME page
  const distanceKm = useMemo(() => {
    if (!coords || !restaurantCoords) return null;
    return haversineKm(restaurantCoords, coords) * ROAD_FACTOR;
  }, [coords, restaurantCoords]);

  const baseDeliveryFee = useMemo(() => {
    if (distanceKm == null) return 0;
    return computeDeliveryCharge(subtotal, distanceKm, pricing.delivery_slabs, pricing.delivery_extra_per_km);
  }, [subtotal, distanceKm, pricing.delivery_slabs, pricing.delivery_extra_per_km]);

  const deliveryFee = baseDeliveryFee;

  // 10. Service Zone validations
  const customerZone = useMemo(() => {
    return coords && zones.length > 0 ? resolveCustomerZone(coords, form.address, zones) : null;
  }, [coords, form.address, zones]);

  const zoneMismatch = !!(customerZone && restaurantZoneId && customerZone.id !== restaurantZoneId);
  const outOfRange = !customerZone || !isLocationInServiceZone(coords, form.address, zones);

  const firstOrderDiscount = firstOrder ? Math.min(Math.round(subtotal * 0.05), 25) : 0;
  const isDeliveryFeeApplicable = distanceKm != null && !outOfRange && !zoneMismatch;
  const effectiveDeliveryFee = isDeliveryFeeApplicable ? deliveryFee : 0;

  const grand = Math.max(
    0,
    subtotal + effectiveDeliveryFee + pricing.platform_fee - firstOrderDiscount
  );

  const currentGate = gate?.phone === phoneDigits ? gate : null;
  const codBlocked = !!currentGate && (!currentGate.cod_allowed || currentGate.blocked);

  // 11. Quick GPS location pin action
  const pinLocation = () => {
    if (typeof window === "undefined") return;
    if (liveGpsCoords) {
      setCoords(liveGpsCoords);
      toast.success("Current GPS location applied");
      return;
    }
    if (!navigator.geolocation) return toast.error("Geolocation is not supported by your browser");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pt = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCoords(pt);
        toast.success("Location pinpointed");
      },
      (e) => toast.error(e.message || "Could not retrieve location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 12. Direct Place Order action
  const placeOrder = async () => {
    primeVoice();
    track("checkout_started", { value: subtotal });

    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (restaurantClosed) return toast.error("This restaurant is closed right now. Please order when it reopens.");

    if (currentGate?.blocked) return toast.error("This phone number is blocked. Please contact support.");
    if (currentGate?.needs_otp) return toast.error("Please verify your mobile number to complete the order.");
    if (currentGate && !currentGate.cod_allowed) return toast.error("Cash on Delivery is temporarily disabled for your account.");

    if (!coords) return toast.error("Please select or confirm your delivery location on the map.");
    if (outOfRange) return toast.error(OUTSIDE_ZONE_MESSAGE);
    if (zoneMismatch) return toast.error("This restaurant belongs to another zone and cannot deliver to your location.");
    if (!user) return;

    setPlacing(true);
    track("payment_started", { value: subtotal, meta: { method: "cod" } });

    const { data, error } = await supabase.rpc("place_order", {
      _items: items.map((i) => ({ id: i.menu_item_id, portion: i.portion, qty: i.qty })),
      _customer_name: form.name.trim(),
      _customer_phone: form.phone.trim(),
      _address: form.address.trim(),
      _latitude: coords.lat,
      _longitude: coords.lng,
    });

    setPlacing(false);
    if (error || !data) {
      track("payment_failed" as never, { value: subtotal, repeatable: true, meta: { error: error?.message ?? "unknown" } });
      return toast.error(error?.message ?? "Could not place order");
    }

    const orderId = data as unknown as string;
    import("@/lib/capacitor").then(({ nativeHaptics }) => nativeHaptics.success()).catch(() => {});
    track("payment_success", { order_id: orderId, value: subtotal, meta: { method: "cod" } });
    track("order_placed", { order_id: orderId, value: subtotal });

    // Save profile address in background
    try {
      localStorage.setItem("kgt:delivery-address", form.address.trim());
      supabase.from("profiles").upsert({
        id: user.id,
        full_name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
      }, { onConflict: "id" }).then(() => {}, () => {});
    } catch {}

    setPlaced(true);
    clearDraft();
    clear();
    navigate({ to: "/order/$id", params: { id: orderId } });
  };

  if (!ready || authLoading) return <PageSpinner label="Loading your cart & order details…" />;

  // Empty Cart State
  if (items.length === 0 && !placed) {
    return (
      <div>
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

  return (
    <div className="pb-36 bg-background min-h-screen">
      <BrandHeader subtitle={`Order · ${totalQty} item${totalQty > 1 ? "s" : ""}`} />

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

        {/* 1. CART ITEMS SECTION */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <div>
              <h2 className="text-sm font-bold text-foreground">Order Items</h2>
              {restaurantName && <p className="text-xs text-muted-foreground">From {restaurantName}</p>}
            </div>
            {items[0]?.restaurant_id && (
              <Link
                to="/menu"
                search={{ r: items[0].restaurant_id }}
                className="text-xs font-bold text-primary hover:underline"
              >
                + Add more
              </Link>
            )}
          </div>

          <div className="space-y-3 divide-y divide-border/30">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-3 pt-2 first:pt-0">
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

        {/* 2. DELIVERY DETAILS SECTION (Add while ordering) */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> Delivery Address
            </h2>
            {customerZone && (
              <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {customerZone.name} Zone
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Full Name</label>
              <input
                className="ck-input"
                value={form.name}
                maxLength={80}
                placeholder="Enter your name"
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Contact Mobile Number</label>
              <input
                className="ck-input"
                value={form.phone}
                maxLength={15}
                inputMode="tel"
                placeholder="10-digit mobile number"
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              {currentGate?.phone_verified && !currentGate.blocked && (
                <p className="mt-1 text-xs font-semibold text-success flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mobile number verified
                </p>
              )}
              {currentGate?.blocked && (
                <div className="mt-2 flex items-start gap-2 rounded-xl border-2 border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>This phone number has been blocked. Please contact support.</span>
                </div>
              )}
              {!currentGate?.blocked && currentGate?.needs_otp && (
                <div className="mt-2">
                  <PhoneVerification phone={form.phone} onVerified={refreshGate} />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                Delivery Address & Landmark
              </label>
              <textarea
                className="ck-input"
                rows={2}
                value={form.address}
                maxLength={300}
                placeholder="House / flat no., street, landmark (e.g. Near Shiv Mandir, Station Road)"
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            {/* Location Pinning Controls */}
            <div className="pt-1 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={pinLocation}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 px-2.5 text-xs font-semibold text-foreground bg-muted/30 hover:bg-muted active:scale-95 transition"
                >
                  <Navigation className="h-3.5 w-3.5 text-primary" /> Use Current Location
                </button>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 py-2 px-2.5 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 active:scale-95 transition"
                >
                  <MapPin className="h-3.5 w-3.5" /> {coords ? "Change on Map" : "Pin on Map"}
                </button>
              </div>

              {coords && !outOfRange && (
                <p className="text-[11px] text-success font-semibold flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  Location pinned for rider navigation {customerZone ? `(${customerZone.name})` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 3. SERVICE AREA ALERTS */}
        {restaurantClosed && (
          <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This kitchen is closed right now. Orders cannot be placed until it reopens.</span>
          </div>
        )}

        {outOfRange && coords && (
          <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{OUTSIDE_ZONE_MESSAGE} (Deliveries active in Shankargarh & Chakghat zones).</span>
          </div>
        )}

        {zoneMismatch && !outOfRange && (
          <div className="rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This restaurant belongs to another zone and cannot deliver across delivery zones.</span>
          </div>
        )}

        {/* 4. BILL SUMMARY & LIVE CALCULATIONS (On the SAME page) */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-2.5 text-sm">
          <div className="flex items-center justify-between pb-1 border-b border-border/50">
            <h2 className="text-sm font-bold text-foreground">Bill Summary</h2>
            <span className="text-[11px] text-muted-foreground font-medium">
              ETA: {estimateEta(items, distanceKm).label}
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <Row label="Food Subtotal" value={`₹${subtotal.toFixed(0)}`} />

            {/* LIVE DELIVERY FEE */}
            <Row
              label={
                distanceKm != null
                  ? `Delivery Fee (${distanceKm.toFixed(1)} km)`
                  : "Delivery Fee"
              }
              value={
                distanceKm != null
                  ? outOfRange
                    ? "—"
                    : deliveryFee === 0
                    ? "FREE"
                    : `₹${deliveryFee.toFixed(2)}`
                  : coords
                  ? "Calculating…"
                  : "Allow location"
              }
            />

            {/* PLATFORM FEE */}
            <Row label="Platform Fee" value={`₹${pricing.platform_fee.toFixed(0)}`} />

            {/* FIRST ORDER OFFER */}
            {firstOrder && (
              <>
                <Row label="Welcome Offer (5% off)" value={`− ₹${firstOrderDiscount.toFixed(0)}`} highlight />
                <p className="text-[11px] font-semibold text-success">🎉 Welcome offer applied on your first order!</p>
              </>
            )}

            <div className="my-2 h-px bg-border/60" />

            {/* GRAND TOTAL */}
            <Row
              label="Grand Total"
              value={outOfRange && coords ? "—" : `₹${grand.toFixed(2)}`}
              bold
            />
          </div>
        </div>

        {/* 5. PAYMENT METHOD */}
        <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] space-y-2">
          <h2 className="text-sm font-bold text-foreground">Payment Method</h2>
          <div
            className={`flex items-center gap-3 rounded-xl border-2 p-3 ${
              codBlocked ? "border-destructive/40 bg-destructive/5" : "border-primary bg-primary/5"
            }`}
          >
            <Wallet className={`h-5 w-5 ${codBlocked ? "text-destructive" : "text-primary"}`} />
            <div className="flex-1">
              <p className="text-sm font-bold">Cash on Delivery (COD)</p>
              <p className="text-[11px] text-muted-foreground">
                {codBlocked
                  ? "COD is paused for this account"
                  : `Pay ₹${outOfRange && coords ? "—" : grand.toFixed(2)} in cash or UPI when order arrives`}
              </p>
            </div>
            {!codBlocked && <span className="h-4 w-4 rounded-full border-4 border-primary" />}
          </div>
        </div>
      </div>

      {/* 6. FIXED BOTTOM ACTION BAR */}
      <div
        className="fixed left-1/2 z-50 w-full max-w-[480px] -translate-x-1/2 border-t bg-background/95 backdrop-blur px-4 py-3 shadow-lg"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={placeOrder}
          disabled={
            placing ||
            !coords ||
            outOfRange ||
            zoneMismatch ||
            restaurantClosed ||
            codBlocked ||
            form.address.trim().length < 5
          }
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-soft)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition"
        >
          {placing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing Order…
            </>
          ) : codBlocked ? (
            "Cash on Delivery Unavailable"
          ) : !coords ? (
            "Select Delivery Location"
          ) : form.address.trim().length < 5 ? (
            "Enter Delivery Address Above"
          ) : outOfRange ? (
            "Outside Delivery Service Area"
          ) : zoneMismatch ? (
            "Kitchen Outside Delivery Zone"
          ) : restaurantClosed ? (
            "Restaurant is Closed"
          ) : (
            `Place Order (COD) · ₹${grand.toFixed(2)}`
          )}
        </button>
      </div>

      {/* Map Picker Modal */}
      {showPicker && (
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <LocationPicker
              value={coords}
              onCancel={() => setShowPicker(false)}
              onConfirm={(p, label) => {
                setCoords(p);
                setShowPicker(false);
                if (label && form.address.trim().length < 8) {
                  setForm((c) => ({ ...c, address: label }));
                }
                toast.success("Delivery location confirmed on map");
              }}
            />
          </Suspense>
        </ClientOnly>
      )}

      <style>{`.ck-input { width: 100%; border-radius: 12px; padding: 10px 14px; background: var(--color-input); border: 1px solid var(--color-border); font-size: 13.5px; outline: none; transition: border-color 0.15s; } .ck-input:focus { border-color: var(--color-ring); }`}</style>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${bold ? "text-base font-bold text-foreground" : "text-xs"}`}>
      <span className={bold ? "font-bold text-foreground" : highlight ? "font-semibold text-success" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={bold ? "font-black text-primary text-base" : highlight ? "font-bold text-success" : "font-semibold text-foreground"}>
        {value}
      </span>
    </div>
  );
}
