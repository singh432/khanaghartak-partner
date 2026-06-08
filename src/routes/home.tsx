import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocationGate } from "@/hooks/useLocationGate";
import { distanceKm as haversineKm, SERVICE_RADIUS_KM } from "@/lib/geo";
import { BrandHeader } from "@/components/BrandHeader";
import { PageError, PageSpinner } from "@/components/PageState";
import { withTimeout } from "@/lib/supabase-query";
import { Star, Clock, MapPin, LogOut } from "lucide-react";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Home — KhanaGharTak" },
      { name: "description", content: "Browse today's home-style dishes from KhanaGharTak and order with Cash on Delivery." },
      { property: "og:title", content: "Home — KhanaGharTak" },
      { property: "og:description", content: "Browse today's home-style dishes from KhanaGharTak and order with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.lovable.app/home" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.lovable.app/home" }],
  }),
});

type Restaurant = {
  id: string; name: string; tagline: string | null;
  rating: number; delivery_time: string; is_open: boolean;
  banner_url: string | null; image_url: string | null; address: string | null;
  latitude: number | null; longitude: number | null;
};

function HomePage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const { coords } = useLocationGate();
  const [restaurants, setRestaurants] = useState<Array<Restaurant & { distance: number | null }>>([]);
  const [profileAddress, setProfileAddress] = useState<string>("");
  const [restaurantLoading, setRestaurantLoading] = useState(true);
  const [restaurantError, setRestaurantError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    let active = true;
    setRestaurantLoading(true);
    setRestaurantError(null);
    withTimeout(supabase.from("restaurants").select("*").eq("status", "active"))
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        const all = (data ?? []) as Restaurant[];
        const nearby = all
          .map((r) => {
            const distance = coords && r.latitude != null && r.longitude != null
              ? haversineKm(coords, { lat: r.latitude, lng: r.longitude })
              : null;
            return { ...r, distance };
          })
          .filter((r) => r.distance == null ? false : r.distance <= SERVICE_RADIUS_KM)
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
        setRestaurants(nearby);
      })
      .catch((err) => {
        if (active) setRestaurantError(err instanceof Error ? err.message : "Could not load restaurants");
      })
      .finally(() => {
        if (active) setRestaurantLoading(false);
      });
    if (user) {
      withTimeout(supabase.from("profiles").select("address").eq("id", user.id).maybeSingle())
        .then(({ data }) => setProfileAddress(data?.address ?? ""));
    }
    return () => { active = false; };
  }, [user, coords]);

  if (loading) return <PageSpinner label="Checking your session…" />;
  if (!user) return <PageSpinner label="Opening sign in…" />;

  return (
    <div className="pb-10">
      <BrandHeader subtitle={profileAddress ? `Deliver to: ${profileAddress.slice(0, 30)}${profileAddress.length > 30 ? "…" : ""}` : "Set your delivery location"} />

      <div className="px-4 pt-4">
        {!profileAddress && (
          <Link to="/location"
            className="mb-4 flex items-center gap-3 rounded-2xl border bg-accent/50 p-3 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="flex-1">Add your delivery address to get started</span>
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Add</span>
          </Link>
        )}

        {restaurantLoading && <PageSpinner label="Finding nearby kitchens…" />}
        {restaurantError && (
          <PageError message={restaurantError} onRetry={() => window.location.reload()} />
        )}
        {!restaurantLoading && !restaurantError && restaurants.length === 0 && (
          <PageError
            title="No kitchens nearby"
            message={`No restaurants are currently active within ${SERVICE_RADIUS_KM} km of your location.`}
          />
        )}
        {!restaurantLoading && !restaurantError && restaurants.length > 0 && (
          <div className="space-y-4">
            {restaurants.map((restaurant) => (
              <div key={restaurant.id} className="overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] fade-in">
                <div className="relative h-44 w-full overflow-hidden">
                  <img src={restaurant.banner_url ?? hero} alt={restaurant.name}
                    className="h-full w-full object-cover" width={1600} height={900} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <h2 className="text-2xl font-extrabold tracking-tight">{restaurant.name}</h2>
                    <p className="text-xs opacity-90">{restaurant.tagline}</p>
                  </div>
                  <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${restaurant.is_open ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                    {restaurant.is_open ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {Number(restaurant.rating).toFixed(1)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {restaurant.delivery_time}
                  </span>
                  {restaurant.distance != null && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {restaurant.distance.toFixed(1)} km
                    </span>
                  )}
                </div>
                {restaurant.address && (
                  <p className="truncate px-4 pb-2 text-xs text-muted-foreground">{restaurant.address}</p>
                )}
                <div className="px-4 pb-4">
                  <Link to="/menu" className="block w-full rounded-2xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)]">
                    View Menu
                  </Link>
                </div>
              </div>
            ))}
          </div>
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
