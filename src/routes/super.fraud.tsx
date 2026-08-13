import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Trash2, Plus, Wallet } from "lucide-react";

export const Route = createFileRoute("/super/fraud")({ component: SuperFraud });

type Blocked = { id: string; phone: string; reason: string | null; created_at: string };
type Restriction = { user_id: string; reason: string | null; disabled_until: string; name?: string | null; phone?: string | null };

function SuperFraud() {
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [{ data: b }, { data: c }] = await Promise.all([
      supabase.from("blocked_phones").select("id,phone,reason,created_at").order("created_at", { ascending: false }),
      supabase.from("cod_restrictions").select("user_id,reason,disabled_until").order("disabled_until", { ascending: false }),
    ]);
    setBlocked((b ?? []) as Blocked[]);
    const rows = (c ?? []) as Restriction[];
    if (rows.length) {
      const { data: profiles } = await supabase
        .from("profiles").select("id,full_name,phone").in("id", rows.map((r) => r.user_id));
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      rows.forEach((r) => {
        const p = map.get(r.user_id) as any;
        r.name = p?.full_name ?? null;
        r.phone = p?.phone ?? null;
      });
    }
    setRestrictions(rows);
  };

  useEffect(() => { load(); }, []);

  const block = async () => {
    const digits = phone.replace(/[^0-9]/g, "").slice(-10);
    if (digits.length !== 10) return toast.error("Enter a valid 10-digit number");
    setSaving(true);
    const { error } = await supabase.from("blocked_phones").insert({ phone: digits, reason: reason || null });
    setSaving(false);
    if (error) return toast.error(error.message);
    setPhone(""); setReason("");
    toast.success("Number blocked");
    load();
  };

  const unblock = async (id: string) => {
    const { error } = await supabase.from("blocked_phones").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Number unblocked");
    load();
  };

  const lift = async (userId: string) => {
    const { error } = await supabase.rpc("super_set_cod_restriction", { _user_id: userId, _days: 0 });
    if (error) return toast.error(error.message);
    toast.success("Cash on Delivery restored");
    load();
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Fraud protection</h1>
        <p className="text-sm text-muted-foreground">Blocked numbers and Cash on Delivery restrictions</p>
      </header>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-destructive" /> Block a phone number</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" inputMode="tel" maxLength={15}
            className="h-10 w-52 rounded-xl border bg-background px-3 text-sm outline-none" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" maxLength={120}
            className="h-10 flex-1 min-w-52 rounded-xl border bg-background px-3 text-sm outline-none" />
          <button onClick={block} disabled={saving}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-destructive px-4 text-sm font-bold text-destructive-foreground disabled:opacity-60">
            <Plus className="h-4 w-4" /> Block
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {blocked.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm">
              <div>
                <p className="font-semibold">+91 {b.phone}</p>
                <p className="text-xs text-muted-foreground">{b.reason ?? "No reason noted"}</p>
              </div>
              <button onClick={() => unblock(b.id)} className="rounded-lg bg-card p-2 text-destructive" title="Unblock">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {blocked.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No blocked numbers</p>}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 text-sm font-bold"><Wallet className="h-4 w-4 text-primary" /> Cash on Delivery disabled</h2>
        <p className="mt-1 text-xs text-muted-foreground">Applied automatically after 2 orders marked fake. Prepaid orders only until the date shown.</p>
        <div className="mt-4 space-y-2">
          {restrictions.map((r) => (
            <div key={r.user_id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm">
              <div>
                <p className="font-semibold">{r.name ?? r.user_id.slice(0, 8)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.phone ?? "—"} · until {new Date(r.disabled_until).toLocaleDateString("en-IN")} · {r.reason ?? "—"}
                </p>
              </div>
              <button onClick={() => lift(r.user_id)} className="rounded-lg bg-card px-3 py-1.5 text-xs font-bold text-primary">
                Restore COD
              </button>
            </div>
          ))}
          {restrictions.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No restricted customers</p>}
        </div>
      </section>
    </div>
  );
}
