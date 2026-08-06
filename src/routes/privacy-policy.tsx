import { createFileRoute } from "@tanstack/react-router";
import { SitePage, Section } from "@/components/SitePage";

const URL = "https://khanaghartak.in/privacy-policy";
const TITLE = "Privacy Policy — KhanaGharTak";
const DESC =
  "How KhanaGharTak collects, uses and protects your personal data, including location, contact details and order history.";

export const Route = createFileRoute("/privacy-policy")({
  component: PrivacyPage,
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

function PrivacyPage() {
  return (
    <SitePage eyebrow="Legal" title="Privacy Policy" intro="This policy explains what we collect and why.">
      <Section heading="Information we collect">
        <p>
          Account details you provide when signing in with Google (name, email, profile photo), your delivery address and
          phone number, your device location when you grant permission, and your order history.
        </p>
      </Section>
      <Section heading="How we use it">
        <p>
          To show kitchens near you, calculate delivery distance and fees, deliver your orders, send order updates over
          WhatsApp or email, and provide customer support.
        </p>
      </Section>
      <Section heading="Sharing">
        <p>
          We share only what is needed to complete a delivery: the restaurant sees your order, and the assigned rider sees
          your delivery address and phone number after accepting it. We never sell your data.
        </p>
      </Section>
      <Section heading="Data security and retention">
        <p>
          Data is stored on secured infrastructure with row-level access controls. Order records are kept for accounting
          and dispute resolution; you may request deletion of your account data at any time.
        </p>
      </Section>
      <Section heading="Your choices">
        <p>
          You can revoke location permission in your browser, update your address in the app, or email
          help@khanaghartak.in to access, correct or delete your data.
        </p>
      </Section>
      <Section heading="Contact">
        <p>Questions? Email help@khanaghartak.in or call +91 80092 53547.</p>
      </Section>
    </SitePage>
  );
}
