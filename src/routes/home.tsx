import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandHeader } from "@/components/BrandHeader";
import { Star, Clock, MapPin, LogOut } from "lucide-react";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/home")({ component: HomePage });

type Restaurant = {
  id: string; name: string; tagline: string | null;
  rating: number; delivery_time: string; is_open: boolean;
  banner_url: string | null; image_url: string | null; address: string | null;
};

function HomePage() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [profileAddress, setProfileAddress] = useState<string>("");

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    supabase.from("restaurant").select("*").limit(1).maybeSingle()
      .then(({ data }) => setRestaurant(data as Restaurant | null));
    if (user) {
      supabase.from("profiles").select("address").eq("id", user.id).maybeSingle()
        .then(({ data }) => setProfileAddress(data?.address ?? ""));
    }
  }, [user]);

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

        {restaurant && (
          <div className="overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)] fade-in">
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
              <span className="truncate text-xs text-muted-foreground">{restaurant.address}</span>
            </div>
            <div className="px-4 pb-4">
              <Link to="/menu" className="block w-full rounded-2xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground shadow-[var(--shadow-soft)]">
                View Menu
              </Link>
            </div>
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
