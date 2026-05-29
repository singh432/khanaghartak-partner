import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { BrandHeader } from "@/components/BrandHeader";
import { PageSpinner } from "@/components/PageState";
import { withTimeout } from "@/lib/supabase-query";
import { MapPin, Navigation, Loader2, Wallet } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Checkout — KhanaGharTak" },
      { name: "description", content: "Confirm your delivery details and place your Cash on Delivery order with KhanaGharTak." },
      { property: "og:title", content: "Checkout — KhanaGharTak" },
      { property: "og:description", content: "Confirm your delivery details and place your Cash on Delivery order with KhanaGharTak." },
      { property: "og:url", content: "https://khanaghartak.lovable.app/checkout" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.lovable.app/checkout" }],
  }),
});

const DELIVERY_FEE = 25;

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
  const [form, setForm] = useState({ name: "", phone: "", address: "", landmark: "", notes: "" });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);
  useEffect(() => { if (!loading && ready && items.length === 0) navigate({ to: "/menu" }); }, [items, loading, ready, navigate]);

  useEffect(() => {
    if (!user) return;
    withTimeout(supabase.from("profiles").select("full_name, phone, address, landmark, latitude, longitude")
      .eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setForm({
            name: data.full_name ?? "", phone: data.phone ?? "",
            address: data.address ?? "", landmark: data.landmark ?? "", notes: "",
          });
          if (data.latitude && data.longitude) setCoords({ lat: data.latitude, lng: data.longitude });
        }
      })).catch(() => {});
  }, [user]);

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

  const grand = subtotal + DELIVERY_FEE;

  const placeOrder = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;
    setPlacing(true);
    const { data, error } = await supabase.rpc("place_order", {
      _items: items.map((i) => ({ id: i.id, qty: i.qty })),
      _customer_name: form.name,
      _customer_phone: form.phone,
      _address: form.address,
      _landmark: form.landmark || undefined,
      _notes: form.notes || undefined,
      _latitude: coords?.lat,
      _longitude: coords?.lng,
    });
    setPlacing(false);
    if (error || !data) return toast.error(error?.message ?? "Could not place order");
    await supabase.from("profiles").upsert({
      id: user.id, full_name: form.name, phone: form.phone,
      address: form.address, landmark: form.landmark || null,
      latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
    }, { onConflict: "id" });
    clear();
    navigate({ to: "/order/$id", params: { id: data as unknown as string } });
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
          {coords && (
            <div className="flex items-center gap-1 text-xs text-success">
              <MapPin className="h-3.5 w-3.5" /> Location pinned
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
          <Row label="Item total" value={`₹${subtotal.toFixed(0)}`} />
          <Row label="Delivery fee" value={`₹${DELIVERY_FEE.toFixed(0)}`} />
          <Row label="Grand total" value={`₹${grand.toFixed(0)}`} bold />
        </Section>

        <Section title="Payment">
          <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-accent/50 p-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Cash on Delivery</p>
              <p className="text-[11px] text-muted-foreground">Pay ₹{grand.toFixed(0)} when your order arrives</p>
            </div>
            <span className="h-4 w-4 rounded-full border-4 border-primary" />
          </div>
        </Section>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t bg-background p-4">
        <button onClick={placeOrder} disabled={placing}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)]">
          {placing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Place Order · ₹{grand.toFixed(0)}
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
