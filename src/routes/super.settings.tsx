import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, QrCode } from "lucide-react";

export const Route = createFileRoute("/super/settings")({ component: SuperSettings });

type S = {
  id: string; platform_fee: number; default_delivery_charges: number;
  delivery_per_km: number; max_delivery_radius_km: number;
  support_phone: string | null; support_email: string | null;
  terms: string | null; privacy: string | null;
};

type QR = {
  id: string; target_url: string; label: string; updated_at: string;
};

function SuperSettings() {
  const [s, setS] = useState<S | null>(null);
  const [qr, setQr] = useState<QR | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingQr, setSavingQr] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("*").limit(1).maybeSingle().then(({ data }) => setS(data as S | null));
    supabase.from("qr_settings").select("*").limit(1).maybeSingle().then(({ data }) => setQr(data as QR | null));
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("platform_settings").update({
      platform_fee: s.platform_fee, default_delivery_charges: s.default_delivery_charges,
      support_phone: s.support_phone, support_email: s.support_email,
      terms: s.terms, privacy: s.privacy,
    }).eq("id", s.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Saved");
  };

  const saveQr = async () => {
    if (!qr) return;
    setSavingQr(true);
    const { error } = await supabase.from("qr_settings").update({
      target_url: qr.target_url, label: qr.label, updated_at: new Date().toISOString(),
    }).eq("id", qr.id);
    setSavingQr(false);
    if (error) toast.error(error.message); else toast.success("QR settings saved");
  };

  if (!s || !qr) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Platform Settings</h1>
        <p className="text-sm text-muted-foreground">Fees, delivery, support, QR code, and policies</p>
      </header>

      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Platform Fee (₹)">
            <input type="number" min={0} step="1" className="ai" value={s.platform_fee}
              onChange={(e) => setS({ ...s, platform_fee: Number(e.target.value) })} />
          </Field>
          <Field label="Default Delivery Charges (₹)">
            <input type="number" min={0} step="1" className="ai" value={s.default_delivery_charges}
              onChange={(e) => setS({ ...s, default_delivery_charges: Number(e.target.value) })} />
          </Field>
          <Field label="Support Phone">
            <input className="ai" value={s.support_phone ?? ""} onChange={(e) => setS({ ...s, support_phone: e.target.value })} />
          </Field>
          <Field label="Support Email">
            <input className="ai" value={s.support_email ?? ""} onChange={(e) => setS({ ...s, support_email: e.target.value })} />
          </Field>
        </div>
        <Field label="Terms & Conditions">
          <textarea className="ai" rows={4} value={s.terms ?? ""} onChange={(e) => setS({ ...s, terms: e.target.value })} />
        </Field>
        <Field label="Privacy Policy">
          <textarea className="ai" rows={4} value={s.privacy ?? ""} onChange={(e) => setS({ ...s, privacy: e.target.value })} />
        </Field>

        <button onClick={save} disabled={saving} className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save platform settings
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">QR Code</h2>
            <p className="text-sm text-muted-foreground">Change where the public /qr page sends scanners.</p>
          </div>
          <Link to="/qr" target="_blank" className="inline-flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2 text-xs font-bold">
            <QrCode className="h-4 w-4" /> Preview /qr
          </Link>
        </div>
        <Field label="QR Target URL">
          <input className="ai" value={qr.target_url} onChange={(e) => setQr({ ...qr, target_url: e.target.value })} placeholder="https://khanaghartak.lovable.app" />
        </Field>
        <Field label="QR Label">
          <input className="ai" value={qr.label} onChange={(e) => setQr({ ...qr, label: e.target.value })} placeholder="Scan to order" />
        </Field>
        <button onClick={saveQr} disabled={savingQr} className="inline-flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {savingQr && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save QR settings
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
