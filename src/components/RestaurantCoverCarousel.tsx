import { useState, useEffect, useRef, useMemo, TouchEvent } from "react";
import hero from "@/assets/hero.jpg";
import { getCategoryImage } from "@/lib/categoryImages";

export type CarouselDish = {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  offer_price: number | null;
  image_url: string | null;
  veg_type: string;
};

export type CarouselRestaurant = {
  id: string;
  name: string;
  banner_url: string | null;
  image_url: string | null;
};

interface RestaurantCoverCarouselProps {
  restaurant: CarouselRestaurant;
  items: CarouselDish[];
  isOpen: boolean;
  etaLabel: string;
  autoSlideIntervalMs?: number;
}

type Slide = {
  id: string;
  imageUrl: string;
  title: string;
  price?: number;
  originalPrice?: number | null;
  vegType?: string;
  isCover: boolean;
};

export function RestaurantCoverCarousel({
  restaurant,
  items,
  isOpen,
  etaLabel,
  autoSlideIntervalMs = 3000,
}: RestaurantCoverCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Construct slides: Slide 0 is Cover photo, followed by all items with photos
  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];

    // 1. Cover photo
    const coverUrl = restaurant.banner_url || restaurant.image_url || hero;
    list.push({
      id: "cover",
      imageUrl: coverUrl,
      title: restaurant.name,
      isCover: true,
    });

    // 2. Menu item photos (prioritize items with uploaded images)
    const itemsWithImages = items.filter((d) => d.image_url && d.image_url.trim().length > 0);
    const selectedItems =
      itemsWithImages.length > 0
        ? itemsWithImages
        : items.slice(0, 4); // Fallback to top items if no uploaded photo

    for (const d of selectedItems) {
      const url = d.image_url || getCategoryImage(d.name);
      list.push({
        id: d.id,
        imageUrl: url,
        title: d.name,
        price: d.offer_price ?? d.price,
        originalPrice: d.offer_price != null && d.offer_price < d.price ? d.price : null,
        vegType: d.veg_type,
        isCover: false,
      });
    }

    return list;
  }, [restaurant.banner_url, restaurant.image_url, restaurant.name, items]);

  // Keep index within bounds if slides change
  useEffect(() => {
    if (currentIndex >= slides.length) {
      setCurrentIndex(0);
    }
  }, [slides.length, currentIndex]);

  const isSwiping = useRef(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-advance every 3 seconds (3000ms)
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoSlideIntervalMs);

    return () => clearInterval(timer);
  }, [slides.length, isPaused, autoSlideIntervalMs]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  // Touch swipe support for mobile
  const handleTouchStart = (e: TouchEvent) => {
    isSwiping.current = false;
    setIsPaused(true);
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    if (touchStartX.current != null && Math.abs(touchStartX.current - touchEndX.current) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX.current != null && touchEndX.current != null) {
      const diff = touchStartX.current - touchEndX.current;
      if (Math.abs(diff) > 35) {
        if (diff > 0) {
          // Swiped left -> next slide
          setCurrentIndex((prev) => (prev + 1) % slides.length);
        } else {
          // Swiped right -> prev slide
          setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
        }
      }
    }
    touchStartX.current = null;
    touchEndX.current = null;

    // Resume auto-slide after brief pause
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIsPaused(false);
      isSwiping.current = false;
    }, 1000);
  };

  const activeSlide = slides[currentIndex] || slides[0];
  const fallbackCoverUrl = restaurant.banner_url || restaurant.image_url || hero;

  return (
    <div
      className="relative h-48 w-full overflow-hidden bg-muted/40 select-none group"
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
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClickCapture={(e) => {
        if (isSwiping.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {/* Slides with smooth crossfade and subtle Ken Burns zoom */}
      {slides.map((slide, idx) => {
        const isActive = idx === currentIndex;
        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
              isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
            }`}
          >
            <img
              src={slide.imageUrl}
              alt={slide.title}
              onError={(e) => {
                if (e.currentTarget.src !== fallbackCoverUrl) {
                  e.currentTarget.src = fallbackCoverUrl;
                }
              }}
              className={`h-full w-full object-cover transition-transform duration-1000 ease-out ${
                isActive ? "scale-100" : "scale-105"
              }`}
              width={1600}
              height={900}
              loading={idx === 0 ? "eager" : "lazy"}
            />
          </div>
        );
      })}

      {/* Ambient gradient overlay for text readability */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 via-black/35 to-transparent pointer-events-none z-20" />

      {/* Top Left: Open / Closed Badge */}
      <span
        className={`absolute left-3 top-3 z-30 rounded-full px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur-sm ${
          isOpen ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
        }`}
      >
        {isOpen ? "Open" : "Closed"}
      </span>

      {/* Top Right: Slide dots indicator & photo count */}
      {slides.length > 1 && (
        <div
          className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-full bg-black/55 backdrop-blur-md px-2.5 py-1 text-white shadow-sm border border-white/10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setCurrentIndex((prev) => (prev + 1) % slides.length);
          }}
          title="Click to next photo"
        >
          <div className="flex items-center gap-1">
            {slides.slice(0, 6).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-3.5 bg-primary" : "w-1.5 bg-white/60"
                }`}
              />
            ))}
            {slides.length > 6 && (
              <span className="text-[9px] font-bold text-white/80 ml-0.5">+{slides.length - 6}</span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Left: Item details badge when displaying a dish */}
      {activeSlide && !activeSlide.isCover && (
        <div className="absolute bottom-2.5 left-3 z-30 flex items-center gap-2 rounded-full bg-black/65 backdrop-blur-md pl-2 pr-3 py-1 text-white shadow-md border border-white/15 max-w-[calc(100%-110px)] animate-fadeIn">
          {/* Veg / Non-veg indicator dot */}
          <span
            className={`flex-shrink-0 grid h-3 w-3 place-items-center rounded-[3px] border ${
              activeSlide.vegType === "nonveg"
                ? "border-red-500 bg-white"
                : "border-emerald-600 bg-white"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                activeSlide.vegType === "nonveg" ? "bg-red-500" : "bg-emerald-600"
              }`}
            />
          </span>

          {/* Dish name */}
          <span className="truncate text-xs font-bold text-white tracking-tight">
            {activeSlide.title}
          </span>

          {/* Price */}
          {activeSlide.price != null && (
            <span className="flex-shrink-0 text-xs font-extrabold text-amber-300 ml-auto">
              ₹{activeSlide.price}
              {activeSlide.originalPrice && (
                <span className="text-[10px] text-white/60 line-through ml-1 font-normal">
                  ₹{activeSlide.originalPrice}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Bottom Left: Cover photo label when displaying restaurant cover */}
      {activeSlide && activeSlide.isCover && slides.length > 1 && (
        <div className="absolute bottom-2.5 left-3 z-30 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-medium text-white/90 shadow-sm border border-white/10">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>{slides.length - 1} Dishes with photos</span>
        </div>
      )}

      {/* Bottom Right: ETA badge */}
      <span className="absolute bottom-0 right-0 z-30 rounded-tl-2xl bg-card px-3 py-1.5 text-xs font-extrabold tracking-tight shadow-sm text-foreground">
        {etaLabel}
      </span>
    </div>
  );
}
