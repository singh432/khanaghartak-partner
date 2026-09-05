/**
 * Delivery-time estimate for KhanaGharTak.
 * Depends on what is ordered (food takes longer, sweets are quick) and on how
 * far the kitchen is from the customer. Replaces the manual "delivery time"
 * text that restaurant owners used to type in.
 */

export type EtaItem = {
  name: string;
  qty: number;
  /** Portion sold by weight ⇒ sweet-shop style item that is packed, not cooked. */
  portion?: string | null;
  veg_type?: "veg" | "nonveg";
};

/** Cooked food never promises less than this. */
export const MIN_FOOD_PREP_MIN = 35;
/** Packed sweets / weight-sold items are ready much faster. */
export const SWEETS_PREP_MIN = 15;
/** Average riding speed used to convert distance into minutes. */
export const MIN_PER_KM = 3;

const WEIGHT_PORTIONS = new Set(["kg", "g500", "g250"]);

function isSweetItem(i: EtaItem): boolean {
  if (i.portion && WEIGHT_PORTIONS.has(i.portion)) return true;
  const n = i.name.toLowerCase();
  return ["sweet", "mithai", "barfi", "burfi", "ladoo", "laddu", "rasgulla", "gulab jamun", "peda", "halwa", "jalebi", "rasmalai"]
    .some((w) => n.includes(w));
}

function isHandiNonVeg(i: EtaItem): boolean {
  return i.veg_type === "nonveg" && i.name.toLowerCase().includes("handi");
}

/** Kitchen preparation time in minutes for a basket of items. */
export function prepMinutes(items: EtaItem[]): number {
  if (!items.length) return MIN_FOOD_PREP_MIN;

  // Slow-cooked non-veg handi dominates everything else.
  if (items.some(isHandiNonVeg)) return 150;

  const allSweets = items.every(isSweetItem);
  let prep = allSweets ? SWEETS_PREP_MIN : MIN_FOOD_PREP_MIN;

  // Bigger orders take the kitchen longer — 2 min per extra unit past the
  // first two, capped so the promise stays realistic.
  const units = items.reduce((s, i) => s + Math.max(1, i.qty), 0);
  prep += Math.min(20, Math.max(0, units - 2) * 2);

  // A mixed basket (sweets + cooked food) needs both counters.
  if (!allSweets && items.some(isSweetItem)) prep += 5;

  return prep;
}

/** Travel time in minutes for a kitchen→customer distance. */
export function travelMinutes(distanceKm?: number | null): number {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return 10;
  return Math.max(5, Math.round(distanceKm * MIN_PER_KM));
}

function round5(n: number): number {
  return Math.max(5, Math.round(n / 5) * 5);
}

export type Eta = { min: number; max: number; label: string };

/** Full estimate: preparation + travel, shown as a 10-minute window. */
export function estimateEta(items: EtaItem[], distanceKm?: number | null): Eta {
  const total = prepMinutes(items) + travelMinutes(distanceKm);
  const min = round5(total);
  const max = min + 10;
  return { min, max, label: `${min}–${max} min` };
}

/**
 * Estimate shown on listing/menu screens where the basket is unknown —
 * plain cooked-food baseline plus travel time.
 */
export function browseEta(distanceKm?: number | null): Eta {
  const total = MIN_FOOD_PREP_MIN + travelMinutes(distanceKm);
  const min = round5(total);
  return { min, max: min + 10, label: `${min}–${min + 10} min` };
}
