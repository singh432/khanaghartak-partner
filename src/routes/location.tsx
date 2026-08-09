import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BrandHeader } from "@/components/BrandHeader";
import { MapPin, Navigation, Loader2 } from "lucide-react";

export const Route = createFileRoute("/location")({
  component: LocationPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Delivery Location — KhanaGharTak" },
      { name: "description", content: "Set your delivery address and pin your exact location for faster KhanaGharTak deliveries." },
      { property: "og:title", content: "Delivery Location — KhanaGharTak" },
      { property: "og:description", content: "Set your delivery address and pin your exact location for faster KhanaGharTak deliveries." },
      { property: "og:url", content: "https://khanaghartak.in/location" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/location" }],
  }),
});

const schema = z.object({
  address: z.string().trim().min(8, "Enter a complete address").max(300),
  landmark: z.string().trim().max(120).optional(),
});

function LocationPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const draftKey = user ? `kgt-draft-location-${user.id}` : null;
  const clearDraft = useFormDraft(
    draftKey,
    { address, landmark, coords },
    (d) => {
      if (d.address) setAddress(d.address);
      if (d.landmark) setLandmark(d.landmark);
      if (d.coords) setCoords(d.coords);
    },
  );

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("address, landmark, latitude, longitude")
      .eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          // never overwrite what the user has already typed (draft/live input)
          setAddress((cur) => cur || data.address || "");
          setLandmark((cur) => cur || data.landmark || "");
          if (data.latitude && data.longitude) {
            setCoords((cur) => cur ?? { lat: data.latitude!, lng: data.longitude! });
          }
        }
      });
  }, [user]);

  const detect = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast.success("Location pinned");
        setLocating(false);
      },
      (err) => { toast.error(err.message || "Could not get location"); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const save = async () => {
    const parsed = schema.safeParse({ address, landmark });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id, address, landmark,
      latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
    }, { onConflict: "id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    clearDraft();
    toast.success("Address saved");
    navigate({ to: "/home" });
  };


  return (
    <div className="pb-24">
      <BrandHeader subtitle="Delivery location" />
      <div className="px-4 pt-4">
        <h1 className="text-lg font-bold">Where should we deliver?</h1>
        <p className="text-sm text-muted-foreground">Pin your exact location for accurate delivery.</p>

        <button onClick={detect} disabled={locating}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-accent/40 py-4 text-sm font-semibold text-primary">
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          Use my current location
        </button>

        {coords && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs text-success">
            <MapPin className="h-4 w-4" /> Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}

        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Full address</span>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
              maxLength={300}
              placeholder="House no., street, area, city, pincode"
              className="w-full rounded-xl border bg-input p-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Landmark (optional)</span>
            <input value={landmark} onChange={(e) => setLandmark(e.target.value)} maxLength={120}
              placeholder="Near temple, opposite school..."
              className="h-12 w-full rounded-xl border bg-input px-3 text-sm outline-none focus:border-primary" />
          </label>
        </div>
      </div>

      <div className="sticky bottom-0 mt-8 border-t bg-background p-4">
        <button onClick={save} disabled={saving}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary font-bold text-primary-foreground shadow-[var(--shadow-soft)]">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm Location
        </button>
      </div>
    </div>
  );
}
