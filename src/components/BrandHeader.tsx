import { Link } from "@tanstack/react-router";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { ChevronDown, MapPin } from "lucide-react";

export function BrandHeader({ subtitle }: { subtitle?: string; hideCart?: boolean }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2 bg-background/90 px-4 py-2.5 backdrop-blur border-b">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Link to="/home" className="flex items-center gap-2 shrink-0">
          <img
            src={khanaGharTakLogoUrl}
            alt="KhanaGharTak"
            width={36}
            height={36}
            className="h-9 w-9 rounded-lg object-contain"
          />
          <div className="text-base font-bold tracking-tight">KhanaGharTak</div>
        </Link>

        {subtitle && (
          <Link
            to="/location"
            className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-1 text-[11.5px] font-bold text-primary hover:bg-primary/15 transition active:scale-95 max-w-[210px] sm:max-w-[300px] shadow-sm"
            title="Change delivery location"
          >
            <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate text-foreground font-semibold">{subtitle}</span>
            <ChevronDown className="h-3 w-3 text-primary/70 shrink-0" />
          </Link>
        )}
      </div>
    </header>
  );
}

