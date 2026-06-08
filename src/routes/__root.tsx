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
import { BottomNav } from "@/components/BottomNav";

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
      { title: "KhanaGharTak — Ghar Jaisa Khana, Seedha Aapke Ghar Tak" },
      { name: "description", content: "Order delicious home-style food from KhanaGharTak. Fast local delivery, Cash on Delivery." },
      { property: "og:title", content: "KhanaGharTak — Ghar Jaisa Khana, Seedha Aapke Ghar Tak" },
      { name: "twitter:title", content: "KhanaGharTak — Ghar Jaisa Khana, Seedha Aapke Ghar Tak" },
      { property: "og:description", content: "Order delicious home-style food from KhanaGharTak. Fast local delivery, Cash on Delivery." },
      { name: "twitter:description", content: "Order delicious home-style food from KhanaGharTak. Fast local delivery, Cash on Delivery." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/91b140d3-d27b-4b4b-9a74-f5b323a08933" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/91b140d3-d27b-4b4b-9a74-f5b323a08933" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Hind:wght@400;500;600;700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Restaurant",
          name: "KhanaGharTak",
          description: "Home-style food delivered fast with Cash on Delivery.",
          servesCuisine: ["Indian", "Home-style"],
          url: "https://khanaghartak.lovable.app",
          image: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/91b140d3-d27b-4b4b-9a74-f5b323a08933",
          priceRange: "₹₹",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "KhanaGharTak",
          url: "https://khanaghartak.lovable.app",
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
          {fullWidth ? (
            <main className="min-h-[100dvh] bg-background">
              <Outlet />
            </main>
          ) : (
            <main className="app-shell pb-16">
              <Outlet />
            </main>
          )}
          <BottomNav />
          <Toaster position="top-center" richColors />
        </CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
