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
  { max_order: 199, rates: [20, 30, 40, 50] },
  { max_order: 249, rates: [10, 20, 30, 40] },
  { max_order: 299, rates: [0, 10, 20, 30] },
  { max_order: 399, rates: [0, 0, 10, 20] },
  { max_order: null, rates: [0, 0, 0, 10] },
];

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
/** Sunday offer: free delivery on orders of ₹300+ (IST). */
export const SUNDAY_OFFER_MIN = 300;

export function isSundayIST(now: Date = new Date()): boolean {
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
  return ist.getDay() === 0;
}

export function sundayOfferActive(subtotal: number, now?: Date): boolean {
  return isSundayIST(now) && subtotal >= SUNDAY_OFFER_MIN;
}

export function computeDeliveryCharge(
  subtotal: number,
  distanceKm: number,
  slabs: DeliverySlab[] = DEFAULT_DELIVERY_SLABS,
  extraPerKm: number = DEFAULT_EXTRA_PER_KM,
): number {
  if (sundayOfferActive(subtotal)) return 0;
  const d = Math.max(0, distanceKm);
  const slab = pickSlab(Math.max(0, subtotal), slabs);
  let fee = slab.rates[bandIndex(d)] ?? 0;
  if (d > 5) fee += Math.ceil(d - 5) * extraPerKm;
  return Math.max(0, Math.round(fee));
}

/** Order value at or above which delivery is free up to 5 km. */
export function freeDeliveryThreshold(slabs: DeliverySlab[] = DEFAULT_DELIVERY_SLABS): number {
  const free = slabs.find((s) => s.rates.every((r) => r === 0));
  if (!free) return Infinity;
  const idx = slabs.indexOf(free);
  const prev = idx > 0 ? slabs[idx - 1].max_order : null;
  return prev != null ? prev + 1 : 0;
}

/** ₹ still needed to unlock free delivery, or 0 when already unlocked. */
export function amountToFreeDelivery(
  subtotal: number,
  slabs: DeliverySlab[] = DEFAULT_DELIVERY_SLABS,
): number {
  const t = freeDeliveryThreshold(slabs);
  if (!isFinite(t)) return 0;
  return Math.max(0, Math.ceil(t - subtotal));
}
