import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, BarChart3, Settings as SettingsIcon, LogOut, Bell, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [restaurantChecked, setRestaurantChecked] = useState(false);
  const [hasRestaurant, setHasRestaurant] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { as: "admin" } as never });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setRestaurantChecked(false);
    (async () => {
      const { data } = await supabase.from("restaurants").select("id").eq("owner_id", user.id).limit(1).maybeSingle();
      if (active) {
        setHasRestaurant(!!data);
        setRestaurantChecked(true);
      }
    })();
    return () => { active = false; };
  }, [user]);

  if (loading || (user && !restaurantChecked)) return <div className="p-8 text-center text-sm">Loading…</div>;
  if (!user) return null;

  if (!isAdmin || !hasRestaurant) {
    return <RestaurantSetup userId={user.id} onSignOut={signOut} />;
  }

  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen md:flex md:bg-secondary/30">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src={khanaGharTakLogoUrl} width={36} height={36} alt="" className="h-9 w-9 rounded-lg object-contain" />
          <div>
            <p className="text-sm font-bold leading-tight">KhanaGharTak</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Admin Panel</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to as "/admin"}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                isActive(n.to, n.exact) ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary"
              }`}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold text-foreground/80">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 pb-24 md:pb-0">
        {/* Mobile top header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <img src={khanaGharTakLogoUrl} width={36} height={36} alt="" className="h-9 w-9 rounded-lg object-contain" />
            <div>
              <p className="text-sm font-bold leading-tight">Restaurant Admin</p>
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Bell className="h-3 w-3 text-success" /> Live orders
              </p>
            </div>
          </div>
          <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="mx-auto max-w-5xl">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t bg-background md:hidden">
          {NAV.map((n) => {
            const active = isActive(n.to, n.exact);
            return (
              <Link key={n.to} to={n.to as "/admin"}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function RestaurantSetup({ userId, onSignOut }: { userId: string; onSignOut: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", tagline: "", phone: "", address: "" });

  const createRestaurant = async (event: FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    if (name.length < 2) return toast.error("Restaurant name is required");
    setSaving(true);
    const { data, error } = await supabase.from("restaurants").insert({
      owner_id: userId,
      name,
      tagline: form.tagline.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      status: "active",
      is_open: true,
      delivery_time: "30-40 min",
      delivery_charges: 25,
      min_order_value: 0,
    }).select("id").single();
    if (error || !data) {
      setSaving(false);
      return toast.error(error?.message ?? "Could not add restaurant");
    }
    await supabase.from("categories").insert([
      { restaurant_id: data.id, name: "Breakfast", priority: 0 },
      { restaurant_id: data.id, name: "Main Course", priority: 1 },
      { restaurant_id: data.id, name: "Snacks", priority: 2 },
      { restaurant_id: data.id, name: "Beverages", priority: 3 },
    ]);
    toast.success("Restaurant added");
    window.location.href = "/admin/settings";
  };

  return (
    <div className="min-h-screen bg-secondary/30 px-4 py-8">
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-5 shadow-sm">
        <img src={khanaGharTakLogoUrl} width={84} height={84} alt="KhanaGharTak" className="mx-auto h-20 w-20 rounded-2xl object-contain" />
        <h1 className="mt-4 text-center text-xl font-extrabold tracking-tight">Add your restaurant</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Create your restaurant profile to open the owner dashboard.</p>
        <form onSubmit={createRestaurant} className="mt-5 space-y-3">
          <SetupField label="Restaurant name"><input className="setup-input" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="KhanaGharTak Kitchen" /></SetupField>
          <SetupField label="Tagline"><input className="setup-input" value={form.tagline} maxLength={120} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Fresh home-style meals" /></SetupField>
          <SetupField label="Phone"><input className="setup-input" value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></SetupField>
          <SetupField label="Address"><textarea className="setup-input" rows={3} value={form.address} maxLength={300} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Restaurant address" /></SetupField>
          <button type="submit" disabled={saving} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add restaurant
          </button>
        </form>
        <button onClick={onSignOut} className="mt-4 w-full text-center text-xs font-medium text-muted-foreground underline">Sign out</button>
      </div>
      <style>{`.setup-input { width:100%; border-radius:12px; padding:11px 12px; background:var(--color-input); border:1px solid var(--color-border); font-size:14px; outline:none; } .setup-input:focus{ border-color:var(--color-ring); }`}</style>
    </div>
  );
}

function SetupField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>{children}</label>;
}
