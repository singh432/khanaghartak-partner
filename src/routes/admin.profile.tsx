import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/profile")({ component: AdminProfile });

type Restaurant = {
  id: string; name: string; tagline: string | null; address: string | null;
  rating: number | null; delivery_time: string | null; is_open: boolean | null;
  image_url: string | null; banner_url: string | null;
};

function AdminProfile() {
  const [r, setR] = useState<Restaurant | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("restaurant").select("*").limit(1).maybeSingle()
      .then(({ data }) => setR(data as Restaurant | null));
  }, []);

  const save = async () => {
    if (!r) return;
    setSaving(true);
    const { error } = await supabase.from("restaurant").update({
      name: r.name, tagline: r.tagline, address: r.address,
      delivery_time: r.delivery_time, is_open: r.is_open,
    }).eq("id", r.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Restaurant profile saved");
  };

  if (!r) return <div className="p-8 text-center text-sm text-muted-foreground">Loading restaurant…</div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Restaurant Profile</h1>
        <p className="text-sm text-muted-foreground">Update what customers see on the menu page</p>
      </header>

      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <Field label="Restaurant name">
          <input className="ai" value={r.name} maxLength={80} onChange={(e) => setR({ ...r, name: e.target.value })} />
        </Field>
        <Field label="Tagline">
          <input className="ai" value={r.tagline ?? ""} maxLength={120} onChange={(e) => setR({ ...r, tagline: e.target.value })} />
        </Field>
        <Field label="Address">
          <textarea className="ai" rows={2} value={r.address ?? ""} maxLength={300} onChange={(e) => setR({ ...r, address: e.target.value })} />
        </Field>
        <Field label="Delivery time">
          <input className="ai" value={r.delivery_time ?? ""} maxLength={40} onChange={(e) => setR({ ...r, delivery_time: e.target.value })} />
        </Field>
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

      <style>{`.ai { width:100%; border-radius:12px; padding:10px 12px; background:var(--color-input); border:1px solid var(--color-border); font-size:14px; outline:none; } .ai:focus{ border-color: var(--color-ring);} `}</style>
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
