/**
 * Centralised delivery-charge calculation for KhanaGharTak.
 * The SAME rules are mirrored in the SQL function public.compute_delivery_fee()
 * used by place_order, so the UI always matches the stored order.
 *
 * Slabs are configurable from Super Admin settings (platform_settings.delivery_slabs).
 */

export type DeliverySlab = {
  /** Upper bound of the order value slab (inclusive). null = no upper bound. */
  max_order: number | null;
  /** Charge for 0-2, 2-4, 4-6, 6-8 km bands. */
  rates: [number, number, number, number];
};

export const DEFAULT_DELIVERY_SLABS: DeliverySlab[] = [
  { max_order: 49, rates: [40, 50, 60, 70] },
  { max_order: 99, rates: [30, 40, 50, 60] },
  { max_order: 199, rates: [20, 30, 40, 50] },
  { max_order: 249, rates: [10, 20, 30, 40] },
  { max_order: 299, rates: [10, 10, 20, 30] },
  { max_order: 399, rates: [10, 10, 10, 20] },
  { max_order: null, rates: [10, 10, 10, 10] },
];

/** Minimum delivery charge — there is no free delivery. */
export const MIN_DELIVERY_CHARGE = 10;

/** ₹ per additional km beyond 8 km. */
export const DEFAULT_EXTRA_PER_KM = 8;

/** Distance band index: 0-2, 2-4, 4-6, 6-8 km. */
function bandIndex(distanceKm: number): 0 | 1 | 2 | 3 {
  if (distanceKm <= 2) return 0;
  if (distanceKm <= 4) return 1;
  if (distanceKm <= 6) return 2;
  return 3;
}

export function pickSlab(subtotal: number, slabs: DeliverySlab[]): DeliverySlab {
  for (const s of slabs) {
    if (s.max_order == null || subtotal <= s.max_order) return s;
  }
  return slabs[slabs.length - 1];
}

/**
 * Delivery fee in ₹ from order value + restaurant→customer distance.
 * ≤8 km: exact table charge.
 * >8 km: table charge + extraPerKm for every km beyond 8 (rounded up).
 */
export function computeDeliveryCharge(
  subtotal: number,
  distanceKm: number,
  slabs: DeliverySlab[] = DEFAULT_DELIVERY_SLABS,
  extraPerKm: number = DEFAULT_EXTRA_PER_KM,
): number {
  const d = Math.max(0, distanceKm);
  const slab = pickSlab(Math.max(0, subtotal), slabs);
  let fee = slab.rates[bandIndex(d)] ?? 0;
  if (d > 8) fee += Math.ceil(d - 8) * extraPerKm;
  return Math.max(MIN_DELIVERY_CHARGE, Math.round(fee));
}
