import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { MobileLogin } from "@/components/MobileLogin";
import { contextHome, getActiveContext, parseContext, setActiveContext, type ActiveContext } from "@/lib/active-role";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): { as?: ActiveContext } => {
    const as = parseContext(search.as);
    return as ? { as } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — KhanaGharTak" },
      { name: "description", content: "Sign in to KhanaGharTak with Google or your mobile number and order home-style food with Cash on Delivery." },
      { property: "og:title", content: "Sign in — KhanaGharTak" },
      { property: "og:description", content: "Sign in to KhanaGharTak with Google or your mobile number and order home-style food with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/login" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in — KhanaGharTak" },
      { name: "twitter:description", content: "Sign in to KhanaGharTak with Google or your mobile number and order home-style food with Cash on Delivery." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { as } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"choose" | "mobile">("choose");
  const [ctx, setCtx] = useState<ActiveContext>(as ?? "customer");

  // The entry point decides the active context — never role, phone or email.
  useEffect(() => {
    if (as) setActiveContext(as);
    setCtx(as ?? getActiveContext());
  }, [as]);

  // Customers sign in with their mobile number only; partners may use either.
  const mobileOnly = ctx === "customer";

  useEffect(() => {
    if (!user || authLoading) return;
    const to = contextHome(as ?? getActiveContext());
    navigate({ to: to as "/home", replace: true });
  }, [user, authLoading, as, navigate]);


  const onGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/login`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="text-center">
        <img src={khanaGharTakLogoUrl} alt="KhanaGharTak" width={112} height={112} className="mx-auto h-24 w-24 rounded-2xl object-contain" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          {mobileOnly ? "Sign in with your mobile number" : "How would you like to continue?"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mobileOnly
            ? "We'll send you a one-time code by SMS. No password needed."
            : "One login for restaurants, riders and zone managers."}
        </p>
      </div>

      {mobileOnly ? (
        <MobileLogin onBack={() => navigate({ to: "/" })} backLabel="← Back to home" />
      ) : mode === "choose" ? (
        <>
          <button
            onClick={onGoogle}
            disabled={busy}
            className="mt-8 inline-flex h-[52px] w-full items-center justify-center rounded-2xl border border-border bg-card text-[15px] font-semibold shadow-sm disabled:opacity-70"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v2.7h6.4c-.3 1.6-2 4.6-6.4 4.6-3.9 0-7-3.2-7-7.2s3.1-7.2 7-7.2c2.2 0 3.7.9 4.6 1.7l3.1-3C17.7 1.4 15.1.3 12 .3 5.9.3 1 5.2 1 11.1S5.9 22 12 22c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.4-.2-2L12 11z"/></svg>
            {busy ? "Connecting…" : "Continue with Google"}
          </button>

          <div className="my-4 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={() => setMode("mobile")}
            className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            <Phone className="mr-2 h-5 w-5" />
            Continue with Mobile Number
          </button>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            No password needed. Restaurant, rider and zone manager accounts open their own dashboard automatically after sign in.
          </p>
        </>
      ) : (
        <MobileLogin onBack={() => setMode("choose")} />
      )}

    </div>
  );
}
