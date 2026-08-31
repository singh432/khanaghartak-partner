import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { LayoutDashboard, Store, ClipboardList, Users, BarChart3, Settings as SettingsIcon, LogOut, ShieldAlert, Bike, Truck, MapPin, UserCog, IndianRupee, BadgePercent } from "lucide-react";

export const Route = createFileRoute("/super")({ component: SuperLayout });

const NAV = [
  { to: "/super", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/super/customers", label: "Customers", icon: Users },
  { to: "/super/orders", label: "Orders", icon: ClipboardList },
  { to: "/super/restaurants", label: "Restaurants", icon: Store },
  { to: "/super/riders", label: "Riders", icon: Bike },
  { to: "/super/zones", label: "Delivery Zones", icon: MapPin },
  { to: "/super/managers", label: "Managers", icon: UserCog },
  { to: "/super/revenue", label: "Revenue & Profit", icon: IndianRupee },
  { to: "/super/offers", label: "Offers", icon: BadgePercent },
  { to: "/super/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/super/deliveries", label: "Delivery", icon: Truck },
  { to: "/super/fraud", label: "Fraud", icon: ShieldAlert },
  { to: "/super/settings", label: "Platform", icon: SettingsIcon },
] as const;

const SUPER_ADMIN_EMAIL = "singhsuryapratap432@gmail.com";

function SuperLayout() {
  const navigate = useNavigate();
  const { user, loading, isSuperAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { as: "super" } });
  }, [user, loading, navigate]);

  if (loading) return <div className="p-8 text-center text-sm">Loading…</div>;
  if (!user) return null;

  const emailAllowed = (user.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;

  if (!isSuperAdmin || !emailAllowed) {
    return (
      <div className="p-6 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-lg font-bold">Super Admin Only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account doesn't have platform-owner access.
        </p>
        <button onClick={signOut} className="mt-6 rounded-full bg-secondary px-4 py-2 text-sm">Sign out</button>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen md:flex md:bg-secondary/30">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-56 md:shrink-0 md:flex-col md:border-r md:bg-card lg:w-64">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src={khanaGharTakLogoUrl} width={36} height={36} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">KhanaGharTak</p>
            <p className="text-[10px] uppercase tracking-wide text-primary">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">

          {NAV.map((n) => (
            <Link key={n.to} to={n.to as "/super"}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold ${
                isActive(n.to, (n as any).exact) ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary"
              }`}>
              <n.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{n.label}</span>
            </Link>

          ))}
        </nav>
        <button onClick={signOut} className="m-3 flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-semibold text-foreground/80">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex-1 pb-24 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <img src={khanaGharTakLogoUrl} width={36} height={36} alt="" className="h-9 w-9 rounded-lg object-contain" />
            <div>
              <p className="text-sm font-bold leading-tight">Super Admin</p>
              <p className="text-[11px] text-muted-foreground">Platform control</p>
            </div>
          </div>
          <button onClick={signOut} aria-label="Sign out" className="rounded-full p-2 text-muted-foreground"><LogOut className="h-4 w-4" /></button>
        </header>

        <main className="mx-auto max-w-6xl">
          <Outlet />
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 flex gap-1 overflow-x-auto border-t bg-background px-1 md:hidden">
          {NAV.map((n) => {
            const active = isActive(n.to, (n as any).exact);
            return (
              <Link key={n.to} to={n.to as "/super"}
                className={`flex min-w-[62px] shrink-0 flex-col items-center gap-0.5 py-2 text-center text-[9px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
