import { createFileRoute } from "@tanstack/react-router";
import { SitePage, Section } from "@/components/SitePage";

const URL = "https://khanaghartak.in/about";
const TITLE = "About KhanaGharTak — Local Food Delivery in Shankargarh";
const DESC =
  "KhanaGharTak delivers hot, home-style meals from trusted neighbourhood kitchens in Shankargarh with honest pricing and Cash on Delivery.";

export const Route = createFileRoute("/about")({
  component: AboutPage,
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
  }),
});

function AboutPage() {
  return (
    <SitePage
      eyebrow="About us"
      title="Food from your own neighbourhood."
      intro="KhanaGharTak connects hungry people with trusted home kitchens and local restaurants — hot, fresh and honestly priced."
    >
      <Section heading="What we do">
        <p>
          We work with small kitchens and neighbourhood restaurants so every meal is cooked after you order it — never
          reheated, never rushed. Local riders bring it to your door in about 35 minutes.
        </p>
      </Section>
      <Section heading="Honest pricing">
        <p>
          No surge pricing and no hidden packaging fees. Delivery is charged at a simple distance-based rate plus a small
          platform fee, and the full breakdown is shown before you pay. Cash on Delivery, UPI and cards are all accepted.
        </p>
      </Section>
      <Section heading="Partner with us">
        <p>
          Kitchens and delivery riders can join KhanaGharTak in minutes. Every partner is manually reviewed and approved
          before going live, so customers always order from verified kitchens.
        </p>
      </Section>
    </SitePage>
  );
}
