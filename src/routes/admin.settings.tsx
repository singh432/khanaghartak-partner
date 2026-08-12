import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFormDraft } from "@/hooks/useFormDraft";

import { khanaGharTakLogoUrl } from "@/assets/brand";
import { Loader2, Navigation } from "lucide-react";
import { getCurrentLocation } from "@/lib/geolocate";

export const Route = createFileRoute("/admin/settings")({ component: AdminSettings });

type Restaurant = {
  id: string; name: string; tagline: string | null; address: string | null;
  phone: string | null; phone_alt: string | null; delivery_time: string | null; is_open: boolean | null;
  opening_time: string | null; closing_time: string | null;
  min_order_value: number; delivery_charges: number;
  image_url: string | null;
  latitude: number | null; longitude: number | null;
};

function AdminSettings() {
  const { user } = useAuth();
  const [r, setR] = useState<Restaurant | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const draftKey = r ? `kgt-draft-settings-${r.id}` : null;
  const clearDraft = useFormDraft(draftKey, r, (d) => {
    if (d) setR((cur) => (cur ? { ...cur, ...d } : cur));
  });

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingRestaurant(true);
    (async () => {
      const { data } = await supabase.from("restaurants").select("id, name, tagline, address, delivery_time, is_open, opening_time, closing_time, min_order_value, delivery_charges, image_url, latitude, longitude").eq("owner_id", user.id).limit(1).maybeSingle();
      let phone: string | null = null;
      let phone_alt: string | null = null;
      if (data?.id) {
        const { data: ph } = await supabase.rpc("get_restaurant_contacts" as any, { _restaurant_id: data.id });
        const row = Array.isArray(ph) ? (ph[0] as any) : (ph as any);
        phone = row?.phone ?? null;
        phone_alt = row?.phone_alt ?? null;
      }
      if (active) {
        setR(data ? ({ ...data, phone, phone_alt } as Restaurant) : null);
        setLoadingRestaurant(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const save = async () => {
    if (!r) return;
    setSaving(true);
    const { error } = await supabase.from("restaurants").update({
      name: r.name, tagline: r.tagline, address: r.address, phone: r.phone, phone_alt: r.phone_alt,
      opening_time: r.opening_time, closing_time: r.closing_time,
      min_order_value: r.min_order_value, delivery_charges: r.delivery_charges,
      delivery_time: r.delivery_time, is_open: r.is_open,
      latitude: r.latitude, longitude: r.longitude,
    }).eq("id", r.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { clearDraft(); toast.success("Saved"); }
  };


  const uploadImage = async (file: File, kind: "logo" | "banner") => {
    if (!r) return;
    const path = `${r.id}/${kind}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("menu-images").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
    const patch = kind === "logo" ? { image_url: data.publicUrl } : { banner_url: data.publicUrl };
    const { error: e2 } = await supabase.from("restaurants").update(patch).eq("id", r.id);
    if (e2) return toast.error(e2.message);
    setR({ ...r, ...patch });
    toast.success(kind === "logo" ? "Logo updated" : "Cover photo updated");
  };

  if (loadingRestaurant) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!r) {
    return (
      <div className="p-6 text-center">
        <img src={khanaGharTakLogoUrl} alt="KhanaGharTak" width={72} height={72} className="mx-auto h-18 w-18 rounded-2xl object-contain" />
        <h1 className="mt-4 text-lg font-bold">No restaurant added</h1>
        <p className="mt-2 text-sm text-muted-foreground">Go back to Admin Dashboard and add your restaurant first.</p>
        <a href="/admin" className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Add restaurant</a>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Restaurant Settings</h1>
        <p className="text-sm text-muted-foreground">Profile, hours, pricing</p>
      </header>

      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="space-y-3">
          <div className="relative h-40 w-full overflow-hidden rounded-2xl border bg-secondary">
            {r.banner_url ? <img src={r.banner_url} alt="Restaurant cover" className="h-full w-full object-cover" /> : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">No cover photo yet</div>
            )}
            <label className="absolute bottom-3 right-3 cursor-pointer rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground shadow">
              {r.banner_url ? "Change cover photo" : "Upload cover photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">This photo is shown to customers on the home page. Use a wide food/shop photo (1600×900).</p>
          <div className="flex items-center gap-4">
            {r.image_url ? <img src={r.image_url} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="h-16 w-16 rounded-xl bg-secondary" />}
            <label className="cursor-pointer rounded-xl bg-secondary px-3 py-2 text-sm font-semibold">
              Upload Logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "logo")} />
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Restaurant Name"><input className="ai" value={r.name} maxLength={80} onChange={(e) => setR({ ...r, name: e.target.value })} /></Field>
          <Field label="Tagline"><input className="ai" value={r.tagline ?? ""} maxLength={120} onChange={(e) => setR({ ...r, tagline: e.target.value })} /></Field>
          <Field label="Primary Phone"><input className="ai" inputMode="tel" maxLength={15} value={r.phone ?? ""} onChange={(e) => setR({ ...r, phone: e.target.value })} /></Field>
          <Field label="Alternate Phone (optional)"><input className="ai" inputMode="tel" maxLength={15} value={r.phone_alt ?? ""} onChange={(e) => setR({ ...r, phone_alt: e.target.value })} /></Field>
          <Field label="Delivery Time"><input className="ai" value={r.delivery_time ?? ""} onChange={(e) => setR({ ...r, delivery_time: e.target.value })} /></Field>
          <Field label="Opening Time"><input type="time" className="ai" value={r.opening_time ?? ""} onChange={(e) => setR({ ...r, opening_time: e.target.value })} /></Field>
          <Field label="Closing Time"><input type="time" className="ai" value={r.closing_time ?? ""} onChange={(e) => setR({ ...r, closing_time: e.target.value })} /></Field>
          <Field label="Min Order Value (₹)"><input type="number" min={0} className="ai" value={r.min_order_value} onChange={(e) => setR({ ...r, min_order_value: Number(e.target.value) })} /></Field>
          <Field label="Delivery Charges (₹)"><input type="number" min={0} className="ai" value={r.delivery_charges} onChange={(e) => setR({ ...r, delivery_charges: Number(e.target.value) })} /></Field>
        </div>

        <Field label="Address"><textarea className="ai" rows={2} value={r.address ?? ""} maxLength={300} onChange={(e) => setR({ ...r, address: e.target.value })} /></Field>

        <div className="rounded-xl border bg-secondary/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Kitchen coordinates</p>
              <p className="text-[11px] text-muted-foreground">Used to serve customers within 10 km.</p>
            </div>
            <button
              type="button"
              disabled={locating}
              onClick={async () => {
                setLocating(true);
                try {
                  const p = await getCurrentLocation();
                  setR({ ...r, latitude: p.lat, longitude: p.lng });
                  toast.success("Pinned current location");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not get location");
                } finally {
                  setLocating(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
              {locating ? "Getting location…" : "Use my location"}
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label="Latitude">
              <input type="number" step="0.000001" className="ai" value={r.latitude ?? ""}
                onChange={(e) => setR({ ...r, latitude: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Longitude">
              <input type="number" step="0.000001" className="ai" value={r.longitude ?? ""}
                onChange={(e) => setR({ ...r, longitude: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl bg-secondary px-3 py-3">
          <div>
            <p className="text-sm font-semibold">Accepting orders</p>
            <p className="text-[11px] text-muted-foreground">Turn off to pause incoming orders</p>
          </div>
          <input type="checkbox" checked={!!r.is_open} onChange={(e) => setR({ ...r, is_open: e.target.checked })} className="h-5 w-5" />
        </label>

        <button onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>

      <style>{`.ai { width:100%; border-radius:12px; padding:10px 12px; background:var(--color-input); border:1px solid var(--color-border); font-size:14px; outline:none; } .ai:focus{ border-color: var(--color-ring);}`}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
