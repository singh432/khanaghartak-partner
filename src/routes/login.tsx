import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in — KhanaGharTak" },
      { name: "description", content: "Sign in to KhanaGharTak with Google and order home-style food with Cash on Delivery." },
      { property: "og:title", content: "Sign in — KhanaGharTak" },
      { property: "og:description", content: "Sign in to KhanaGharTak with Google and order home-style food with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/login" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in — KhanaGharTak" },
      { name: "twitter:description", content: "Sign in to KhanaGharTak with Google and order home-style food with Cash on Delivery." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

  const getAsParam = (): "admin" | "rider" | "user" => {
    if (typeof window === "undefined") return "user";
    const as = new URLSearchParams(window.location.search).get("as");
    if (as === "admin" || as === "rider") return as;
    return "user";
  };

  const getRedirectTarget = () => {
    const as = getAsParam();
    if (as === "admin") return isSuperAdmin ? "/super" : "/admin";
    if (as === "rider") return "/rider";
    return "/home";
  };

  useEffect(() => {
    if (!user || authLoading) return;
    navigate({ to: getRedirectTarget() as "/home" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, isSuperAdmin, navigate]);

  const onGoogle = async () => {
    setBusy(true);
    const as = getAsParam();
    const landing = as === "user" ? "/home" : `/login?as=${as}`;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${landing}`,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setBusy(false);
    }
  };

  const as = getAsParam();

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center px-6 py-10">
      <div className="text-center">
        <img src={khanaGharTakLogoUrl} alt="KhanaGharTak" width={112} height={112} className="mx-auto h-24 w-24 rounded-2xl object-contain" />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          {as === "admin" ? "Restaurant Admin Login" : as === "rider" ? "Rider Login" : "Welcome to KhanaGharTak"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {as === "admin" ? "Sign in to manage your restaurant." : as === "rider" ? "Sign in with your rider account." : "Jo Dil Chahe, Wahi Order Karo."}
        </p>
      </div>

      <button
        onClick={onGoogle}
        disabled={busy}
        className="mt-8 inline-flex h-[52px] w-full items-center justify-center rounded-2xl border border-border bg-card text-[15px] font-semibold shadow-sm disabled:opacity-70"
      >
        <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v2.7h6.4c-.3 1.6-2 4.6-6.4 4.6-3.9 0-7-3.2-7-7.2s3.1-7.2 7-7.2c2.2 0 3.7.9 4.6 1.7l3.1-3C17.7 1.4 15.1.3 12 .3 5.9.3 1 5.2 1 11.1S5.9 22 12 22c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.4-.2-2L12 11z"/></svg>
        {busy ? "Connecting…" : "Continue with Google"}
      </button>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        We only use your Google email to create your account. No password needed.
      </p>

      {as !== "user" ? (
        <button type="button" onClick={() => { window.location.href = "/login"; }}
          className="mt-8 text-center text-xs font-medium text-primary underline">
          ← Back to customer login
        </button>
      ) : (
        <>
          <p className="mt-10 text-center text-xs text-muted-foreground">
            Are you a restaurant owner?{" "}
            <button type="button" onClick={() => { window.location.href = "/login?as=admin"; }} className="font-medium underline">Open admin panel</button>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Delivery rider?{" "}
            <button type="button" onClick={() => { window.location.href = "/login?as=rider"; }} className="font-medium underline">Open rider panel</button>
          </p>
        </>
      )}
    </div>
  );
}
