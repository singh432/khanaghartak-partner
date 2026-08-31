import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllZones, type DeliveryZone } from "@/lib/zones";

export const Route = createFileRoute("/super/managers")({
  component: SuperManagers,
  head: () => ({
    meta: [
      { title: "Zone Managers — KhanaGharTak Super Admin" },
      { name: "description", content: "Assign and remove KhanaGharTak zone managers for each delivery zone." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Zone Managers — KhanaGharTak Super Admin" },
      { property: "og:description", content: "Assign and remove KhanaGharTak zone managers for each delivery zone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Manager = { zone_id: string; user_id: string; email: string; full_name: string | null };

function SuperManagers() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const [z, { data }] = await Promise.all([fetchAllZones(), supabase.rpc("super_list_zone_managers" as any)]);
    setZones(z);
    setManagers((data ?? []) as unknown as Manager[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async (zoneId: string) => {
    const value = (email[zoneId] ?? "").trim();
    if (!value) return toast.error("Enter the manager's email");
    setBusy(zoneId);
    const { error } = await supabase.rpc("super_assign_zone_manager" as any, { _email: value, _zone_id: zoneId });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Zone manager added");
    setEmail((s) => ({ ...s, [zoneId]: "" }));
    load();
  };

  const remove = async (zoneId: string, userId: string) => {
    const { error } = await supabase.rpc("super_remove_zone_manager" as any, { _zone_id: zoneId, _user_id: userId });
    if (error) return toast.error(error.message);
    toast.success("Manager removed");
    load();
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Managers</h1>
          <p className="text-sm text-muted-foreground">
            A manager only sees and edits their own zone — orders, restaurants, riders, customers and the zone map.
          </p>
        </div>
      </header>

      {zones.length === 0 && (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Create a delivery zone first, then assign a manager to it.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {zones.map((z) => {
          const zm = managers.filter((m) => m.zone_id === z.id);
          return (
            <section key={z.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold">{z.name}</p>
                  <p className="text-xs text-muted-foreground">{z.city ?? "—"}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${z.is_active ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                  {z.is_active ? "Active" : "Paused"}
                </span>
              </div>

              <div className="mt-3 space-y-1">
                {zm.length === 0 && <p className="text-xs text-muted-foreground">No manager assigned.</p>}
                {zm.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate">
                      {m.full_name ?? m.email} <span className="text-muted-foreground">· {m.email}</span>
                    </span>
                    <button onClick={() => remove(z.id, m.user_id)} className="shrink-0 font-semibold text-destructive">Remove</button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={email[z.id] ?? ""}
                  onChange={(e) => setEmail((s) => ({ ...s, [z.id]: e.target.value }))}
                  placeholder="manager@email.com"
                  className="h-9 flex-1 rounded-lg border bg-background px-3 text-xs outline-none focus:border-primary"
                />
                <button onClick={() => add(z.id)} disabled={busy === z.id}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
                  {busy === z.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />} Add
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">The person must have signed in to KhanaGharTak at least once.</p>
            </section>
          );
        })}
      </div>
    </div>
  );
}
