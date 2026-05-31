import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";
import { LayoutDashboard, ClipboardList, UtensilsCrossed, UserCog, LogOut, Bell } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { to: "/admin/profile", label: "Profile", icon: UserCog },
];

function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading, isAdmin, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  if (loading) return <div className="p-8 text-center text-sm">Loading…</div>;
  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <img src={logo} width={56} height={56} alt="" className="mx-auto h-14 w-14" />
        <h1 className="mt-4 text-lg font-bold">Restaurant Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account doesn't have admin access. Ask the owner to grant you the
          <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-xs">restaurant_admin</code> role.
        </p>
        <p className="mt-4 text-xs text-muted-foreground break-all">Your user ID: {user.id}</p>
        <button onClick={signOut} className="mt-6 rounded-full bg-secondary px-4 py-2 text-sm">Sign out</button>
      </div>
    );
  }

  const isActive = (to: string, exact?: boolean) => exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen md:flex md:bg-secondary/30">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <img src={logo} width={32} height={32} alt="" className="h-8 w-8" />
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
            <img src={logo} width={32} height={32} alt="" className="h-8 w-8" />
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
        <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t bg-background md:hidden">
          {NAV.map((n) => {
            const active = isActive(n.to, n.exact);
            return (
              <Link key={n.to} to={n.to}
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
