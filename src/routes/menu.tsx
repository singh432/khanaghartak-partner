import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandHeader } from "@/components/BrandHeader";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Minus, Search, Star, Clock } from "lucide-react";

export const Route = createFileRoute("/menu")({ component: MenuPage });

type Category = { id: string; name: string; priority: number };
type MenuItem = {
  id: string; category_id: string; name: string; description: string | null;
  price: number; image_url: string | null; veg_type: "veg" | "nonveg"; is_available: boolean;
};
type Restaurant = { name: string; rating: number; delivery_time: string };

function MenuPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { items: cart, add, inc, dec, totalQty, subtotal } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [showCatPanel, setShowCatPanel] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: c }, { data: m }] = await Promise.all([
        supabase.from("restaurant").select("name, rating, delivery_time").limit(1).maybeSingle(),
        supabase.from("categories").select("*").order("priority"),
        supabase.from("menu_items").select("*").eq("is_available", true).order("name"),
      ]);
      setRestaurant(r as Restaurant | null);
      setCategories((c ?? []) as Category[]);
      setMenu((m ?? []) as MenuItem[]);
      if (c && c.length) setActiveCat(c[0].id);
    })();
  }, []);

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

  const qtyInCart = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;

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
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={60}
            placeholder="Search dishes..." className="h-11 flex-1 bg-transparent text-sm outline-none" />
        </div>

        <div className="mt-6 space-y-8">
          {categories.map((cat) => {
            const list = grouped.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={cat.id} data-cat={cat.id}
                ref={(el) => { sectionRefs.current[cat.id] = el; }}>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  {cat.name} <span className="text-foreground/60">· {list.length}</span>
                </h3>
                <div className="space-y-3">
                  {list.map((item) => (
                    <article key={item.id} className="flex gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-card)]">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                          <VegDot type={item.veg_type} />
                          <h4 className="font-semibold leading-tight">{item.name}</h4>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground line-clamp-2">{item.description}</p>
                        <p className="mt-2 text-sm font-bold">₹{Number(item.price).toFixed(0)}</p>
                      </div>
                      <div className="relative w-24 shrink-0">
                        {item.image_url && (
                          <img src={item.image_url} alt={item.name} loading="lazy"
                            width={96} height={96}
                            className="h-24 w-24 rounded-xl object-cover" />
                        )}
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                          {qtyInCart(item.id) === 0 ? (
                            <button onClick={() => add({ id: item.id, name: item.name, price: Number(item.price), image_url: item.image_url, veg_type: item.veg_type })}
                              className="rounded-lg border-2 border-primary bg-card px-4 py-1 text-xs font-bold text-primary shadow-sm">
                              ADD
                            </button>
                          ) : (
                            <div className="flex items-center rounded-lg border-2 border-primary bg-primary text-primary-foreground shadow-sm">
                              <button onClick={() => dec(item.id)} className="px-2 py-1"><Minus className="h-3 w-3" /></button>
                              <span className="px-1 text-xs font-bold tabular-nums">{qtyInCart(item.id)}</span>
                              <button onClick={() => inc(item.id)} className="px-2 py-1"><Plus className="h-3 w-3" /></button>
                            </div>
                          )}
                        </div>
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
      </div>

      {/* Floating category nav */}
      {categories.length > 0 && (
        <>
          {showCatPanel && (
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowCatPanel(false)}>
              <div className="absolute bottom-28 right-4 max-h-[60vh] w-56 overflow-auto rounded-2xl bg-card p-2 shadow-2xl"
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
            className="fixed right-4 z-40 flex flex-col items-center gap-1 rounded-2xl bg-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-background shadow-xl"
            style={{ bottom: totalQty > 0 ? 96 : 24 }}>
            <span className="text-xl leading-none">≡</span>
            <span>Menu</span>
          </button>
        </>
      )}

      {/* Sticky cart bar */}
      {totalQty > 0 && (
        <Link to="/cart"
          className="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-[448px] -translate-x-1/2 items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-2xl">
          <div className="text-sm">
            <div className="font-bold leading-tight">{totalQty} item{totalQty > 1 ? "s" : ""} · ₹{subtotal.toFixed(0)}</div>
            <div className="text-[11px] opacity-90">Extra charges may apply</div>
          </div>
          <span className="text-sm font-bold">View Cart →</span>
        </Link>
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
