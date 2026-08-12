import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocationGate } from "@/hooks/useLocationGate";
import { distanceKm as haversineKm } from "@/lib/geo";
import { BrandHeader } from "@/components/BrandHeader";
import { FreeDeliveryBanner } from "@/components/FreeDeliveryBanner";
import { PageError, PageSpinner } from "@/components/PageState";
import { RatingPrompt } from "@/components/RatingPrompt";
import { withTimeout } from "@/lib/supabase-query";
import { Star, Clock, MapPin, LogOut } from "lucide-react";
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
  rating: number | null; rating_count: number; delivery_time: string; is_open: boolean;
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
    withTimeout(supabase.from("restaurants").select("id, name, tagline, image_url, banner_url, rating, rating_count, delivery_time, is_open, address, opening_time, closing_time, min_order_value, delivery_charges, status, latitude, longitude, created_at").eq("status", "active"))
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
          // Every approved restaurant is shown; nearest ones first.
          .sort((a, b) => (a.distance ?? Number.MAX_SAFE_INTEGER) - (b.distance ?? Number.MAX_SAFE_INTEGER));

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
      <RatingPrompt userId={user.id} />

      <div className="px-4 pt-4">
        <FreeDeliveryBanner />

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
            title="No kitchens yet"
            message="No approved restaurants are live right now. Please check back shortly."

          />
        )}
        {!restaurantLoading && !restaurantError && restaurants.length > 0 && (
          <div className="space-y-5">
            {restaurants.map((restaurant) => (
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
                  <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${restaurant.is_open ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}`}>
                    {restaurant.is_open ? "Open" : "Closed"}
                  </span>
                  <span className="absolute bottom-0 right-0 rounded-tl-2xl bg-card px-3 py-1.5 text-xs font-extrabold tracking-tight">
                    {restaurant.delivery_time ?? "35 MIN"}
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
                </div>
              </Link>
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
