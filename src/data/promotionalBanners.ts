import nainiLaunchBanner from "@/assets/banners/naini-launch.png";
import priceComparisonBanner from "@/assets/banners/price-comparison.png";

export interface PromotionalBanner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  altText: string;
  linkUrl?: string; // Optional target link if banner is tapped
  displayOrder: number;
  isActive: boolean;
  startDate?: string; // ISO string e.g. "2026-11-01T00:00:00Z" (optional)
  endDate?: string;   // ISO string e.g. "2026-11-30T23:59:59Z" (optional)
}

/**
 * Configurable list of promotional banners.
 * You can add, remove, reorder, or update dates and active status here
 * without modifying the carousel UI code.
 */
export const PROMOTIONAL_BANNERS: PromotionalBanner[] = [
  {
    id: "naini-launch",
    title: "KhanaGharTak Launches in Naini",
    subtitle: "We are launching in Naini from 5th November",
    imageUrl: nainiLaunchBanner,
    altText: "KhanaGharTak Launching in Naini from 5th November - Jo Dil Chahe, Wahi Order Karo",
    displayOrder: 1,
    isActive: true,
  },
  {
    id: "price-comparison",
    title: "Fair Pricing Guarantee",
    subtitle: "Other platforms 1.5X vs KhanaGharTak X",
    imageUrl: priceComparisonBanner,
    altText: "Price Comparison - Other platforms 1.5X vs KhanaGharTak X fair pricing",
    displayOrder: 2,
    isActive: true,
  },
];

/**
 * Returns currently active banners sorted by displayOrder,
 * respecting active status and optional start/end scheduling dates.
 */
export function getActivePromotionalBanners(referenceDate: Date = new Date()): PromotionalBanner[] {
  const refTime = referenceDate.getTime();

  return PROMOTIONAL_BANNERS
    .filter((banner) => {
      if (!banner.isActive) return false;

      if (banner.startDate) {
        const start = new Date(banner.startDate).getTime();
        if (!isNaN(start) && refTime < start) {
          return false;
        }
      }

      if (banner.endDate) {
        const end = new Date(banner.endDate).getTime();
        if (!isNaN(end) && refTime > end) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => a.displayOrder - b.displayOrder);
}
