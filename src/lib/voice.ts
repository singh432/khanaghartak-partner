// Small speech helper for order updates (Web Speech API, best-effort).
export function speak(text: string, lang = "en-IN") {
  try {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1;
    u.pitch = 1;
    synth.cancel();
    synth.speak(u);
  } catch {
    /* speech is optional */
  }
}

export const ORDER_VOICE: Record<string, string> = {
  pending: "Your order has been placed successfully. Thank you for ordering with Khana Ghar Tak.",
  accepted: "Good news! The restaurant has accepted your order.",
  preparing: "Your food is being prepared.",
  ready: "Your order is ready and waiting for pickup.",
  picked_up: "Your order has been picked up and is on the way.",
  out_for_delivery: "Your order is out for delivery.",
  delivered: "Your order has been delivered. Enjoy your meal!",
  cancelled: "Your order has been cancelled.",
};
