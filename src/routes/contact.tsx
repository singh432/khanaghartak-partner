import { createFileRoute } from "@tanstack/react-router";
import { SitePage, Section } from "@/components/SitePage";

const URL = "https://khanaghartak.in/contact";
const TITLE = "Contact KhanaGharTak — Support, Partners & Riders";
const DESC =
  "Get in touch with KhanaGharTak. Email help@khanaghartak.in or call +91 80092 53547 for order help, restaurant onboarding or rider partnerships.";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "KhanaGharTak",
          url: "https://khanaghartak.in",
          email: "help@khanaghartak.in",
          telephone: "+91-80092-53547",
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "help@khanaghartak.in",
              telephone: "+91-80092-53547",
              availableLanguage: ["en", "hi"],
            },
          ],
        }),
      },
    ],
  }),
});

function ContactPage() {
  return (
    <SitePage
      eyebrow="Need a hand?"
      title="We're here to help."
      intro="Questions about an order, kitchen onboarding or rider partnership? A real person will get back to you."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <a href="mailto:help@khanaghartak.in" className="rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Email us</p>
          <p className="font-display mt-2 break-all text-lg text-foreground">help@khanaghartak.in</p>
          <p className="mt-1 text-xs">Replies within 24 hours</p>
        </a>
        <a href="tel:+918009253547" className="rounded-2xl border bg-card p-6 transition hover:-translate-y-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Call us</p>
          <p className="font-display mt-2 text-lg text-foreground">+91 80092 53547</p>
          <p className="mt-1 text-xs">Mon – Sun · 9am to 10pm</p>
        </a>
      </div>
      <Section heading="Service area">
        <p>KhanaGharTak currently delivers in and around Shankargarh, Prayagraj, Uttar Pradesh.</p>
      </Section>
    </SitePage>
  );
}
