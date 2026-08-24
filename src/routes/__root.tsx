import "@/lib/ssr-storage-polyfill";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { LocationGateProvider } from "@/hooks/useLocationGate";

import { BottomNav } from "@/components/BottomNav";
import { CartBar } from "@/components/CartBar";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";

import appCss from "../styles.css?url";
import { khanaGharTakLogoUrl } from "@/assets/brand";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#F45D2C" },
      { name: "google-site-verification", content: "SI5AbdXyWeB0NKsDLCW1ktx6X3sc0ZRRMflYPxFw3bI" },
      { title: "KhanaGharTak — Jo Dil Chahe, Wahi Order Karo" },
      { name: "description", content: "Order delicious home-style food from KhanaGharTak. Fast local delivery, Cash on Delivery." },
      { property: "og:title", content: "KhanaGharTak — Jo Dil Chahe, Wahi Order Karo" },
      { name: "twitter:title", content: "KhanaGharTak — Jo Dil Chahe, Wahi Order Karo" },
      { property: "og:description", content: "Order delicious home-style food from KhanaGharTak. Fast local delivery, Cash on Delivery." },
      { name: "twitter:description", content: "Order delicious home-style food from KhanaGharTak. Fast local delivery, Cash on Delivery." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/91b140d3-d27b-4b4b-9a74-f5b323a08933" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/91b140d3-d27b-4b4b-9a74-f5b323a08933" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: khanaGharTakLogoUrl },
      { rel: "shortcut icon", type: "image/png", href: khanaGharTakLogoUrl },
      { rel: "apple-touch-icon", href: khanaGharTakLogoUrl },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "KhanaGharTak",
          alternateName: "KhanaGharTak.in",
          description: "Order home-style food from trusted local kitchens and restaurants. Fast delivery, Cash on Delivery.",
          url: "https://khanaghartak.in",
          logo: "https://khanaghartak.in/__l5e/assets-v1/8863a66e-7115-4037-ab62-8765b7ae09f3/khanaghartak-logo.png",
          image: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/91b140d3-d27b-4b4b-9a74-f5b323a08933",
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+91-97117-20846",
            contactType: "customer support",
            availableLanguage: ["English", "Hindi"],
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "KhanaGharTak",
          url: "https://khanaghartak.in",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://khanaghartak.in/restaurants?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullWidth = pathname === "/";
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>
          <LocationGateProvider>
            {fullWidth ? (
              <main className="min-h-[100dvh] bg-background">
                <Outlet />
              </main>
            ) : (
              <main className="app-shell pb-16">
                <Outlet />
              </main>
            )}
            <CartBar />
            <BottomNav />
            <AnalyticsTracker />

            <Toaster position="top-center" richColors />
          </LocationGateProvider>
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
