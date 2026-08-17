// Shared date-range filtering for payout/earning dashboards
export type RangeKind = "all" | "today" | "yesterday" | "date";

export type DateRange = { kind: RangeKind; date: string };

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

/** Returns [from, to) bounds, or null for "all time". */
export function rangeBounds(r: DateRange): { from: Date; to: Date } | null {
  if (r.kind === "all") return null;
  let from: Date;
  if (r.kind === "today") from = startOfDay(new Date());
  else if (r.kind === "yesterday") {
    from = startOfDay(new Date());
    from.setDate(from.getDate() - 1);
  } else {
    if (!r.date) return null;
    const [y, m, d] = r.date.split("-").map(Number);
    if (!y || !m || !d) return null;
    from = new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

export function inRange(created_at: string | Date, r: DateRange) {
  const b = rangeBounds(r);
  if (!b) return true;
  const t = new Date(created_at).getTime();
  return t >= b.from.getTime() && t < b.to.getTime();
}

export function rangeLabel(r: DateRange) {
  if (r.kind === "all") return "All time";
  if (r.kind === "today") return "Today";
  if (r.kind === "yesterday") return "Yesterday";
  if (!r.date) return "Pick a date";
  const [y, m, d] = r.date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const todayInputValue = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
