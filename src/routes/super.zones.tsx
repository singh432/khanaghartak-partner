import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllZones, type DeliveryZone, type ZonePoint } from "@/lib/zones";

const ZoneMapEditor = lazy(() => import("@/components/ZoneMapEditor.client"));

export const Route = createFileRoute("/super/zones")({
  component: SuperZones,
  head: () => ({ meta: [{ title: "Delivery Zones — KhanaGharTak Super Admin" }] }),
});

type Manager = { zone_id: string; user_id: string; email: string; full_name: string | null };
type Rest = { id: string; name: string; zone_id: string | null };
type Rider = { user_id: string; full_name: string | null; zone_id: string | null };

function SuperZones() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [restaurants, setRestaurants] = useState<Rest[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [points, setPoints] = useState<ZonePoint[]>([]);
  const [charge, setCharge] = useState("");
  const [managerEmail, setManagerEmail] = useState("");

  const load = async () => {
    const [z, { data: m }, { data: rs }, { data: rd }] = await Promise.all([
      fetchAllZones(),
      supabase.rpc("super_list_zone_managers" as any),
      supabase.from("restaurants").select("id,name,zone_id").order("name"),
      (supabase.from("rider_profiles") as any).select("user_id,full_name,zone_id"),
    ]);
    setZones(z);
    setManagers((m ?? []) as unknown as Manager[]);
    setRestaurants((rs ?? []) as unknown as Rest[]);
    setRiders((rd ?? []) as unknown as Rider[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setName(""); setCity(""); setPoints([]); setCharge(""); };
  const startEdit = (z: DeliveryZone) => {
    setEditing(z); setName(z.name); setCity(z.city ?? ""); setPoints(z.polygon);
    setCharge(z.delivery_charge === null ? "" : String(z.delivery_charge));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (name.trim().length < 3) return toast.error("Give the zone a name");
    if (points.length < 3) return toast.error("Draw at least 3 boundary points on the map");
    setBusy(true);
    const payload = {
      name: name.trim(),
      city: city.trim() || null,
      polygon: points as any,
      delivery_charge: charge.trim() === "" ? null : Number(charge),
    };
    const { error } = editing
      ? await (supabase.from("delivery_zones") as any).update(payload).eq("id", editing.id)
      : await (supabase.from("delivery_zones") as any).insert({ ...payload, is_active: true });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Zone updated" : "Zone created");
    startNew();
    load();
  };

  const toggleActive = async (z: DeliveryZone) => {
    const { error } = await (supabase.from("delivery_zones") as any)
      .update({ is_active: !z.is_active }).eq("id", z.id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeZone = async (z: DeliveryZone) => {
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    const { error } = await (supabase.from("delivery_zones") as any).delete().eq("id", z.id);
    if (error) return toast.error(error.message);
    toast.success("Zone deleted");
    if (editing?.id === z.id) startNew();
    load();
  };

  const addManager = async (zoneId: string) => {
    if (!managerEmail.trim()) return toast.error("Enter the manager's email");
    const { error } = await supabase.rpc("super_assign_zone_manager" as any, {
      _email: managerEmail.trim(), _zone_id: zoneId,
    });
    if (error) return toast.error(error.message);
    toast.success("Zone manager added");
    setManagerEmail("");
    load();
  };

  const removeManager = async (zoneId: string, userId: string) => {
    const { error } = await supabase.rpc("super_remove_zone_manager" as any, { _zone_id: zoneId, _user_id: userId });
    if (error) return toast.error(error.message);
    load();
  };

  const setRestaurantZone = async (id: string, zoneId: string) => {
    const { error } = await (supabase.from("restaurants") as any)
      .update({ zone_id: zoneId || null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Restaurant zone updated");
    load();
  };

  const setRiderZone = async (userId: string, zoneId: string) => {
    const { error } = await (supabase.from("rider_profiles") as any)
      .update({ zone_id: zoneId || null }).eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success("Rider zone updated");
    load();
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Delivery Zones</h1>
          <p className="text-sm text-muted-foreground">Draw a boundary on the map — only customers inside an active zone can order.</p>
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">{editing ? `Editing: ${editing.name}` : "Create a new zone"}</h2>
          {editing && <button onClick={startNew} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">Cancel edit</button>}
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Zone name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
              placeholder="Shankargarh Town"
              className="h-11 w-full rounded-xl border bg-input px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">City (optional)</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80}
              placeholder="Prayagraj"
              className="h-11 w-full rounded-xl border bg-input px-3 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Delivery charge ₹ (optional)</span>
            <input value={charge} onChange={(e) => setCharge(e.target.value.replace(/[^0-9.]/g, ""))}
              inputMode="decimal" placeholder="e.g. 40"
              className="h-11 w-full rounded-xl border bg-input px-3 text-sm outline-none focus:border-primary" />
          </label>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Click the map to add boundary points · click a point to remove it · {points.length} point{points.length === 1 ? "" : "s"} added
        </p>
        <div className="mt-2">
          <ClientOnly fallback={<div className="h-[380px] w-full animate-pulse rounded-2xl border bg-secondary/40" />}>
            <Suspense fallback={<div className="h-[380px] w-full animate-pulse rounded-2xl border bg-secondary/40" />}>
              <ZoneMapEditor points={points} onChange={setPoints} existing={zones.filter((z) => z.id !== editing?.id)} />
            </Suspense>
          </ClientOnly>
        </div>

        <div className="mt-3 flex gap-2">
          <button onClick={save} disabled={busy}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {editing ? "Save zone" : "Create zone"}
          </button>
          {points.length > 0 && (
            <button onClick={() => setPoints([])} className="h-11 rounded-xl bg-secondary px-4 text-sm font-semibold">Clear points</button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-bold">Zones ({zones.length})</h2>
        <div className="mt-3 space-y-3">
          {zones.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No zones yet.</p>}
          {zones.map((z) => {
            const zm = managers.filter((m) => m.zone_id === z.id);
            return (
              <article key={z.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">{z.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {z.city ?? "—"} · {z.polygon.length} boundary points{z.delivery_charge !== null ? ` · ₹${z.delivery_charge} delivery` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${z.is_active ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                      {z.is_active ? "Active" : "Paused"}
                    </span>
                    <button onClick={() => toggleActive(z)} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">
                      {z.is_active ? "Pause" : "Activate"}
                    </button>
                    <button onClick={() => startEdit(z)} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">Edit map</button>
                    <button onClick={() => removeZone(z)} className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 rounded-xl bg-secondary/50 p-3">
                  <p className="text-xs font-bold">Zone managers</p>
                  {zm.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No manager assigned.</p>}
                  {zm.map((m) => (
                    <div key={m.user_id} className="mt-1 flex items-center justify-between text-xs">
                      <span>{m.full_name ?? m.email} <span className="text-muted-foreground">· {m.email}</span></span>
                      <button onClick={() => removeManager(z.id, m.user_id)} className="font-semibold text-destructive">Remove</button>
                    </div>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <input value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)}
                      placeholder="manager@email.com"
                      className="h-9 flex-1 rounded-lg border bg-background px-3 text-xs outline-none focus:border-primary" />
                    <button onClick={() => addManager(z.id)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground">
                      <UserPlus className="h-3.5 w-3.5" /> Add
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">The person must have signed in to KhanaGharTak at least once.</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold">Restaurants → zone</h2>
          <div className="mt-3 space-y-2">
            {restaurants.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.name}</span>
                <select value={r.zone_id ?? ""} onChange={(e) => setRestaurantZone(r.id, e.target.value)}
                  className="h-9 w-40 rounded-lg border bg-background px-2 text-xs">
                  <option value="">Unassigned</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            ))}
            {restaurants.length === 0 && <p className="text-xs text-muted-foreground">No restaurants yet.</p>}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold">Riders → zone</h2>
          <div className="mt-3 space-y-2">
            {riders.map((r) => (
              <div key={r.user_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{r.full_name ?? r.user_id.slice(0, 8)}</span>
                <select value={r.zone_id ?? ""} onChange={(e) => setRiderZone(r.user_id, e.target.value)}
                  className="h-9 w-40 rounded-lg border bg-background px-2 text-xs">
                  <option value="">Unassigned</option>
                  {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
            ))}
            {riders.length === 0 && <p className="text-xs text-muted-foreground">No riders yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
