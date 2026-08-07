import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, X } from "lucide-react";

type Pending = {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
};

export function RatingPrompt({ userId }: { userId: string }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id,restaurant_id,created_at")
        .eq("user_id", userId)
        .eq("status", "delivered")
        .not("restaurant_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);
      const rows = orders ?? [];
      if (!rows.length) return;
      const { data: rated } = await supabase
        .from("restaurant_ratings")
        .select("order_id")
        .in("order_id", rows.map((o) => o.id));
      const ratedIds = new Set((rated ?? []).map((r: { order_id: string }) => r.order_id));
      const target = rows.find((o) => !ratedIds.has(o.id));
      if (!target || !active) return;
      if (localStorage.getItem(`kgt-rating-skip-${target.id}`)) return;
      const { data: rest } = await supabase
        .from("restaurants")
        .select("name")
        .eq("id", target.restaurant_id!)
        .maybeSingle();
      if (!active) return;
      setPending({
        orderId: target.id,
        restaurantId: target.restaurant_id!,
        restaurantName: rest?.name ?? "your last order",
      });
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  if (!pending || done) return null;

  const dismiss = () => {
    localStorage.setItem(`kgt-rating-skip-${pending.orderId}`, "1");
    setDone(true);
  };

  const submit = async () => {
    if (!rating) return;
    setSaving(true);
    const { error } = await supabase.from("restaurant_ratings").insert({
      order_id: pending.orderId,
      restaurant_id: pending.restaurantId,
      user_id: userId,
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (!error) setDone(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/50 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">How was your food?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Rate your last order from {pending.restaurantName}</p>
          </div>
          <button onClick={dismiss} aria-label="Close" className="rounded-full p-1 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={`${n} star`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
            >
              <Star
                className={`h-9 w-9 ${(hover || rating) >= n ? "fill-current text-primary" : "text-muted-foreground/40"}`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more (optional)"
          rows={2}
          className="mt-4 w-full resize-none rounded-2xl border bg-background p-3 text-sm outline-none"
        />

        <button
          onClick={submit}
          disabled={!rating || saving}
          className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit rating"}
        </button>
        <button onClick={dismiss} className="mt-2 w-full py-2 text-xs text-muted-foreground">
          Maybe later
        </button>
      </div>
    </div>
  );
}
