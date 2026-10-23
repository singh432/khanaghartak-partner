import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { ChevronDown, MapPin } from "lucide-react";

export function BrandHeader({
  subtitle,
  locationText,
}: {
  subtitle?: string;
  locationText?: string;
  hideCart?: boolean;
}) {
  const [address, setAddress] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kgt:delivery-address") || "";
    }
    return "";
  });

  useEffect(() => {
    const sync = () => {
      const a = localStorage.getItem("kgt:delivery-address") || "";
      setAddress(a);
    };
    window.addEventListener("storage", sync);
    window.addEventListener("kgt:address-changed", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("kgt:address-changed", sync);
    };
  }, []);

  // Determine location label for the right pill
  let loc = locationText || address;
  let leftSubtitle = subtitle;

  // If subtitle starts with "Deliver to:", route it to the location pill
  if (subtitle && subtitle.startsWith("Deliver to:")) {
    loc = subtitle.replace("Deliver to:", "").trim();
    leftSubtitle = "Ghar Baithe Order Karo";
  }

  const cleanLoc = loc ? loc.trim() : "Set location";
  const displayLoc = cleanLoc.length > 18 ? cleanLoc.slice(0, 18) + "…" : cleanLoc;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-2.5 bg-background/95 px-4 py-2.5 backdrop-blur border-b border-border/50">
      {/* Left: Brand Logo & Title/Subtitle matching web reference */}
      <Link to="/home" className="flex items-center gap-2.5 min-w-0">
        <img
          src={khanaGharTakLogoUrl}
          alt="KhanaGharTak"
          width={38}
          height={38}
          className="h-9 w-9 rounded-xl object-contain shrink-0 shadow-sm"
        />
        <div className="leading-tight min-w-0">
          <div className="text-[15px] font-black tracking-tight text-foreground truncate">
            KhanaGharTak
          </div>
          {leftSubtitle && (
            <div className="text-[11px] font-medium text-muted-foreground truncate max-w-[140px] sm:max-w-[200px]">
              {leftSubtitle}
            </div>
          )}
        </div>
      </Link>

      {/* Right: Location Pill matching website reference screenshot exactly */}
      <Link
        to="/location"
        className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-[#FFF8F5] dark:bg-card px-3 py-1.5 text-xs font-bold text-primary shadow-sm hover:bg-primary/10 transition active:scale-95 shrink-0 ml-auto"
        title="Deliver to: Set location"
      >
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[130px] font-bold text-primary">
          Deliver to: {displayLoc}
        </span>
        <ChevronDown className="h-3 w-3 text-primary/70 shrink-0" />
      </Link>
    </header>
  );
}
