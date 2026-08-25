import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/supabase-query";
import { SitePage } from "@/components/SitePage";
import { Clock, MapPin, Star } from "lucide-react";

const URL = "https://khanaghartak.in/restaurants";
const TITLE = "Restaurants & Home Kitchens — KhanaGharTak";
const DESC =
  "Browse verified restaurants and home kitchens delivering hot, home-style food near you with KhanaGharTak. Fast delivery and Cash on Delivery.";

export const Route = createFileRoute("/restaurants")({
  component: RestaurantsPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
});

type PublicRestaurant = {
  id: string;
  name: string;
  tagline: string | null;
  rating: number | null;
  delivery_time: string | null;
  address: string | null;
  is_open: boolean | null;
};

function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<PublicRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    withTimeout(
      supabase
        .from("restaurants")
        .select("id,name,tagline,rating,delivery_time,address,is_open")
        .eq("status", "active")
        .order("rating", { ascending: false }),
    )
      .then(({ data }) => {
        if (active) setRestaurants((data ?? []) as PublicRestaurant[]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SitePage
      eyebrow="Partner kitchens"
      title="Restaurants delivering near you."
      intro="Every kitchen on KhanaGharTak is manually verified before it goes live. Sign in to see live menus and order."
    >
      {loading ? (
        <p>Loading kitchens…</p>
      ) : restaurants.length === 0 ? (
        <p>
          We're onboarding kitchens in your area right now. Run a kitchen?{" "}
          <Link to="/contact" className="font-semibold text-primary">Get in touch</Link> to join KhanaGharTak.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {restaurants.map((r) => (
            <li key={r.id} className="rounded-2xl border bg-card p-5">
              <h2 className="font-display text-xl leading-tight text-foreground">{r.name}</h2>
              {r.tagline && <p className="mt-1 text-sm">{r.tagline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                {r.rating != null && (
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" /> {r.rating}</span>
                )}
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {r.delivery_time ?? "35 min"}</span>
                {r.address && (
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {r.address}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link
          to="/login" search={{ as: "customer" as const }}
          className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          Sign in to order
        </Link>
      </p>
    </SitePage>
  );
}
