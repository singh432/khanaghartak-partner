import type { DateRange, RangeKind } from "@/lib/date-range";
import { todayInputValue } from "@/lib/date-range";

export function DateRangeFilter({
  value,
  onChange,
  className = "",
}: { value: DateRange; onChange: (r: DateRange) => void; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <select
        value={value.kind}
        onChange={(e) => {
          const kind = e.target.value as RangeKind;
          onChange({ kind, date: value.date || todayInputValue() });
        }}
        className="h-9 rounded-lg border bg-background px-3 text-sm outline-none"
        aria-label="Date range"
      >
        <option value="all">All time</option>
        <option value="today">Today</option>
        <option value="yesterday">Yesterday</option>
        <option value="date">Pick a date</option>
      </select>
      {value.kind === "date" && (
        <input
          type="date"
          value={value.date}
          max={todayInputValue()}
          onChange={(e) => onChange({ kind: "date", date: e.target.value })}
          className="h-9 rounded-lg border bg-background px-3 text-sm outline-none"
          aria-label="Pick a date"
        />
      )}
    </div>
  );
}
