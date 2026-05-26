import { Link, useRouterState } from "@tanstack/react-router";
import { Home, UtensilsCrossed, Receipt, ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

const HIDDEN_ON = ["/login", "/checkout", "/admin", "/location", "/"];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { totalQty } = useCart();

  // Hide on auth/checkout/admin/order-detail and root
  if (
    HIDDEN_ON.includes(pathname) ||
    pathname.startsWith("/order/")
  ) {
    return null;
  }

  const tabs: Array<{ to: "/home" | "/menu" | "/orders" | "/cart"; label: string; icon: typeof Home; badge?: number }> = [
    { to: "/home", label: "Home", icon: Home },
    { to: "/menu", label: "Menu", icon: UtensilsCrossed },
    { to: "/orders", label: "Orders", icon: Receipt },
    { to: "/cart", label: "Cart", icon: ShoppingBag, badge: totalQty },
  ];

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {tabs.map(({ to, label, icon: Icon, badge }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                  {badge && badge > 0 ? (
                    <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
