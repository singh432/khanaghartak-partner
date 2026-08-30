// Small speech helper for order updates (Web Speech API, best-effort).
// Browsers only allow speech after a user gesture, so we "prime" the engine
// inside a click handler and replay the queued line once it is unlocked.

let primed = false;
let pending: { text: string; lang: string } | null = null;

function synth(): SpeechSynthesis | null {
  try {
    if (typeof window === "undefined") return null;
    return window.speechSynthesis ?? null;
  } catch {
    return null;
  }
}

/** Call inside a click/tap handler to unlock speech for later announcements. */
export function primeVoice() {
  const s = synth();
  if (!s) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    s.speak(u);
    s.resume();
    primed = true;
    if (pending) {
      const p = pending;
      pending = null;
      setTimeout(() => speak(p.text, p.lang), 300);
    }
  } catch {
    /* speech is optional */
  }
}

export function speak(text: string, lang = "en-IN") {
  const s = synth();
  if (!s) return;
  if (!primed) {
    // Remember it; it will play as soon as the user interacts.
    pending = { text, lang };
  }
  const run = (retries = 6) => {
    try {
      const voices = s.getVoices();
      if (!voices.length && retries > 0) {
        setTimeout(() => run(retries - 1), 250);
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = 1;
      u.pitch = 1;
      const match =
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang?.startsWith("en"));
      if (match) u.voice = match;
      s.cancel();
      s.speak(u);
      s.resume();
      pending = null;
    } catch {
      /* speech is optional */
    }
  };
  run();
}

export const ORDER_VOICE: Record<string, string> = {
  placed: "Your order has been placed successfully. Thank you for ordering with Khana Ghar Tak.",
  pending: "Your order has been placed successfully. Thank you for ordering with Khana Ghar Tak.",
  accepted: "Good news! The restaurant has accepted your order.",
  preparing: "Your food is being prepared.",
  ready: "Your order is ready and waiting for pickup.",
  picked_up: "Your order has been picked up and is on the way.",
  out_for_delivery: "Your order is out for delivery.",
  delivered: "Your order has been delivered. Enjoy your meal!",
  cancelled: "Your order has been cancelled.",
};
