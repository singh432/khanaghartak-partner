import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { isRestaurantOpen } from "@/lib/hours";
import { useMinuteTick } from "@/hooks/useMinuteTick";
import { browseEta } from "@/lib/eta";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocationGate } from "@/hooks/useLocationGate";
import { distanceKm as haversineKm, isWithinServiceArea, type LatLng } from "@/lib/geo";
import { fetchActiveZones, zoneForPoint, isLocationInServiceZone, type DeliveryZone } from "@/lib/zones";
import { BrandHeader } from "@/components/BrandHeader";
import { PageError, PageSpinner } from "@/components/PageState";
import { RatingPrompt } from "@/components/RatingPrompt";
import { withTimeout } from "@/lib/supabase-query";
import { isCustomerApp } from "@/lib/capacitor";
import { getCategoryImage } from "@/lib/categoryImages";
import { Star, Clock, MapPin, LogOut, Search, X, UtensilsCrossed, Sparkles } from "lucide-react";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Home — KhanaGharTak" },
      { name: "description", content: "Browse today's home-style dishes from KhanaGharTak and order with Cash on Delivery." },
      { property: "og:title", content: "Home — KhanaGharTak" },
      { property: "og:description", content: "Browse today's home-style dishes from KhanaGharTak and order with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/home" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/home" }],
  }),
});

type Restaurant = {
  id: string; name: string; tagline: string | null;
  rating: number | null; rating_count: number; is_open: boolean;
  opening_time: string | null; closing_time: string | null;
  banner_url: string | null; image_url: string | null; address: string | null;
  latitude: number | null; longitude: number | null;
  zone_id?: string | null;
};

type Dish = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  offer_price: number | null;
  image_url: string | null;
  veg_type: string;
};

