import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Receipt, ShoppingBag, User } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { isPartnerApp } from "@/lib/capacitor";

const HIDDEN_ON = ["/login", "/checkout", "/admin", "/location", "/"];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { totalQty } = useCart();

  // Hide in Partner App, or on auth/checkout/admin/zone/rider/super/order-detail and root
  if (
    isPartnerApp() ||
    HIDDEN_ON.includes(pathname) ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/super") ||
    pathname.startsWith("/rider") ||
    pathname.startsWith("/zone") ||
    pathname.startsWith("/order/")
  ) {
    return null;
  }

  const tabs: Array<{
    to: "/home" | "/orders" | "/cart" | "/profile";
    label: string;
    icon: typeof Home;
    badge?: number;
  }> = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/orders", label: "Orders", icon: Receipt },
    { to: "/cart", label: "Cart", icon: ShoppingBag, badge: totalQty },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border/50 bg-background/95 backdrop-blur shadow-[0_-2px_10px_rgba(0,0,0,0.03)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, badge }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                preload="intent"
                className={`relative flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                  active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
                  {badge && badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground shadow-sm">
                      {badge}
                    </span>
                  ) : null}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
