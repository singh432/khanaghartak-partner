import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";
import { LayoutDashboard, Store, ClipboardList, Users, BarChart3, Settings as SettingsIcon, LogOut, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/super")({ component: SuperLayout });

const NAV = [
  { to: "/super", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/super/restaurants", label: "Restaurants", icon: Store },
  { to: "/super/orders", label: "Orders", icon: ClipboardList },
  { to: "/super/customers", label: "Customers", icon: Users },
  { to: "/super/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/super/settings", label: "Platform", icon: SettingsIcon },
] as const;

function SuperLayout() {
  const navigate = useNavigate();
  const { user, loading, isSuperAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login", search: { redirect: "/super" } as never });
  }, [user, loading, navigate]);

  if (loading) return <div className="p-8 text-center text-sm">Loading…</div>;
  if (!user) return null;

  if (!isSuperAdmin) {
    return (
      <div className="p-6 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-lg font-bold">Super Admin Only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have platform-owner access.
        </p>
        <p className="mt-4 text-xs text-muted-foreground break-all">Your user ID: {user.id}</p>
        <button onClick={signOut} className="mt-6 rounded-full bg-secondary px-4 py-2 text-sm">Sign out</button>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen md:flex md:bg-secondary/30">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src={logo} width={32} height={32} alt="" className="h-8 w-8" />
          <div>
            <p className="text-sm font-bold leading-tight">KhanaGharTak</p>
            <p className="text-[10px] uppercase tracking-wide text-primary">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to as "/super"}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                isActive(n.to, (n as any).exact) ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-secondary"
              }`}>
              <n.icon className="h-4 w-4" /> {n.label}
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
            <img src={logo} width={32} height={32} alt="" className="h-8 w-8" />
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

        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-6 border-t bg-background md:hidden">
          {NAV.map((n) => {
            const active = isActive(n.to, (n as any).exact);
            return (
              <Link key={n.to} to={n.to as "/super"}
                className={`flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-5 w-5" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
