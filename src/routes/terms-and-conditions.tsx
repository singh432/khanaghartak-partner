import { createFileRoute } from "@tanstack/react-router";
import { SitePage, Section } from "@/components/SitePage";

const URL = "https://khanaghartak.in/terms-and-conditions";
const TITLE = "Terms & Conditions — KhanaGharTak";
const DESC =
  "The terms that apply when you order food, run a partner kitchen or deliver as a rider on KhanaGharTak.";

export const Route = createFileRoute("/terms-and-conditions")({
  component: TermsPage,
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

function TermsPage() {
  return (
    <SitePage eyebrow="Legal" title="Terms & Conditions" intro="By using KhanaGharTak you agree to the terms below.">
      <Section heading="Orders and pricing">
        <p>
          Menu prices are set by partner kitchens. Delivery is charged on a distance basis plus a fixed platform fee, and
          the full breakdown is shown at checkout before you confirm. Orders are binding once accepted by the kitchen.
        </p>
      </Section>
      <Section heading="Delivery">
        <p>
          Delivery times are estimates and may vary with weather, traffic and kitchen load. Please ensure someone is
          available at the delivery address with the correct payment for Cash on Delivery orders.
        </p>
      </Section>
      <Section heading="Cancellations and refunds">
        <p>
          You may cancel free of charge until the kitchen accepts your order. After preparation begins, cancellation may
          not be possible. Approved refunds are returned to the original payment method within 24 hours.
        </p>
      </Section>
      <Section heading="Partner kitchens and riders">
        <p>
          Kitchens and riders must be approved by KhanaGharTak before operating on the platform. Partners are responsible
          for food safety, hygiene standards and lawful operation, and may be suspended for violations.
        </p>
      </Section>
      <Section heading="Acceptable use">
        <p>
          Do not misuse the platform, place fraudulent orders, or abuse delivery staff. Accounts violating these terms may
          be suspended without notice.
        </p>
      </Section>
      <Section heading="Contact">
        <p>For any questions about these terms, email help@khanaghartak.in.</p>
      </Section>
    </SitePage>
  );
}
