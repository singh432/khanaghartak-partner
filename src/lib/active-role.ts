/**
 * ACTIVE CONTEXT (mode) — separate from user identity and from available roles.
 *
 * The active context is chosen ONLY by the entry point the person clicked
 * ("Order Food Now" / "Restaurant Login" / "Rider Login"). It is never derived
 * from email, phone, city, location, active/inactive status or previous role.
 * The same account can switch context freely by using another entry point.
 */
export type ActiveContext = "customer" | "restaurant" | "rider" | "manager" | "super";

const KEY = "kgt-active-context";

const VALID: ActiveContext[] = ["customer", "restaurant", "rider", "manager", "super"];

export function parseContext(value: unknown): ActiveContext | null {
  return typeof value === "string" && (VALID as string[]).includes(value)
    ? (value as ActiveContext)
    : null;
}

export function setActiveContext(ctx: ActiveContext) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(KEY, ctx); } catch { /* ignore */ }
}

export function getActiveContext(): ActiveContext {
  if (typeof window === "undefined") return "customer";
  try { return parseContext(window.localStorage.getItem(KEY)) ?? "customer"; } catch { return "customer"; }
}

/** Where an entry point should land after a successful sign-in. */
export function contextHome(ctx: ActiveContext): string {
  return ctx === "restaurant" ? "/admin" : ctx === "rider" ? "/rider" : ctx === "manager" ? "/zone" : ctx === "super" ? "/super" : "/home";
}
