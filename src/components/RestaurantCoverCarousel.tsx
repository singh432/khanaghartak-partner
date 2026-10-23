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
  etaLabel?: string;
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

      {/* Top Left: Open / Closed Badge matching website */}
      <span
        className={`absolute left-3 top-3 z-30 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${
          isOpen ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
        }`}
      >
        {isOpen ? "Open" : "Closed"}
      </span>

      {/* Bottom Center: Subtle slide dots indicator when multiple photos exist */}
      {slides.length > 1 && (
        <div className="absolute bottom-2.5 inset-x-0 z-30 flex items-center justify-center gap-1.5 pointer-events-none">
          {slides.slice(0, 6).map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 drop-shadow-md ${
                idx === currentIndex ? "w-3 bg-white" : "w-1.5 bg-white/70"
              }`}
            />
          ))}
        </div>
      )}

      {/* Bottom Right: Delivery Time (ETA) badge matching website exactly */}
      {etaLabel ? (
        <span className="absolute bottom-0 right-0 z-30 rounded-tl-2xl bg-card px-3 py-1.5 text-xs font-extrabold tracking-tight shadow-sm text-foreground">
          {etaLabel}
        </span>
      ) : null}
    </div>
  );
}
