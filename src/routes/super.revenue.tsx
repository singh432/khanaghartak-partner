import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { IndianRupee, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/supabase-paged";
import { fetchAllZones, type DeliveryZone } from "@/lib/zones";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { inRange, rangeLabel, todayInputValue, type DateRange } from "@/lib/date-range";
import { sumPayouts, inr } from "@/lib/payouts";

export const Route = createFileRoute("/super/revenue")({
  component: SuperRevenue,
  head: () => ({
    meta: [
      { title: "Revenue & Profit — KhanaGharTak Super Admin" },
      { name: "description", content: "Zone-wise revenue, restaurant payouts, rider payouts and net profit for KhanaGharTak." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Revenue & Profit — KhanaGharTak Super Admin" },
      { property: "og:description", content: "Zone-wise revenue, restaurant payouts, rider payouts and net profit for KhanaGharTak." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type O = {
  status: string; total: number; subtotal: number; platform_fee: number; discount: number;
  delivery_fee: number; created_at: string; zone_id: string | null; payment_method: string | null;
};

function SuperRevenue() {
  const [orders, setOrders] = useState<O[]>([]);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [range, setRange] = useState<DateRange>({ kind: "all", date: todayInputValue() });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [o, z] = await Promise.all([
        fetchAll<O>(() => supabase.from("orders").select("status,total,subtotal,platform_fee,delivery_fee,discount,created_at,zone_id,payment_method") as any),
        fetchAllZones().catch(() => [] as DeliveryZone[]),
      ]);
      setOrders(o);
      setZones(z);
      setLoading(false);
    })();
  }, []);

  const scoped = useMemo(() => orders.filter((o) => inRange(o.created_at, range)), [orders, range]);

  const totals = useMemo(() => {
    const delivered = scoped.filter((o) => o.status === "delivered");
    const allRevenue = sumPayouts(scoped as any);
    const p = sumPayouts(delivered as any);
    return {
      orders: scoped.length,
      delivered: delivered.length,
      cancelled: scoped.filter((o) => ["cancelled", "rejected"].includes(o.status)).length,
      revenue: delivered.reduce((s, o) => s + Number(o.total), 0),
      restaurant: p.restaurant,
      gross: allRevenue.platformGross,
      discounts: allRevenue.discount,
      adjustments: allRevenue.adjustment,
      actual: allRevenue.platformActual,
      rider: p.rider,
      net: allRevenue.platformNet,
    };
  }, [scoped]);

  const byZone = useMemo(() => {
    const rows = zones.map((z) => ({ id: z.id, name: z.name, orders: scoped.filter((o) => o.zone_id === z.id) }));
    rows.push({ id: "none", name: "Unassigned", orders: scoped.filter((o) => !o.zone_id) });
    return rows
      .map((r) => {
        const delivered = r.orders.filter((o) => o.status === "delivered");
        const allRevenue = sumPayouts(r.orders as any);
        const p = sumPayouts(delivered as any);
        return {
          id: r.id,
          name: r.name,
          count: r.orders.length,
          delivered: delivered.length,
          cancelled: r.orders.filter((o) => ["cancelled", "rejected"].includes(o.status)).length,
          revenue: allRevenue.platformActual,
          restaurant: p.restaurant,
          rider: p.rider,
          net: allRevenue.platformNet,
        };
      })
      .filter((r) => r.count > 0 || r.id !== "none")
      .sort((a, b) => b.revenue - a.revenue);
  }, [zones, scoped]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IndianRupee className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Revenue &amp; Profit</h1>
            <p className="text-sm text-muted-foreground">{rangeLabel(range)} · platform revenue includes all orders</p>
          </div>
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={String(totals.orders)} />
        <Stat label="Delivered" value={String(totals.delivered)} />
        <Stat label="Cancelled" value={String(totals.cancelled)} />
        <Stat label="Customer payments (delivered)" value={inr(totals.revenue)} />
        <Stat label="Restaurant payout" value={inr(totals.restaurant)} />
        <Stat label="Gross platform revenue (all orders)" value={inr(totals.gross)} />
        <Stat label="Customer discounts" value={inr(-totals.discounts)} />
        {totals.adjustments !== 0 && <Stat label="Other adjustments" value={inr(totals.adjustments)} />}
        <Stat label="Total platform revenue" value={inr(totals.actual)} />
        <Stat label="Rider payout (delivered)" value={inr(totals.rider)} />
        <Stat label="Final net profit" value={inr(totals.net)} highlight />
        <Stat label="AOV" value={inr(totals.delivered ? totals.revenue / totals.delivered : 0)} />
      </div>

      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Zone</th>
              <th className="px-4 py-3">Orders</th>
              <th className="px-4 py-3">Delivered</th>
              <th className="px-4 py-3">Cancelled</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Restaurant</th>
              <th className="px-4 py-3">Rider</th>
              <th className="px-4 py-3">Net profit</th>
            </tr>
          </thead>
          <tbody>
            {byZone.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{r.name}</td>
                <td className="px-4 py-3">{r.count}</td>
                <td className="px-4 py-3">{r.delivered}</td>
                <td className="px-4 py-3">{r.cancelled}</td>
                <td className="px-4 py-3 font-semibold">{inr(r.revenue)}</td>
                <td className="px-4 py-3">{inr(r.restaurant)}</td>
                <td className="px-4 py-3">{inr(r.rider)}</td>
                <td className="px-4 py-3 font-bold text-success">{inr(r.net)}</td>
              </tr>
            ))}
            {byZone.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No zones yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${highlight ? "text-success" : ""}`}>{value}</p>
    </div>
  );
}