function HomePage() {
  const navigate = useNavigate();
  const customerApp = isCustomerApp();
  const { user, loading, signOut } = useAuth();
  const { coords, status: locationStatus, request: requestLocation } = useLocationGate();
  const now = useMinuteTick();
  const [restaurants, setRestaurants] = useState<Array<Restaurant & { distance: number | null }>>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string[]>>({});
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [profileAddress, setProfileAddress] = useState<string>("");
  const [deliveryCoords, setDeliveryCoords] = useState<LatLng | null>(null);
  const [activeZones, setActiveZones] = useState<DeliveryZone[]>([]);
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [dishesLoaded, setDishesLoaded] = useState(false);

  // Initialize selected delivery address and coords from localStorage
  const [selectedAddress, setSelectedAddress] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kgt:delivery-address") || "";
    }
    return "";
  });
  const [selectedCoords, setSelectedCoords] = useState<LatLng | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("kgt:user-coords");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            return { lat: parsed.lat, lng: parsed.lng };
          }
        }
      } catch {}
    }
    return null;
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { as: "customer" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    fetchActiveZones().then(setActiveZones).catch(() => {});
  }, []);

  // Sync profile delivery address and coordinates from Supabase
  useEffect(() => {
    if (user) {
      withTimeout(supabase.from("profiles").select("address, latitude, longitude").eq("id", user.id).maybeSingle())
        .then(({ data }) => {
          if (data?.address) {
            setProfileAddress(data.address);
            if (!selectedAddress) setSelectedAddress(data.address);
          }
          if (data?.latitude && data?.longitude) {
            const p = { lat: data.latitude, lng: data.longitude };
            setDeliveryCoords(p);
            if (!selectedCoords) setSelectedCoords(p);
          } else if (coords && !selectedCoords) {
            setDeliveryCoords(coords);
          }
        })
        .catch(() => {});
    } else if (coords && !selectedCoords) {
      setDeliveryCoords(coords);
    }
  }, [user, coords, selectedAddress, selectedCoords]);

  // Keep delivery address and coords synchronized with storage changes
  useEffect(() => {
    const handleStorage = () => {
      const addr = localStorage.getItem("kgt:delivery-address") || "";
      setSelectedAddress(addr);
      try {
        const raw = localStorage.getItem("kgt:user-coords");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
            setSelectedCoords({ lat: parsed.lat, lng: parsed.lng });
          }
        }
      } catch {}
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("kgt:address-changed", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("kgt:address-changed", handleStorage);
    };
  }, []);

  const effectiveAddress = selectedAddress || profileAddress;
  const effectiveCoords = selectedCoords || deliveryCoords || coords;

  // Accurately check whether the delivery location / address is outside supported service zones
  const isOutsideZone = useMemo(() => {
    if (locationStatus === "outside_zone") return true;
    const isServiceable = isLocationInServiceZone(effectiveCoords, effectiveAddress, activeZones);
    return !isServiceable;
  }, [effectiveAddress, effectiveCoords, activeZones, locationStatus]);

  const quickSwitchToShankargarh = async () => {
    const shankargarhAddr = "Main Bazaar, Shankargarh, Prayagraj - 212108";
    const shankargarhCoords = { lat: 25.1842, lng: 81.6212 };
    setSelectedAddress(shankargarhAddr);
    setSelectedCoords(shankargarhCoords);
    setProfileAddress(shankargarhAddr);
    setDeliveryCoords(shankargarhCoords);
    try {
      localStorage.setItem("kgt:delivery-address", shankargarhAddr);
      localStorage.setItem("kgt:user-coords", JSON.stringify({ ...shankargarhCoords, ts: Date.now() }));
      window.dispatchEvent(new Event("kgt:address-changed"));
    } catch {}
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        address: shankargarhAddr,
        latitude: shankargarhCoords.lat,
        longitude: shankargarhCoords.lng,
      }, { onConflict: "id" });
    }
  };

  useEffect(() => {
    let active = true;

    // If outside service zone, do not fetch restaurants or categories
    if (isOutsideZone) {
      setRestaurants([]);
      setDishes([]);
      setRestaurantLoading(false);
      return;
    }

    setRestaurantLoading(true);
    setRestaurantError(null);
    withTimeout(supabase.from("restaurants").select("id, name, tagline, image_url, banner_url, rating, rating_count, is_open, address, opening_time, closing_time, min_order_value, delivery_charges, status, latitude, longitude, created_at, zone_id").eq("status", "active"))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const all = (data ?? []) as Restaurant[];
        const targetZone = effectiveCoords ? zoneForPoint(effectiveCoords, activeZones) : null;

        // Show only restaurants available for the detected delivery zone
        const zoneRestaurants = all.filter((r) => {
          // If restaurant has zone_id and targetZone is resolved, must match
          if (r.zone_id && targetZone?.id) {
            return r.zone_id === targetZone.id;
          }
          // If restaurant has zone_id for a different zone, exclude it
          if (r.zone_id && activeZones.length > 0 && targetZone && r.zone_id !== targetZone.id) {
            return false;
          }
          // If distance is known, ensure restaurant is within reachable delivery radius (15km)
          if (effectiveCoords && r.latitude != null && r.longitude != null) {
            const d = haversineKm(effectiveCoords, { lat: r.latitude, lng: r.longitude });
            return d <= 15;
          }
          return true;
        });

        const nearby = zoneRestaurants
          .map((r) => {
            const distance = effectiveCoords && r.latitude != null && r.longitude != null
              ? haversineKm(effectiveCoords, { lat: r.latitude, lng: r.longitude })
              : null;
            return { ...r, distance };
          })
          .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));

        setRestaurants(nearby);
      })
      .catch((err) => {
        if (active) setRestaurantError(err instanceof Error ? err.message : "Could not load restaurants");
      })
      .finally(() => {
        if (active) setRestaurantLoading(false);
      });

    withTimeout(supabase.from("categories").select("name, restaurant_id"))
      .then(({ data }) => {
        if (!active) return;
        const map: Record<string, string[]> = {};
        for (const row of (data ?? []) as Array<{ name: string; restaurant_id: string }>) {
          const key = row.name.trim();
          if (!key) continue;
          (map[key] ||= []).push(row.restaurant_id);
        }
        setCategoryMap(map);
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [user, effectiveCoords, activeZones, isOutsideZone]);

  // Zomato-style popular food categories
  const POPULAR_CATEGORIES = [
    "Biryani",
    "Thali",
    "Pizza",
    "Burger",
    "Chinese",
    "Snacks",
    "Sweets",
    "Cake",
    "Rolls",
    "Fast Food",
  ];

  // Merge POPULAR_CATEGORIES with dynamic database categories
  const categoryNames = useMemo(() => {
    const dbCats = Object.keys(categoryMap)
      .filter((name) => categoryMap[name].some((id) => restaurants.some((r) => r.id === id)))
      .sort((a, b) => a.localeCompare(b));

    const combined = [...POPULAR_CATEGORIES];
    for (const c of dbCats) {
      if (!combined.some((p) => p.toLowerCase() === c.toLowerCase())) {
        combined.push(c);
      }
    }
    return combined;
  }, [categoryMap, restaurants]);

  useEffect(() => {
    if (!isOutsideZone && restaurants.length > 0 && !dishesLoaded) {
      const ids = restaurants.map((r) => r.id);
      withTimeout(
        supabase
          .from("menu_items")
          .select("id, restaurant_id, name, price, offer_price, image_url, veg_type")
          .eq("is_available", true)
          .in("restaurant_id", ids)
          .limit(300)
      )
        .then(({ data }) => {
          if (data) {
            setDishes(data as Dish[]);
            setDishesLoaded(true);
          }
        })
        .catch(() => {});
    }
  }, [isOutsideZone, restaurants, dishesLoaded]);

  const visibleRestaurants = useMemo(() => {
    let list = restaurants;
    if (activeCategory) {
      const catLower = activeCategory.toLowerCase();
      // Match restaurants by categoryMap, dishes served, or restaurant name/tagline
      const matchingIds = new Set<string>(categoryMap[activeCategory] ?? []);
      for (const d of dishes) {
        if (d.name.toLowerCase().includes(catLower)) {
          matchingIds.add(d.restaurant_id);
        }
      }
      for (const r of restaurants) {
        if (
          r.name.toLowerCase().includes(catLower) ||
          (r.tagline && r.tagline.toLowerCase().includes(catLower))
        ) {
          matchingIds.add(r.id);
        }
      }
      list = restaurants.filter((r) => matchingIds.has(r.id));
    }
    return list.slice().sort((a, b) => {
      const openA = isRestaurantOpen(a, now);
      const openB = isRestaurantOpen(b, now);
      if (openA !== openB) return openA ? -1 : 1;
      return (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER);
    });
  }, [restaurants, activeCategory, categoryMap, dishes, now]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearchActive = !isOutsideZone && trimmedQuery.length > 0;

  const matchingRestaurants = useMemo(() => {
    if (!isSearchActive) return [];
    // Also include restaurants that have dishes matching the search query
    const rIdsFromDishes = new Set<string>(
      dishes.filter((d) => d.name.toLowerCase().includes(trimmedQuery)).map((d) => d.restaurant_id)
    );
    // Also include restaurants with categories matching search query
    const rIdsFromCategories = new Set<string>(
      Object.entries(categoryMap)
        .filter(([cat]) => cat.toLowerCase().includes(trimmedQuery))
        .flatMap(([_, ids]) => ids)
    );

    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(trimmedQuery) ||
        (r.tagline && r.tagline.toLowerCase().includes(trimmedQuery)) ||
        (r.address && r.address.toLowerCase().includes(trimmedQuery)) ||
        rIdsFromDishes.has(r.id) ||
        rIdsFromCategories.has(r.id)
    );
  }, [restaurants, trimmedQuery, isSearchActive, dishes, categoryMap]);

  const matchingDishes = useMemo(() => {
    if (!isSearchActive) return [];
    return dishes.filter((d) => d.name.toLowerCase().includes(trimmedQuery));
  }, [dishes, trimmedQuery, isSearchActive]);

  if (loading) return <PageSpinner label="Checking your session…" />;
  if (!user) return <PageSpinner label="Opening sign in…" />;

  // OUTSIDE SERVICE ZONE: Do NOT show any restaurants, categories, dishes or restaurant cards.
  if (isOutsideZone) {
    const chipAddr = effectiveAddress
      ? (effectiveAddress.length > 25 ? effectiveAddress.slice(0, 25) + "…" : effectiveAddress)
      : "Select location";
    return (
      <div className="pb-10">
        <BrandHeader subtitle={`Deliver to: ${chipAddr}`} />
        <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 py-10 text-center">
          {/* Animated Location Radar / Map Pin */}
          <div className="relative mb-6 flex items-center justify-center">
            {/* Pulsing radar ripples */}
            <div className="absolute h-28 w-28 animate-ping rounded-full bg-primary/15 opacity-75 duration-1000" />
            <div className="absolute h-20 w-20 animate-pulse rounded-full bg-primary/20" />
            <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-tr from-primary to-amber-500 shadow-[0_8px_24px_-6px_rgba(244,93,44,0.45)] text-white">
              <MapPin className="h-8 w-8 text-white drop-shadow" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 mb-3 border border-amber-500/20">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Outside Delivery Zone
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            We are not serving in this area yet.
          </h1>

          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed max-w-xs">
            {effectiveAddress ? (
              <>
                Delivery is currently unavailable at <strong className="text-foreground font-semibold">"{effectiveAddress.length > 35 ? effectiveAddress.slice(0, 35) + "…" : effectiveAddress}"</strong>.
              </>
            ) : (
              "KhanaGharTak is currently delivering only in our active service zone (Shankargarh & nearby areas)."
            )}
            {" "}Change your delivery address to order to another location!
          </p>

          <div className="mt-7 flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => navigate({ to: "/location" })}
              className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-95"
            >
              Change delivery address
            </button>

            <button
              onClick={quickSwitchToShankargarh}
              className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-primary/30 bg-primary/5 text-xs font-bold text-primary transition hover:bg-primary/10 active:scale-95"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Switch to Shankargarh Zone
            </button>

            <button
              onClick={() => requestLocation()}
              className="inline-flex h-10 w-full items-center justify-center rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition"
            >
              Check GPS location again
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="pb-10">
      <BrandHeader subtitle={effectiveAddress ? `Deliver to: ${effectiveAddress.slice(0, 30)}${effectiveAddress.length > 30 ? "…" : ""}` : "Set your delivery location"} />
      <RatingPrompt userId={user.id} />

      <div className="px-4 pt-4">

        <div id="khana-customer-search-bar" className="mb-4">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search restaurants, dishes, biryani, pizza…"
              className="h-11 w-full rounded-2xl border border-border/80 bg-card pl-10 pr-10 text-sm font-medium text-foreground placeholder:text-muted-foreground/70 shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 grid h-6 w-6 place-items-center rounded-full bg-muted/80 text-muted-foreground hover:text-foreground active:scale-90"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {!profileAddress && (
          <Link to="/location"
            className="mb-4 flex items-center gap-3 rounded-2xl border bg-accent/50 p-3 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="flex-1">Add your delivery address to get started</span>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Add</span>
          </Link>
        )}

        {!isSearchActive && categoryNames.length > 0 && (
          <div className="-mx-4 mb-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-3 py-1">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className="flex flex-col items-center gap-1.5 transition-transform active:scale-95 group focus:outline-none"
              >
                <div className={`relative h-16 w-16 overflow-hidden rounded-full border-2 p-0.5 transition-all shadow-sm ${
                  activeCategory === null
                    ? "border-primary ring-2 ring-primary/30 shadow-primary/20 scale-105"
                    : "border-border/70 hover:border-primary/50 bg-card"
                }`}>
                  <img
                    src={getCategoryImage("all")}
                    alt="All"
                    className="h-full w-full rounded-full object-cover"
                    loading="eager"
                  />
                </div>
                <span className={`text-[11px] font-bold tracking-tight max-w-[68px] text-center truncate ${
                  activeCategory === null ? "text-primary font-extrabold" : "text-foreground"
                }`}>
                  All
                </span>
              </button>

              {categoryNames.map((name) => {
                const isActive = activeCategory === name;
                const imgUrl = getCategoryImage(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setActiveCategory(isActive ? null : name)}
                    className="flex flex-col items-center gap-1.5 transition-transform active:scale-95 group focus:outline-none"
                  >
                    <div className={`relative h-16 w-16 overflow-hidden rounded-full border-2 p-0.5 transition-all shadow-sm ${
                      isActive
                        ? "border-primary ring-2 ring-primary/30 shadow-primary/20 scale-105"
                        : "border-border/70 hover:border-primary/50 bg-card"
                    }`}>
                      <img
                        src={imgUrl}
                        alt={name}
                        className="h-full w-full rounded-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <span className={`text-[11px] font-bold tracking-tight max-w-[68px] text-center truncate ${
                      isActive ? "text-primary font-extrabold" : "text-foreground"
                    }`}>
                      {name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeCategory && !isSearchActive && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs">
            <span className="font-bold text-primary">
              Showing kitchens serving <span className="underline">{activeCategory}</span> ({visibleRestaurants.length})
            </span>
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className="font-extrabold text-primary hover:underline"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {isSearchActive ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
              <span>Results for "{searchQuery}"</span>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-primary font-bold hover:underline"
              >
                Clear
              </button>
            </div>

            {matchingRestaurants.length === 0 && matchingDishes.length === 0 && (
              <div className="my-6 rounded-3xl border border-dashed border-border/80 bg-card p-6 text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">No matches found</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  We couldn't find any restaurants or dishes matching "{searchQuery}".
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground/80">
                  Try searching for Biryani, Pizza, Burger, Paneer, or Cake.
                </p>
              </div>
            )}

            {matchingRestaurants.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground px-1">
                  Restaurants ({matchingRestaurants.length})
                </h3>
                <div className="space-y-3">
                  {matchingRestaurants.map((restaurant) => (
                    <Link
                      key={restaurant.id}
                      to="/menu"
                      search={{ r: restaurant.id }}
                      className="flex items-center gap-3.5 rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition active:scale-[0.99]"
                    >
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl">
                        <img
                          src={restaurant.banner_url ?? restaurant.image_url ?? hero}
                          alt={restaurant.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="truncate text-sm font-extrabold text-foreground">{restaurant.name}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isRestaurantOpen(restaurant) ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                          }`}>
                            {isRestaurantOpen(restaurant) ? "Open" : "Closed"}
                          </span>
                        </div>
                        {restaurant.tagline && (
                          <p className="truncate text-xs text-muted-foreground mt-0.5">{restaurant.tagline}</p>
                        )}
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          {restaurant.rating != null && restaurant.rating_count > 0 && (
                            <span className="inline-flex items-center gap-0.5 font-bold text-success">
                              <Star className="h-3 w-3 fill-current" />
                              {Number(restaurant.rating).toFixed(1)}
                            </span>
                          )}
                          {restaurant.distance != null && (
                            <span>• {restaurant.distance.toFixed(1)} km</span>
                          )}
                          <span>• {browseEta(restaurant.distance).label}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {matchingDishes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground px-1">
                  Dishes & Food Items ({matchingDishes.length})
                </h3>
                <div className="space-y-2.5">
                  {matchingDishes.map((dish) => {
                    const r = restaurants.find((res) => res.id === dish.restaurant_id);
                    const price = dish.offer_price ?? dish.price;
                    const hasDiscount = dish.offer_price != null && dish.offer_price < dish.price;
                    return (
                      <Link
                        key={dish.id}
                        to="/menu"
                        search={{ r: dish.restaurant_id }}
                        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm transition active:scale-[0.99]"
                      >
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-muted/30">
                          <img
                            src={dish.image_url ?? getCategoryImage(dish.name)}
                            alt={dish.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-block h-2 w-2 rounded-full ${
                              dish.veg_type === "nonveg" ? "bg-red-500" : "bg-emerald-600"
                            }`} />
                            <h4 className="truncate text-sm font-bold text-foreground">{dish.name}</h4>
                          </div>
                          {r && (
                            <p className="truncate text-xs text-muted-foreground mt-0.5">
                              at <span className="font-semibold text-foreground/80">{r.name}</span>
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs font-extrabold text-foreground">₹{price}</span>
                            {hasDiscount && (
                              <span className="text-[11px] text-muted-foreground line-through">₹{dish.price}</span>
                            )}
                          </div>
                        </div>
                        <span className="flex-shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          View
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {restaurantLoading && <PageSpinner label="Finding nearby kitchens…" />}
            {restaurantError && (
              <PageError message={restaurantError} onRetry={() => window.location.reload()} />
            )}
            {!restaurantLoading && !restaurantError && restaurants.length === 0 && (
              <PageError
                title="No kitchens yet"
                message="No approved restaurants are live right now. Please check back shortly."
              />
            )}
            {!restaurantLoading && !restaurantError && restaurants.length > 0 && visibleRestaurants.length === 0 && (
              <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
                No kitchens serving {activeCategory} right now.
              </p>
            )}
            {!restaurantLoading && !restaurantError && visibleRestaurants.length > 0 && (
              <div className="space-y-5">
                {visibleRestaurants.map((restaurant) => (
                  <Link
                    key={restaurant.id}
                    to="/menu"
                    search={{ r: restaurant.id }}
                    aria-label={`View menu of ${restaurant.name}`}
                    className="block overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] fade-in"
                  >
                    <div className="relative h-48 w-full overflow-hidden">
                      <img src={restaurant.banner_url ?? restaurant.image_url ?? hero} alt={restaurant.name}
                        className="h-full w-full object-cover" width={1600} height={900} loading="lazy" />
                      <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${isRestaurantOpen(restaurant) ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                        {isRestaurantOpen(restaurant) ? "Open" : "Closed"}
                      </span>
                      <span className="absolute bottom-0 right-0 rounded-tl-2xl bg-card px-3 py-1.5 text-xs font-extrabold tracking-tight">
                        {browseEta(restaurant.distance).label}
                      </span>
                    </div>

                    <div className="px-4 pb-4 pt-3">
                      <h2 className="text-lg font-extrabold leading-tight tracking-tight">{restaurant.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                        {restaurant.rating_count > 0 && restaurant.rating != null && (
                          <span className="inline-flex items-center gap-1 font-semibold text-success">
                            <Star className="h-3.5 w-3.5 fill-current" />
                            {Number(restaurant.rating).toFixed(1)}
                            <span className="font-normal text-muted-foreground">({restaurant.rating_count})</span>
                          </span>
                        )}
                        {restaurant.rating_count > 0 && restaurant.address && <span aria-hidden>•</span>}
                        {restaurant.address && <span className="truncate">{restaurant.address}</span>}
                        {restaurant.distance != null && (
                          <>
                            <span aria-hidden>•</span>
                            <span>{restaurant.distance.toFixed(1)} km</span>
                          </>
                        )}
                      </div>
                      {restaurant.tagline && (
                        <p className="mt-1 truncate text-sm text-muted-foreground">{restaurant.tagline}</p>
                      )}
                      {restaurant.rating_count === 0 && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> Newly added kitchen
                        </p>
                      )}

                      {/* 2-3 Dish preview items under each restaurant card */}
                      {(() => {
                        const restaurantDishes = dishes.filter((d) => d.restaurant_id === restaurant.id).slice(0, 3);
                        if (restaurantDishes.length === 0) return null;
                        return (
                          <div className="mt-3 border-t border-border/40 pt-2.5">
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              {restaurantDishes.map((dish) => (
                                <div
                                  key={dish.id}
                                  className="flex flex-shrink-0 items-center gap-2 rounded-xl bg-muted/40 p-1.5 pr-2.5 border border-border/40 text-xs"
                                >
                                  <img
                                    src={dish.image_url || getCategoryImage(dish.name)}
                                    alt={dish.name}
                                    className="h-9 w-9 rounded-lg object-cover"
                                    loading="lazy"
                                  />
                                  <div className="min-w-0 max-w-[110px]">
                                    <p className="truncate font-semibold text-foreground text-[11px]">{dish.name}</p>
                                    <p className="text-[10px] font-bold text-primary">₹{dish.offer_price ?? dish.price}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}


        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link to="/orders" className="rounded-2xl border bg-card p-4 text-sm font-semibold">
            My Orders
          </Link>
          <Link to="/location" className="rounded-2xl border bg-card p-4 text-sm font-semibold">
            Delivery Address
          </Link>
        </div>

        <button onClick={signOut} className="mx-auto mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </div>
  );
}
