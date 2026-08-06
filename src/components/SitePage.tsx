import { Link } from "@tanstack/react-router";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import type { ReactNode } from "react";

export function SitePage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={khanaGharTakLogoUrl} alt="KhanaGharTak" className="h-10 w-10 rounded-xl object-contain" />
            <span className="font-display text-base md:text-lg">KhanaGharTak</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <Link to="/restaurants" className="rounded-full px-3 py-2 hover:bg-secondary">Restaurants</Link>
            <Link to="/about" className="hidden rounded-full px-3 py-2 hover:bg-secondary sm:inline-flex">About</Link>
            <Link to="/contact" className="rounded-full bg-primary px-4 py-2 text-primary-foreground">Contact</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h1 className="font-display mt-3 text-4xl leading-tight tracking-tight md:text-5xl">{title}</h1>
        {intro && <p className="mt-4 text-base text-muted-foreground md:text-lg">{intro}</p>}
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-muted-foreground md:text-base">{children}</div>
      </main>

      <footer className="border-t bg-foreground text-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-8 md:px-8">
          <p className="text-sm">© {new Date().getFullYear()} KhanaGharTak</p>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link to="/about" className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">About</Link>
            <Link to="/contact" className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">Contact</Link>
            <Link to="/privacy-policy" className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">Privacy</Link>
            <Link to="/terms-and-conditions" className="rounded-full bg-background/10 px-4 py-2 font-semibold hover:bg-background/20">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl leading-tight text-foreground">{heading}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
