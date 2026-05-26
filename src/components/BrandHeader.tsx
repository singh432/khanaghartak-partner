import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/hooks/useCart";

export function BrandHeader({ subtitle }: { subtitle?: string }) {
  const { totalQty } = useCart();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/80 px-4 py-3 backdrop-blur border-b">
      <Link to="/home" className="flex items-center gap-2">
        <img src={logo} alt="KhanaGharTak" width={36} height={36} className="h-9 w-9" />
        <div className="leading-tight">
          <div className="text-base font-bold tracking-tight">KhanaGharTak</div>
          {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
        </div>
      </Link>
      <Link to="/cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
        <ShoppingBag className="h-5 w-5" />
        {totalQty > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
            {totalQty}
          </span>
        )}
      </Link>
    </header>
  );
}
