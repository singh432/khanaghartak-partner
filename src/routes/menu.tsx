import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/BrandHeader";
import { useCart, cartKey, type Portion } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";

import { isPieceCategory, isSinglePriceCategory, isSweetCategory, PORTION_LABELS } from "@/lib/portions";
import { PageError, PageSpinner } from "@/components/PageState";
import { withTimeout } from "@/lib/supabase-query";
import { Plus, Minus, Search, Star, Clock } from "lucide-react";

export const Route = createFileRoute("/menu")({
  component: MenuPage,
  validateSearch: (search: Record<string, unknown>) => ({
    r: typeof search.r === "string" ? search.r : undefined,
  }),
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Our Menu — KhanaGharTak" },
      { name: "description", content: "Explore our full menu of home-style Indian dishes. Order online with Cash on Delivery." },
      { property: "og:title", content: "Our Menu — KhanaGharTak" },
      { property: "og:description", content: "Explore our full menu of home-style Indian dishes. Order online with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/menu" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/menu" }],
  }),
});


type Category = { id: string; name: string; priority: number; restaurant_id: string | null };
type MenuItem = {
  id: string; restaurant_id: string; category_id: string; name: string; description: string | null;
  price: number; offer_price: number | null; half_price: number | null; half_offer_price: number | null;
  price_kg: number | null; price_500g: number | null; price_250g: number | null; price_piece: number | null;
  image_url: string | null; veg_type: "veg" | "nonveg"; is_available: boolean;
};

function portionsOf(item: MenuItem, opts: { singlePrice?: boolean; sweet?: boolean } = {}): { portion: Portion; price: number }[] {
  const full = Number(item.offer_price ?? item.price);
  if (opts.sweet) {
    const list: { portion: Portion; price: number }[] = [];
    if (item.price_250g != null) list.push({ portion: "g250", price: Number(item.price_250g) });
    if (item.price_500g != null) list.push({ portion: "g500", price: Number(item.price_500g) });
    if (item.price_kg != null) list.push({ portion: "kg", price: Number(item.price_kg) });
    if (item.price_piece != null) list.push({ portion: "piece", price: Number(item.price_piece) });
    if (list.length > 0) return list;
    return [{ portion: "full", price: full }];
  }
  if (opts.singlePrice) return [{ portion: "full", price: full }];
  const half = item.half_offer_price ?? item.half_price;
  const list: { portion: Portion; price: number }[] = [{ portion: "full", price: full }];
  if (half != null) list.unshift({ portion: "half", price: Number(half) });
  return list.reverse();
}
type Restaurant = {
  id: string; name: string; rating: number; delivery_time: string;
  latitude: number | null; longitude: number | null; status: string | null;
};

