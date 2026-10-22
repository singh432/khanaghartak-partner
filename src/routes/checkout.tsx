import { createFileRoute } from "@tanstack/react-router";
import { UnifiedCartPage } from "./cart";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Checkout & Order — KhanaGharTak" },
      { name: "description", content: "Confirm your delivery details and place your Cash on Delivery order with KhanaGharTak." },
      { property: "og:title", content: "Checkout & Order — KhanaGharTak" },
      { property: "og:description", content: "Confirm your delivery details and place your Cash on Delivery order with KhanaGharTak." },
      { property: "og:url", content: "https://khanaghartak.in/checkout" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/checkout" }],
  }),
});

function CheckoutPage() {
  return <UnifiedCartPage />;
}
