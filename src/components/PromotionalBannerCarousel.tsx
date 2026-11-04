import React, { useState, useEffect, useCallback, useRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { getActivePromotionalBanners, type PromotionalBanner } from "@/data/promotionalBanners";

interface PromotionalBannerCarouselProps {
  banners?: PromotionalBanner[];
  autoSlideIntervalMs?: number;
  className?: string;
}

export function PromotionalBannerCarousel({
  banners,
  autoSlideIntervalMs = 5000,
  className = "",
}: PromotionalBannerCarouselProps) {
  const activeBanners = banners ?? getActivePromotionalBanners();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);

  // Initialize Embla with infinite loop and smooth horizontal sliding
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    duration: 30, // Smooth transition duration
    skipSnaps: false,
    dragFree: false,
  });

  // Track select event & scroll snaps for pagination dots
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Pause auto-sliding when user interacts, then resume
  useEffect(() => {
    if (!emblaApi) return;

    const onPointerDown = () => {
      isDraggingRef.current = false;
      setIsPaused(true);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };

    const onScroll = () => {
      isDraggingRef.current = true;
    };

    const onPointerUp = () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      // Resume auto-slide 2.5 seconds after user stops interacting
      resumeTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
        isDraggingRef.current = false;
      }, 2500);
    };

    emblaApi.on("pointerDown", onPointerDown);
    emblaApi.on("scroll", onScroll);
    emblaApi.on("pointerUp", onPointerUp);

    return () => {
      emblaApi.off("pointerDown", onPointerDown);
      emblaApi.off("scroll", onScroll);
      emblaApi.off("pointerUp", onPointerUp);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, [emblaApi]);

  // Automatic slide every 5 seconds (5000ms), paused during interaction
  useEffect(() => {
    if (!emblaApi || isPaused || activeBanners.length <= 1) return;

    const timer = setInterval(() => {
      emblaApi.scrollNext();
    }, autoSlideIntervalMs);

    return () => clearInterval(timer);
  }, [emblaApi, isPaused, activeBanners.length, autoSlideIntervalMs]);

  // Preload next banner image for instant, stutter-free transitions
  useEffect(() => {
    if (activeBanners.length <= 1) return;

    const nextIndex = (selectedIndex + 1) % activeBanners.length;
    const nextBanner = activeBanners[nextIndex];
    if (nextBanner?.imageUrl) {
      const img = new Image();
      img.src = nextBanner.imageUrl;
    }
  }, [selectedIndex, activeBanners]);

  const scrollTo = useCallback(
    (index: number) => {
      if (!emblaApi) return;
      emblaApi.scrollTo(index);
      setIsPaused(true);
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = setTimeout(() => setIsPaused(false), 3000);
    },
    [emblaApi]
  );

  // If no banners are active, do not render anything
  if (activeBanners.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Promotions and Announcements"
      className={`relative w-full select-none ${className}`}
      onMouseEnter={() => {
        if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: hover)").matches) {
          setIsPaused(true);
        }
      }}
      onMouseLeave={() => {
        if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: hover)").matches) {
          setIsPaused(false);
        }
      }}
    >
      {/* Embla Viewport */}
      <div
        ref={emblaRef}
        className="overflow-hidden rounded-2xl shadow-[var(--shadow-soft)] bg-card border border-border/60"
      >
        <div className="flex touch-pan-y">
          {activeBanners.map((banner, index) => {
            const isCurrent = index === selectedIndex;
            return (
              <div
                key={banner.id}
                className="relative min-w-0 flex-[0_0_100%]"
              >
                <div
                  className="relative w-full aspect-[1774/887] overflow-hidden rounded-2xl bg-muted/20"
                  onClick={() => {
                    if (isDraggingRef.current) return;
                    if (banner.linkUrl) {
                      window.location.href = banner.linkUrl;
                    }
                  }}
                >
                  <img
                    src={banner.imageUrl}
                    alt={banner.altText || banner.title}
                    title={banner.title}
                    width={1774}
                    height={887}
                    loading={index === 0 ? "eager" : "lazy"}
                    decoding="async"
                    fetchPriority={index === 0 ? "high" : "auto"}
                    className="h-full w-full object-contain pointer-events-none transition-transform duration-500 ease-out"
                    style={{
                      maxHeight: "100%",
                      maxWidth: "100%",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination dots */}
      {activeBanners.length > 1 && (
        <div
          className="mt-2.5 flex items-center justify-center gap-1.5"
          role="tablist"
          aria-label="Promotional banner slides"
        >
          {activeBanners.map((banner, index) => {
            const isActive = index === selectedIndex;
            return (
              <button
                key={banner.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to slide ${index + 1}: ${banner.title}`}
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
      )}
    </section>
  );
}
