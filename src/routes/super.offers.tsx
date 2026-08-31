import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgePercent, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/payouts";

export const Route = createFileRoute("/super/offers")({
  component: SuperOffers,
  head: () => ({
    meta: [
      { title: "Offers & Coupons — KhanaGharTak Super Admin" },
      { name: "description", content: "Review the live KhanaGharTak customer offers, discounts and delivery pricing rules." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Offers & Coupons — KhanaGharTak Super Admin" },
      { property: "og:description", content: "Review the live KhanaGharTak customer offers, discounts and delivery pricing rules." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Pricing = {
  platform_fee: number;
  delivery_per_km: number;
  max_delivery_radius_km: number;
  delivery_slabs: any;
  delivery_extra_per_km: number;
};

function SuperOffers() {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [used, setUsed] = useState<{ orders: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: d }] = await Promise.all([
        supabase.rpc("public_pricing" as any),
        supabase.from("orders").select("discount").gt("discount", 0),
      ]);
      setPricing(((p ?? [])[0] ?? null) as Pricing | null);
      const rows = (d ?? []) as { discount: number }[];
      setUsed({ orders: rows.length, total: rows.reduce((s, r) => s + Number(r.discount ?? 0), 0) });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex items-center gap-2">
        <BadgePercent className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Offers &amp; Coupons</h1>
          <p className="text-sm text-muted-foreground">Every discount currently applied to customer orders.</p>
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">First-order discount — 5% off, up to ₹25</p>
            <p className="text-xs text-muted-foreground">Applied automatically on a customer's first non-cancelled order.</p>
          </div>
          <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-bold text-success">Live</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Orders discounted" value={String(used?.orders ?? 0)} />
          <Stat label="Discount given" value={inr(used?.total ?? 0)} />
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <p className="text-sm font-bold">Delivery &amp; fees in force</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Platform fee" value={inr(Number(pricing?.platform_fee ?? 0))} />
          <Stat label="Per extra km" value={inr(Number(pricing?.delivery_extra_per_km ?? 0))} />
          <Stat label="Free delivery" value="Disabled" />
          <Stat label="Other coupons" value="None active" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Delivery slabs and fees are edited in Platform settings. No promotional free-delivery or Sunday offer is running.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-secondary/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-extrabold">{value}</p>
    </div>
  );
}
