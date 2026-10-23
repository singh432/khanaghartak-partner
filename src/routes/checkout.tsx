import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { CartPage } from "./cart";

export const Route = createFileRoute("/checkout")({
  component: CheckoutRedirect,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { title: "Cart & Order — KhanaGharTak" },
    ],
  }),
});

function CheckoutRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/cart", replace: true });
  }, [navigate]);

  return <CartPage />;
}
