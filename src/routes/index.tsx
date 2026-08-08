import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { useAuth } from "@/hooks/useAuth";
import {
  UtensilsCrossed,
  ChefHat,
  Bike,
  ShieldCheck,
  MapPin,
  Wallet,
  Clock,
  ArrowRight,
  Menu as MenuIcon,
  X,
  Flame,
  Leaf,
  BadgePercent,
  HeartHandshake,
  Phone,

} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "KhanaGharTak — Jo Dil Chahe, Wahi Order Karo" },
      { name: "description", content: "Order home-style food from trusted local kitchens. Fast delivery, Cash on Delivery, hot and fresh — every single meal." },
      { property: "og:title", content: "KhanaGharTak — Jo Dil Chahe, Wahi Order Karo" },
      { property: "og:description", content: "Order home-style food from trusted local kitchens. Fast delivery, Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "KhanaGharTak — Jo Dil Chahe, Wahi Order Karo" },
      { name: "twitter:description", content: "Order home-style food from trusted local kitchens. Fast delivery, Cash on Delivery." },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/" }],
  }),
});

type CtaTarget = "user" | "admin" | "rider";

function loginHref(as: CtaTarget) {
  return as === "user" ? "/login" : `/login?as=${as}`;
}

function Landing() {
  const { user, loading, isAdmin, isRider, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Already signed in? Keep them signed in and send them straight to their area.
  useEffect(() => {
    if (loading || !user) return;
    const to = isSuperAdmin ? "/super" : isAdmin ? "/admin" : isRider ? "/rider" : "/home";
    navigate({ to: to as "/home", replace: true });
  }, [loading, user, isAdmin, isRider, isSuperAdmin, navigate]);

  const navLinks: Array<{ label: string; href: string; primary?: boolean }> = [
    { label: "Order Food", href: user ? "/home" : loginHref("user"), primary: true },
    { label: "Restaurant Login", href: isAdmin ? "/admin" : loginHref("admin") },
    { label: "Rider Login", href: isRider ? "/rider" : loginHref("rider") },
    { label: "Help", href: "#help" },
  ];


  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-8 md:py-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={khanaGharTakLogoUrl} alt="KhanaGharTak" className="h-10 w-10 rounded-xl object-contain md:h-11 md:w-11" />
            <div className="leading-tight">
              <p className="font-display text-base md:text-lg">KhanaGharTak</p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:block">Jo Dil Chahe, Wahi Order Karo</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1.5 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className={
                  l.primary
                    ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.66_0.21_35/0.6)] transition hover:translate-y-[-1px]"
                    : "rounded-full px-4 py-2.5 text-sm font-semibold text-foreground/80 transition hover:bg-secondary hover:text-foreground"
                }
              >
                {l.label}
                {l.primary && <ArrowRight className="h-4 w-4" />}
              </a>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card md:hidden"
            aria-label="Open menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t bg-background md:hidden">
            <div className="flex flex-col gap-1 px-4 py-3">
              {navLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className={
                    l.primary
                      ? "flex items-center justify-between rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
                      : "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-foreground/80 hover:bg-secondary"
                  }
                >
                  {l.label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 -right-32 h-[480px] w-[480px] rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute top-40 -left-40 h-[420px] w-[420px] rounded-full bg-accent/40 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:gap-16 md:px-8 md:py-28">
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Now serving your neighbourhood
            </span>

            <h1 className="font-display mt-5 text-4xl leading-[1] tracking-tight md:text-5xl lg:text-6xl">
              Jo Dil Chahe,<br />
              <span className="text-primary">Wahi Order Karo.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              KhanaGharTak connects you with trusted home kitchens and neighbourhood restaurants.
              Hot, fresh, hand-made meals at honest prices — delivered by your local riders.
              Cash on Delivery, no surge pricing, no nonsense.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={user ? "/home" : loginHref("user")}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-bold text-primary-foreground shadow-[0_12px_32px_-10px_oklch(0.66_0.21_35/0.7)] transition hover:translate-y-[-1px]"
              >
                Order Food Now <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-4 text-base font-bold text-foreground transition hover:bg-secondary"
              >
                How it works
              </a>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              <Stat k="35 min" v="Avg delivery" />
              <Stat k="100%" v="COD ready" />
              <Stat k="₹0" v="Hidden charges" />
            </dl>
          </div>

          {/* Hero visual — clean brand card */}
          <div className="relative mx-auto w-full max-w-md md:max-w-none">
            <div className="absolute inset-0 -z-10 translate-x-6 translate-y-6 rounded-3xl bg-primary/15" />
            <div className="rounded-3xl border bg-card p-8 shadow-[var(--shadow-card)]">
              <div className="flex flex-col items-center text-center">
                <img src={khanaGharTakLogoUrl} alt="" className="h-24 w-24 rounded-3xl object-contain" />
                <p className="font-display mt-5 text-2xl leading-tight">Fresh. Local. Hot.</p>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  Meals cooked to order by kitchens in your neighbourhood — never reheated, never rushed.
                </p>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-muted-foreground">
                <Pill icon={Clock} label="35 min" />
                <Pill icon={Wallet} label="COD" />
                <Pill icon={MapPin} label="Local" />
              </div>
            </div>

            <div className="absolute -bottom-6 -right-2 hidden rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-soft)] md:flex md:items-center md:gap-3">
              <ShieldCheck className="h-5 w-5 text-success" />
              <div className="text-xs">
                <p className="font-bold">Verified kitchens</p>
                <p className="text-muted-foreground">FSSAI · Hygiene checked</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ WHY US ============ */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Why KhanaGharTak</p>
          <h2 className="font-display mt-3 text-4xl leading-tight tracking-tight md:text-5xl">
            Built for hungry people, not hype.
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Everything we do is designed around one thing — getting you a great meal, fast, without the usual delivery-app tricks.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-6">
          <Feature icon={Flame} title="Hot & fresh guarantee" body="Riders carry insulated bags so your biryani, rotis, and gravies land steaming — not lukewarm." />
          <Feature icon={BadgePercent} title="Honest, upfront prices" body="No surge pricing, no sneaky packaging fees. What you see at checkout is what you pay at the door." />
          <Feature icon={Wallet} title="Cash, UPI, or online" body="Pay however you like — Cash on Delivery, UPI, or card. Refunds land back in the same account in 24 hours." />
          <Feature icon={Leaf} title="Pure-veg & Jain filters" body="Strict veg households can lock the whole app to pure-veg kitchens. Jain-friendly menus flagged clearly." />
          <Feature icon={HeartHandshake} title="Support local kitchens" body="Every order feeds a small kitchen or home chef in your own neighbourhood — not a faceless cloud brand." />
          <Feature icon={Phone} title="Real human support" body="Stuck? Missing item? WhatsApp or call a real person, not a bot. Replies in minutes, not days." />
        </div>

      </section>



      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="border-y border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">How it works</p>
            <h2 className="font-display mt-3 text-4xl leading-tight tracking-tight md:text-6xl">
              Three steps. One hot meal.
            </h2>
            <p className="mt-4 text-base text-muted-foreground md:text-lg">
              From your phone to your plate in about thirty-five minutes. No phone calls, no awkward menus, no surprises at the door.
            </p>
          </div>

          <ol className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3 md:gap-8">
            <Step
              n="01"
              icon={UtensilsCrossed}
              title="Pick your meal"
              body="Browse today's thalis, tiffins, and full menus from kitchens around you. Filter by veg, jain, or budget."
            />
            <Step
              n="02"
              icon={ChefHat}
              title="We cook it fresh"
              body="Your order pings the kitchen instantly. Every dish is hand-prepared after you tap order — never reheated."
            />
            <Step
              n="03"
              icon={Bike}
              title="Rider drops it hot"
              body="A nearby rider picks it up and brings it straight to your door. Pay cash, UPI, or wallet on arrival."
            />
          </ol>
        </div>
      </section>

      {/* ============ JOIN US ============ */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <JoinCard
            badge="For kitchens"
            title="Run a kitchen? Sell on KhanaGharTak."
            body="Onboard in minutes. Manage your menu, orders, and payouts from one clean dashboard. Get reviewed by a super admin and go live the same day."
            cta="Restaurant Login"
            href={isAdmin ? "/admin" : loginHref("admin")}
            icon={ChefHat}
          />
          <JoinCard
            badge="For riders"
            title="Ride with us. Earn per delivery."
            body="Flexible hours, daily payouts, and a clean rider panel with live pickup, drop, and Google Maps navigation. Apply once, approved by admin, start earning."
            cta="Rider Login"
            href={isRider ? "/rider" : loginHref("rider")}
            icon={Bike}
          />
        </div>
      </section>

      {/* ============ HELP ============ */}
      <section id="help" className="border-t border-border/60 bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
          <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Need a hand?</p>
              <h2 className="font-display mt-3 text-4xl leading-tight tracking-tight md:text-5xl">
                We're here to help.
              </h2>
              <p className="mt-4 max-w-md text-base text-muted-foreground">
                Have a question about your order, kitchen onboarding, or rider partnership? Reach out — a real human will get back to you.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <a href="mailto:help@khanaghartak.in" className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Email us</p>
                <p className="font-display mt-2 text-lg break-all">help@khanaghartak.in</p>
                <p className="mt-1 text-xs text-muted-foreground">Replies within 24 hours</p>
              </a>
              <a href="tel:+918009253547" className="group rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Call us</p>
                <p className="font-display mt-2 text-lg">+91 80092 53547</p>
                <p className="mt-1 text-xs text-muted-foreground">Mon – Sun · 9am to 10pm</p>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t bg-foreground text-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="flex items-center gap-3">
            <img src={khanaGharTakLogoUrl} alt="" className="h-10 w-10 rounded-xl bg-background object-contain p-1" />
            <div>
              <p className="font-display text-lg">KhanaGharTak</p>
              <p className="text-xs text-background/60">Jo dil chahe, wahi order karo.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <a href={user ? "/home" : loginHref("user")} className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">Order food</a>
            <a href={isAdmin ? "/admin" : loginHref("admin")} className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">Restaurant</a>
            <a href={isRider ? "/rider" : loginHref("rider")} className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">Rider</a>
            <a href="#help" className="rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground">Help</a>
          </div>
        </div>
        <div className="border-t border-background/10">
          <p className="mx-auto max-w-7xl px-4 py-4 text-center text-[11px] text-background/50 md:px-8">
            © {new Date().getFullYear()} KhanaGharTak. Made with love in your neighbourhood.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-display text-2xl md:text-3xl">{k}</dt>
      <dd className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{v}</dd>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-full bg-secondary py-2">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <li className="group relative rounded-3xl border bg-card p-7 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="font-display text-5xl text-primary/20">{n}</span>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
      </div>
      <h3 className="font-display mt-6 text-2xl leading-tight">{title}</h3>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </li>
  );
}

function Feature({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-3xl border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-display mt-5 text-xl leading-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function JoinCard({
  badge,
  title,
  body,
  cta,
  href,
  icon: Icon,
}: {
  badge: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border bg-card p-8 md:p-10">
      <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-foreground text-background">
            <Icon className="h-6 w-6" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">{badge}</span>
        </div>
        <h3 className="font-display mt-6 text-3xl leading-tight md:text-4xl">{title}</h3>
        <p className="mt-3 max-w-md text-sm text-muted-foreground md:text-base">{body}</p>
        <a
          href={href}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-[0_10px_28px_-10px_oklch(0.66_0.21_35/0.6)] transition hover:translate-y-[-1px]"
        >
          {cta} <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </article>
  );
}
