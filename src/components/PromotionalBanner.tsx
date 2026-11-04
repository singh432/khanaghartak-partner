import { useState, useRef, useCallback } from "react";
import priceComparisonBanner from "@/assets/banners/price-comparison.png";
import { PRICE_COMPARISON_BANNER_BASE64 } from "@/assets/banners/priceComparisonBase64";

export interface PromotionalBannerItem {
  id: string;
  imageUrl: string;
  altText: string;
  linkUrl?: string;
  title?: string;
}

// Configurable default banner items. Additional banners can be added here easily.
export const DEFAULT_PROMOTIONAL_BANNERS: PromotionalBannerItem[] = [
  {
    id: "price-comparison",
    imageUrl: priceComparisonBanner,
    altText: "KhanaGharTak - Fair Pricing Comparison (Other platforms 1.5X vs KhanaGharTak X)",
    title: "KhanaGharTak Fair Pricing Comparison",
  },
];

interface PromotionalBannerProps {
  banners?: PromotionalBannerItem[];
  className?: string;
}

export function PromotionalBanner({
  banners = DEFAULT_PROMOTIONAL_BANNERS,
  className = "",
}: PromotionalBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const itemWidth = el.offsetWidth;
    if (itemWidth > 0) {
      const newIndex = Math.round(scrollLeft / itemWidth);
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    }
  }, [activeIndex]);

  const scrollTo = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      left: index * el.offsetWidth,
      behavior: "smooth",
    });
    setActiveIndex(index);
  };

  if (!banners || banners.length === 0) {
    return null;
  }

  // Single banner: lightweight, zero scroll overhead
  if (banners.length === 1) {
    const banner = banners[0];
    return (
      <section
        id="kgt-promotional-banner"
        aria-label="Promotions"
        className={`w-full select-none ${className}`}
      >
        <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-soft)]">
          <img
            src={banner.imageUrl}
            alt={banner.altText}
            title={banner.title}
            width={1024}
            height={512}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={(e) => {
              // Instant fallback to embedded data URI if network asset fails
              if (e.currentTarget.src !== PRICE_COMPARISON_BANNER_BASE64) {
                e.currentTarget.src = PRICE_COMPARISON_BANNER_BASE64;
              }
            }}
            className="w-full aspect-[2/1] object-contain rounded-2xl block"
          />
        </div>
      </section>
    );
  }

  // Multiple banners: swipeable carousel with CSS scroll-snap
  return (
    <section
      id="kgt-promotional-banner"
      aria-label="Promotions"
      className={`w-full select-none ${className}`}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className="w-full min-w-full shrink-0 snap-center"
          >
            <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[var(--shadow-soft)]">
              <img
                src={banner.imageUrl}
                alt={banner.altText}
                title={banner.title}
                width={1024}
                height={512}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                fetchPriority={index === 0 ? "high" : "auto"}
                className="w-full aspect-[2/1] object-contain rounded-2xl block"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pagination dots when multiple banners are present */}
      <div
        className="mt-2.5 flex items-center justify-center gap-1.5"
        role="tablist"
        aria-label="Promotional banner slides"
      >
        {banners.map((banner, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={banner.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Go to slide ${index + 1}`}
              onClick={() => scrollTo(index)}
              className={`h-1.5 rounded-full transition-all duration-300 active:scale-90 ${
                isActive
                  ? "w-6 bg-primary shadow-sm shadow-primary/40"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
