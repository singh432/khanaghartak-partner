import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

const HIDDEN_PREFIXES = ["/cart", "/checkout", "/admin", "/super", "/rider", "/login", "/order/"];

/** Zomato-style persistent cart bar shown on any customer page once items are added. */
export function CartBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { totalQty, subtotal, ready } = useCart();

  if (!ready || totalQty === 0) return null;
  if (pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;

  return (
    <Link
      to="/cart"
      className="fixed left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-[448px] -translate-x-1/2 items-center justify-between rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-2xl"
      style={{ bottom: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-2 text-sm">
        <ShoppingBag className="h-5 w-5" aria-hidden="true" />
        <div>
          <div className="font-bold leading-tight">
            {totalQty} item{totalQty > 1 ? "s" : ""} · ₹{subtotal.toFixed(0)}
          </div>
          <div className="text-[11px] opacity-90">Extra charges may apply</div>
        </div>
      </div>
      <span className="text-sm font-bold">View Cart →</span>
    </Link>
  );
}