function MenuPage() {
  const navigate = useNavigate();
  const { r: restaurantParam } = Route.useSearch();
  const { user, loading } = useAuth();

  const { items: cart, add, inc, dec, totalQty } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [q, setQ] = useState("");
  const [dietFilter, setDietFilter] = useState<"all" | "veg" | "nonveg">("all");

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [showCatPanel, setShowCatPanel] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const [{ data: rs, error: rError }, { data: c, error: cError }, { data: m, error: mError }] = await Promise.all([
          withTimeout(supabase.from("restaurants").select("id, name, rating, delivery_time, latitude, longitude, status").eq("status", "active")),
          withTimeout(supabase.from("categories").select("*").order("priority")),
          withTimeout(supabase.from("menu_items").select("*").order("name")),
        ]);
        if (rError || cError || mError) throw rError ?? cError ?? mError;
        if (!active) return;
        const allRestaurants = (rs ?? []) as Restaurant[];
        // Every approved restaurant is reachable, wherever it is pinned.
        const selected =
          (restaurantParam ? allRestaurants.find((r) => r.id === restaurantParam) : null) ??
          allRestaurants[0] ??
          null;

        setRestaurant(selected);
        const allItems = (m ?? []) as MenuItem[];
        const items = selected ? allItems.filter((it) => it.restaurant_id === selected.id) : [];
        setMenu(items);
        const usedCatIds = new Set(items.map((it) => it.category_id));
        const cats = ((c ?? []) as Category[]).filter(
          (cat) => (selected && cat.restaurant_id === selected.id) || usedCatIds.has(cat.id),
        );
        setCategories(cats);
        if (cats.length) setActiveCat(cats[0].id);
      } catch (err) {
        if (active) setDataError(err instanceof Error ? err.message : "Could not load menu");
      } finally {
        if (active) setDataLoading(false);
      }
    })();
    return () => { active = false; };
  }, [restaurantParam]);


  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return menu;
    return menu.filter((i) => i.name.toLowerCase().includes(term) || (i.description ?? "").toLowerCase().includes(term));
  }, [menu, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const cat of categories) map.set(cat.id, []);
    for (const it of filtered) {
      if (!map.has(it.category_id)) map.set(it.category_id, []);
      map.get(it.category_id)!.push(it);
    }
    return map;
  }, [filtered, categories]);

  const qtyInCart = (key: string) => cart.find((c) => c.id === key)?.qty ?? 0;

  const scrollToCat = (id: string) => {
    setActiveCat(id);
    setShowCatPanel(false);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // observe active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).dataset.cat;
            if (id) setActiveCat(id);
          }
        }
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [grouped]);

  return (
    <div className="pb-32">
      <BrandHeader subtitle={restaurant?.name} />

      <div className="px-4 pt-4">
        {loading && <PageSpinner label="Checking your session…" />}
        {!loading && !user && <PageSpinner label="Opening sign in…" />}
        {!loading && user && dataLoading && <PageSpinner label="Loading menu…" />}
        {!loading && user && dataError && (
          <PageError message={dataError} onRetry={() => window.location.reload()} />
        )}
        {!loading && user && !dataLoading && !dataError && (
          <>
        {restaurant && (
          <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
            <h1 className="text-xl font-extrabold tracking-tight">{restaurant.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success">
                <Star className="h-3 w-3 fill-current" />{Number(restaurant.rating).toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {restaurant.delivery_time}
              </span>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-card px-3 shadow-[var(--shadow-card)]">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60}
            aria-label="Search dishes"
            placeholder="Search dishes..." className="h-11 flex-1 bg-transparent text-sm outline-none" />
        </div>

        <div className="mt-6 space-y-8">
          {categories.map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            const sweet = isSweetCategory(cat.name);
            const byPiece = isPieceCategory(cat.name);
            const singlePrice = !sweet && isSinglePriceCategory(cat.name);
            if (list.length === 0) return null;
            return (
              <section key={cat.id} data-cat={cat.id}
                ref={(el: HTMLElement | null) => { sectionRefs.current[cat.id] = el; }}>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {cat.name} <span className="text-foreground/60">· {list.length}</span>
                </h2>
                <div className="space-y-3">
                  {list.map((item) => (
                    <article key={item.id} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <VegDot type={item.veg_type} />
                          <h3 className="font-semibold leading-tight">{item.name}</h3>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">{item.description}</p>

                        <div className="mt-2 space-y-2">
                          {portionsOf(item, { singlePrice, sweet }).map((p) => {
                            const key = cartKey(item.id, p.portion);
                            const qty = qtyInCart(key);
                            const opts = portionsOf(item, { singlePrice, sweet });
                            const showLabel = sweet || byPiece || (!singlePrice && opts.length > 1);
                            const label = byPiece && !sweet ? "Per piece" : PORTION_LABELS[p.portion];
                            return (
                              <div key={p.portion} className="flex items-center gap-2">
                                {showLabel ? (
                                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                    {label}
                                  </span>
                                ) : null}
                                <span className="text-sm font-bold">₹{p.price.toFixed(0)}</span>
                                <div className="ml-auto">
                                  {!item.is_available ? (
                                    <span className="rounded-lg border-2 border-muted bg-card px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                                      Unavailable
                                    </span>
                                  ) : qty === 0 ? (
                                    <button
                                      onClick={() => add({ menu_item_id: item.id, portion: p.portion, name: showLabel && p.portion !== "full" ? `${item.name} (${label})` : item.name, price: p.price, image_url: item.image_url, veg_type: item.veg_type })}
                                      className="rounded-lg border-2 border-primary bg-card px-4 py-1 text-xs font-bold text-primary shadow-sm">
                                      ADD
                                    </button>
                                  ) : (
                                    <div className="flex items-center rounded-lg border-2 border-primary bg-primary text-primary-foreground shadow-sm">
                                      <button aria-label={`Remove one ${item.name}`} onClick={() => dec(key)} className="px-2 py-1"><Minus className="h-3 w-3" aria-hidden="true" /></button>
                                      <span className="px-1 text-xs font-bold tabular-nums">{qty}</span>
                                      <button aria-label={`Add one ${item.name}`} onClick={() => inc(key)} className="px-2 py-1"><Plus className="h-3 w-3" aria-hidden="true" /></button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div className="w-24 shrink-0">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} loading="lazy"
                            width={96} height={96}
                            className="h-24 w-24 rounded-xl object-cover" />
                        )}
                      </div>
                    </article>

                  ))}
                </div>
              </section>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No dishes match "{q}"</p>
          )}
        </div>
          </>
        )}
      </div>

      {/* Floating category nav */}
      {categories.length > 0 && (
        <>
          {showCatPanel && (
            <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowCatPanel(false)}>
              <div className="absolute bottom-40 right-4 max-h-[60vh] w-56 overflow-auto rounded-2xl bg-card p-2 shadow-2xl"
                onClick={(e) => e.stopPropagation()}>
                {categories.map((c) => (
                  <button key={c.id} onClick={() => scrollToCat(c.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${activeCat === c.id ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-secondary"}`}>
                    <span>{c.name}</span>
                    <span className="text-xs opacity-70">{(grouped.get(c.id) ?? []).length}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setShowCatPanel((s) => !s)}
            aria-label="Browse categories"
            className="fixed right-4 z-[60] flex flex-col items-center gap-0.5 rounded-2xl bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-background shadow-xl"
            style={{ bottom: totalQty > 0 ? 148 : 84 }}>
            <span className="text-xl leading-none">≡</span>
            <span>Menu</span>
          </button>
        </>
      )}

    </div>
  );
}

function VegDot({ type }: { type: "veg" | "nonveg" }) {
  const color = type === "veg" ? "border-success" : "border-destructive";
  const inner = type === "veg" ? "bg-success" : "bg-destructive";
  return (
    <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${inner}`} />
    </span>
  );
}
