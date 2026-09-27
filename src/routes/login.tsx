import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  ShieldAlert,
  LogOut,
  UtensilsCrossed,
  Bike,
  MapPin,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { khanaGharTakLogoUrl } from "@/assets/brand";
import { MobileLogin } from "@/components/MobileLogin";
import { EmailLogin } from "@/components/EmailLogin";
import { contextHome, getActiveContext, parseContext, setActiveContext, type ActiveContext } from "@/lib/active-role";
import { isCustomerApp, isPartnerApp, isNative } from "@/lib/capacitor";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: (search: Record<string, unknown>): { as?: ActiveContext } => {
    const as = parseContext(search.as);
    return as ? { as } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — KhanaGharTak" },
      { name: "description", content: "Sign in to KhanaGharTak with your mobile number and order home-style food with Cash on Delivery." },
      { property: "og:title", content: "Sign in — KhanaGharTak" },
      { property: "og:description", content: "Sign in to KhanaGharTak with your mobile number and order home-style food with Cash on Delivery." },
      { property: "og:url", content: "https://khanaghartak.in/login" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sign in — KhanaGharTak" },
      { name: "twitter:description", content: "Sign in to KhanaGharTak with your mobile number and order home-style food with Cash on Delivery." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://khanaghartak.in/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { as } = Route.useSearch();
  const {
    user,
    loading: authLoading,
    rolesLoaded,
    isZoneManager,
    isAdmin,
    isRider,
    primaryPartnerRole,
    signOut,
  } = useAuth();
  const [busy, setBusy] = useState(false);
  const [partnerSelectedRole, setPartnerSelectedRole] = useState<"restaurant" | "rider" | "manager" | null>(null);
  const [authMismatch, setAuthMismatch] = useState<{ selected: string; actual: string | null } | null>(null);
  const [mode, setMode] = useState<"choose" | "mobile" | "email">("choose");
  const [ctx, setCtx] = useState<ActiveContext>(() => isPartnerApp() ? "restaurant" : (as ?? "customer"));

  // Determine native app environment
  const customerApp = isCustomerApp();
  const partnerApp = isPartnerApp();

  // The entry point decides the active context — never role, phone or email.
  useEffect(() => {
    if (customerApp) {
      setActiveContext("customer");
      setCtx("customer");
      return;
    }
    if (partnerApp && (!as || as === "customer")) {
      setActiveContext("restaurant");
      setCtx("restaurant");
      return;
    }
    if (as) setActiveContext(as);
    setCtx(as ?? getActiveContext());
  }, [as, customerApp, partnerApp]);

  // Customer app or customer role is strictly mobile-only (no Google, no email)
  const isCustomerOnly = !partnerApp && (customerApp || ctx === "customer");

  useEffect(() => {
    if (!user || authLoading) return;

    if (partnerApp) {
      // In partner app, wait for roles to resolve before navigating
      if (!rolesLoaded) return;

      // If user selected a specific role in this session, strictly validate authorization
      if (partnerSelectedRole) {
        let authorized = false;
        let targetPath = "/admin";

        if (partnerSelectedRole === "restaurant") {
          authorized = isAdmin || primaryPartnerRole === "restaurant";
          targetPath = "/admin";
        } else if (partnerSelectedRole === "rider") {
          authorized = isRider || primaryPartnerRole === "rider";
          targetPath = "/rider";
        } else if (partnerSelectedRole === "manager") {
          authorized = isZoneManager || primaryPartnerRole === "zone_manager";
          targetPath = "/zone";
        }

        if (authorized) {
          navigate({ to: targetPath, replace: true });
        } else {
          // Selected role does NOT match authorized role:
          // Do not open the dashboard! Show a clear error and allow user to return and select the correct role.
          const actualRole =
            isZoneManager || primaryPartnerRole === "zone_manager"
              ? "Zone Manager"
              : isAdmin || primaryPartnerRole === "restaurant"
              ? "Restaurant Owner"
              : isRider || primaryPartnerRole === "rider"
              ? "Rider"
              : null;
          const selectedName =
            partnerSelectedRole === "restaurant"
              ? "Restaurant Owner"
              : partnerSelectedRole === "rider"
              ? "Rider"
              : "Zone Manager";

          setAuthMismatch({ selected: selectedName, actual: actualRole });
        }
        return;
      }

      // If opening app with an existing valid session directly (partnerSelectedRole is null):
      if (isZoneManager || primaryPartnerRole === "zone_manager") {
        navigate({ to: "/zone", replace: true });
      } else if (isAdmin || primaryPartnerRole === "restaurant") {
        navigate({ to: "/admin", replace: true });
      } else if (isRider || primaryPartnerRole === "rider") {
        navigate({ to: "/rider", replace: true });
      }
      return;
    }

    const targetCtx = customerApp ? "customer" : as ?? getActiveContext();
    const to = contextHome(targetCtx);
    navigate({ to: to as "/home", replace: true });
  }, [user, authLoading, rolesLoaded, isZoneManager, isAdmin, isRider, primaryPartnerRole, partnerSelectedRole, as, navigate, customerApp, partnerApp]);

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

  // If user is authenticated in Partner App but has NO partner role, show Access Restricted on pure white
  if (partnerApp && user && rolesLoaded && !isZoneManager && !isAdmin && !isRider) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col items-center justify-center bg-white px-6 py-10 text-center text-slate-900">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-red-50 text-red-600 border border-red-200">
          <ShieldAlert className="h-9 w-9" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Partner Access Required</h1>
        <p className="mt-2 text-sm text-slate-600">
          You are signed in as <strong className="text-slate-900">{user.phone || user.email || "this account"}</strong>, but this account does not have partner privileges (Zone Manager, Restaurant Owner, or Rider).
        </p>
        <div className="mt-6 w-full space-y-3">
          <button
            onClick={() => {
              setPartnerSelectedRole(null);
              void signOut();
            }}
            className="inline-flex h-[48px] w-full items-center justify-center rounded-2xl bg-[#F45D2C] text-sm font-bold text-white shadow-sm hover:bg-[#e04f20] transition-colors"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out & try another account
          </button>
          <p className="text-xs text-slate-500">
            Looking to order food? Please use the KhanaGharTak Customer App.
          </p>
        </div>
      </div>
    );
  }

  // If user authenticated for a selected role that they are NOT authorized for, show clear error and allow return
  if (partnerApp && authMismatch && user) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col items-center justify-center bg-white px-6 py-10 text-center text-slate-900">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <ShieldAlert className="h-9 w-9" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Role Authorization Required</h1>
        <p className="mt-2 text-sm text-slate-600">
          You selected <strong className="text-slate-900">{authMismatch.selected} Login</strong>, but your signed-in account (<strong className="text-slate-900">{user.phone || user.email}</strong>) is {authMismatch.actual ? (
            <>authorized as a <strong className="text-slate-900">{authMismatch.actual}</strong>.</>
          ) : (
            <>not registered with partner permissions.</>
          )}
        </p>
        <div className="mt-6 w-full space-y-3">
          {authMismatch.actual && (
            <button
              onClick={() => {
                const target = authMismatch.actual === "Zone Manager" ? "/zone" : authMismatch.actual === "Restaurant Owner" ? "/admin" : "/rider";
                setAuthMismatch(null);
                navigate({ to: target, replace: true });
              }}
              className="inline-flex h-[50px] w-full items-center justify-center rounded-2xl bg-[#F45D2C] text-sm font-bold text-white shadow-sm hover:bg-[#e04f20] transition-colors"
            >
              Open {authMismatch.actual} Dashboard
            </button>
          )}
          <button
            onClick={() => {
              setAuthMismatch(null);
              setPartnerSelectedRole(null);
              setMode("choose");
            }}
            className="inline-flex h-[50px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors"
          >
            ← Return to Role Selection
          </button>
          <button
            onClick={() => {
              setAuthMismatch(null);
              setPartnerSelectedRole(null);
              void signOut();
            }}
            className="inline-flex h-[44px] w-full items-center justify-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out & use another account
          </button>
        </div>
      </div>
    );
  }

  // While restoring session or redirecting authenticated users, show clean pure white splash screen
  if (authLoading || (user && (!partnerApp || !rolesLoaded))) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center">
        <img
          src={khanaGharTakLogoUrl}
          alt="KhanaGharTak"
          width={120}
          height={120}
          className="w-[50vw] max-w-[200px] h-auto aspect-square rounded-2xl object-contain animate-pulse"
        />
        <div className="mt-4 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // =========================================================================
  // PARTNER APP: 3-ROLE SELECTION VIEW (Completely WHITE background, no orange)
  // =========================================================================
  if (partnerApp && !partnerSelectedRole) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-white text-slate-900 select-none px-6 py-6">
        <div className="w-full max-w-[420px] flex flex-col items-center">
          {/* Upper: Genuine KhanaGharTak logo centered, preserving aspect ratio */}
          <div className="flex items-center justify-center w-full mb-3">
            <img
              id="partner-brand-logo"
              src={khanaGharTakLogoUrl}
              alt="KhanaGharTak"
              width={240}
              height={240}
              className="mx-auto w-[55vw] max-w-[220px] h-auto aspect-square rounded-3xl object-contain shadow-sm"
            />
          </div>

          <div className="text-center mb-4">
            <h2 className="text-lg font-extrabold text-slate-900 mb-0.5">Partner Sign In</h2>
            <p className="text-xs text-slate-500">Select your role to access dashboard & orders</p>
          </div>

          {/* 3 clean, clearly separated login buttons directly below logo */}
          <div className="w-full flex flex-col space-y-3">
            {/* 1. Restaurant Login */}
            <button
              type="button"
              onClick={() => {
                setActiveContext("restaurant");
                setCtx("restaurant");
                setMode("mobile");
                setPartnerSelectedRole("restaurant");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:bg-slate-50/80 active:scale-[0.98] transition-all flex items-center gap-3.5 text-left group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#F45D2C] border border-orange-100">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-slate-900 group-hover:text-slate-950">
                  Restaurant Login
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  Kitchen orders, menus & store status
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 shrink-0" />
            </button>

            {/* 2. Rider Login */}
            <button
              type="button"
              onClick={() => {
                setActiveContext("rider");
                setCtx("rider");
                setMode("mobile");
                setPartnerSelectedRole("rider");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:bg-slate-50/80 active:scale-[0.98] transition-all flex items-center gap-3.5 text-left group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <Bike className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-slate-900 group-hover:text-slate-950">
                  Rider Login
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  Deliver orders, go online & track earnings
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 shrink-0" />
            </button>

            {/* 3. Zone Manager Login */}
            <button
              type="button"
              onClick={() => {
                setActiveContext("manager");
                setCtx("manager");
                setMode("mobile");
                setPartnerSelectedRole("manager");
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 hover:bg-slate-50/80 active:scale-[0.98] transition-all flex items-center gap-3.5 text-left group"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                <MapPin className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-bold text-slate-900 group-hover:text-slate-950">
                  Zone Manager Login
                </div>
                <div className="text-xs text-slate-500 mt-0.5 truncate">
                  Delivery zones & live order operations
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 shrink-0" />
            </button>
          </div>

          <p className="text-center text-[11px] text-slate-400 pt-3 font-medium">
            KhanaGharTak Partner Network
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // PARTNER APP: SELECTED ROLE'S LOGIN VIEW (Completely WHITE background)
  // =========================================================================
  if (partnerApp && partnerSelectedRole) {
    const roleConfig = {
      restaurant: {
        title: "Restaurant Login",
        badge: "Restaurant Partner",
        desc: "Sign in to manage kitchen orders, menus & store status.",
        icon: UtensilsCrossed,
        badgeClass: "bg-orange-50 text-[#F45D2C] border-orange-200",
      },
      rider: {
        title: "Rider Login",
        badge: "Rider Partner",
        desc: "Sign in to deliver orders, receive alerts & track earnings.",
        icon: Bike,
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      },
      manager: {
        title: "Zone Manager Login",
        badge: "Zone Operations",
        desc: "Sign in to manage delivery zones & live dispatch operations.",
        icon: MapPin,
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      },
    }[partnerSelectedRole];

    const RoleIcon = roleConfig.icon;

    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center bg-white px-6 py-10 text-slate-900">
        {/* Back Button to return to Role Selection */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => {
              setPartnerSelectedRole(null);
              setMode("choose");
            }}
            className="inline-flex items-center text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Change Partner Role
          </button>
        </div>

        {/* Header */}
        <div className="text-left mb-6">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold mb-3 ${roleConfig.badgeClass}`}>
            <RoleIcon className="h-3.5 w-3.5" />
            <span>{roleConfig.badge}</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {roleConfig.title}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {roleConfig.desc}
          </p>
        </div>

        {/* Login Method: Choose or Mobile or Email */}
        {mode === "choose" ? (
          <div className="space-y-3">
            <button
              onClick={() => setMode("mobile")}
              className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#F45D2C] text-[15px] font-bold text-white shadow-sm hover:bg-[#e04f20] active:scale-[0.99] transition-all"
            >
              <Phone className="mr-2.5 h-5 w-5" />
              Continue with Mobile Number
            </button>

            <button
              onClick={onGoogle}
              disabled={busy}
              className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all disabled:opacity-70"
            >
              <svg className="mr-2.5 h-5 w-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v2.7h6.4c-.3 1.6-2 4.6-6.4 4.6-3.9 0-7-3.2-7-7.2s3.1-7.2 7-7.2c2.2 0 3.7.9 4.6 1.7l3.1-3C17.7 1.4 15.1.3 12 .3 5.9.3 1 5.2 1 11.1S5.9 22 12 22c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.4-.2-2L12 11z"/></svg>
              {busy ? "Connecting…" : "Continue with Google"}
            </button>

            <button
              onClick={() => setMode("email")}
              className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-[15px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.99] transition-all"
            >
              <Mail className="mr-2.5 h-5 w-5 text-slate-500" />
              Continue with Email
            </button>

            <p className="mt-4 text-center text-xs text-slate-500">
              Role permissions are automatically validated against your Supabase account.
            </p>
          </div>
        ) : mode === "mobile" ? (
          <MobileLogin onBack={() => setMode("choose")} backLabel="← Choose another login method" />
        ) : (
          <EmailLogin onBack={() => setMode("choose")} backLabel="← Choose another login method" />
        )}
      </div>
    );
  }

  // =========================================================================
  // CUSTOMER APP / CUSTOMER LOGIN: Top ~50% Logo, Immediately Below Enter Mobile Number
  // =========================================================================
  if (isCustomerOnly) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-white text-slate-900 select-none px-6 py-6">
        <div className="w-full max-w-[420px] flex flex-col items-center">
          {/* Upper ~50% of screen: Genuine KhanaGharTak logo prominently centered */}
          <div className="flex items-center justify-center w-full h-[45vh] max-h-[360px]">
            <img
              id="login-brand-logo"
              src={khanaGharTakLogoUrl}
              alt="KhanaGharTak"
              width={300}
              height={300}
              className="mx-auto w-auto h-auto max-h-full max-w-[270px] aspect-square rounded-3xl object-contain shadow-sm"
            />
          </div>

          {/* Immediately below the logo: Enter mobile number section (NOT pushed to bottom) */}
          <div className="w-full mt-3">
            <MobileLogin
              onBack={customerApp || partnerApp ? undefined : () => navigate({ to: "/" })}
              backLabel="← Back to home"
              className="space-y-3"
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // WEB PARTNER LOGIN (When visited via web browser without a role preset)
  // =========================================================================
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col justify-center px-6 py-10">
      <div className="text-center">
        <img
          id="login-brand-logo"
          src={khanaGharTakLogoUrl}
          alt="KhanaGharTak"
          width={120}
          height={120}
          className="mx-auto h-24 w-24 rounded-2xl object-contain"
        />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          How would you like to continue?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One login for restaurants, riders and zone managers.
        </p>
      </div>

      {mode === "choose" ? (
        /* Web Partner: Choose between Mobile Number & Email (and Google on web) */
        <div className="mt-8 space-y-3">
          <button
            onClick={() => setMode("mobile")}
            className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-soft)]"
          >
            <Phone className="mr-2.5 h-5 w-5" />
            Continue with Mobile Number
          </button>

          <button
            onClick={() => setMode("email")}
            className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl border border-border bg-card text-[15px] font-semibold shadow-sm hover:bg-secondary/50"
          >
            <Mail className="mr-2.5 h-5 w-5 text-muted-foreground" />
            Continue with Email
          </button>

          {!isNative && (
            <>
              <div className="my-2 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
              </div>

              <button
                onClick={onGoogle}
                disabled={busy}
                className="inline-flex h-[52px] w-full items-center justify-center rounded-2xl border border-border bg-card text-[15px] font-semibold shadow-sm disabled:opacity-70"
              >
                <svg className="mr-2.5 h-5 w-5" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 11v2.7h6.4c-.3 1.6-2 4.6-6.4 4.6-3.9 0-7-3.2-7-7.2s3.1-7.2 7-7.2c2.2 0 3.7.9 4.6 1.7l3.1-3C17.7 1.4 15.1.3 12 .3 5.9.3 1 5.2 1 11.1S5.9 22 12 22c6.9 0 11.5-4.8 11.5-11.7 0-.8-.1-1.4-.2-2L12 11z"/></svg>
                {busy ? "Connecting…" : "Continue with Google"}
              </button>
            </>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Restaurant, rider, and zone manager accounts automatically open their respective dashboards upon sign in.
          </p>
        </div>
      ) : mode === "mobile" ? (
        <MobileLogin onBack={() => setMode("choose")} />
      ) : (
        <EmailLogin onBack={() => setMode("choose")} />
      )}
    </div>
  );
}
