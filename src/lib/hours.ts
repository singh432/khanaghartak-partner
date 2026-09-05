/**
 * Opening / closing hours for kitchens.
 * The stored opening_time / closing_time decide whether a restaurant is open,
 * so owners never have to flip a switch. is_open === false still works as an
 * emergency pause (used by owners, zone managers and super admin).
 */

function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mi)) return null;
  return h * 60 + mi;
}

function nowMinutes(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** True when the current clock time falls inside the opening window. */
export function withinHours(
  opening?: string | null,
  closing?: string | null,
  at: Date = new Date(),
): boolean {
  const open = toMinutes(opening);
  const close = toMinutes(closing);
  // No hours configured → treat as always available.
  if (open == null || close == null || open === close) return true;
  const now = nowMinutes(at);
  // Overnight window (e.g. 18:00 → 02:00)
  if (close < open) return now >= open || now < close;
  return now >= open && now < close;
}

export type HoursLike = {
  is_open?: boolean | null;
  opening_time?: string | null;
  closing_time?: string | null;
};

/** Final open/closed answer for a restaurant. */
export function isRestaurantOpen(r: HoursLike, at: Date = new Date()): boolean {
  if (r.is_open === false) return false;
  return withinHours(r.opening_time, r.closing_time, at);
}

function fmt(t?: string | null): string | null {
  const mins = toMinutes(t);
  if (mins == null) return null;
  const h24 = Math.floor(mins / 60);
  const mi = mins % 60;
  const suffix = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${mi ? `:${String(mi).padStart(2, "0")}` : ""} ${suffix}`;
}

/** "10 AM – 10 PM" or null when no hours are set. */
export function hoursLabel(opening?: string | null, closing?: string | null): string | null {
  const a = fmt(opening);
  const b = fmt(closing);
  if (!a || !b) return null;
  return `${a} – ${b}`;
}
