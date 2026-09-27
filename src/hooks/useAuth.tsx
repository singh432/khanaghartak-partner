import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/supabase-query";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoaded: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRider: boolean;
  isZoneManager: boolean;
  primaryPartnerRole: "zone_manager" | "restaurant" | "rider" | null;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  rolesLoaded: false,
  isAdmin: false,
  isSuperAdmin: false,
  isRider: false,
  isZoneManager: false,
  primaryPartnerRole: null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isRider, setIsRider] = useState(false);
  const [isZoneManager, setIsZoneManager] = useState(false);
  const [primaryPartnerRole, setPrimaryPartnerRole] = useState<"zone_manager" | "restaurant" | "rider" | null>(null);
  const explicitSignOutRef = useRef(false);

  useEffect(() => {
    let active = true;

    const loadRoles = async (userId: string) => {
      try {
        const [{ data }, { data: ownedRestaurant }, { data: zoneManagerRow }] = await Promise.all([
          withTimeout(supabase.from("user_roles").select("role").eq("user_id", userId)),
          withTimeout(supabase.from("restaurants").select("id").eq("owner_id", userId).limit(1).maybeSingle()),
          withTimeout(supabase.from("zone_managers").select("id, zone_id").eq("user_id", userId).limit(1).maybeSingle()),
        ]);
        const roles = (data ?? []).map((r: any) => r.role);
        const hasZoneManager = roles.includes("zone_manager") || !!zoneManagerRow;
        const hasAdmin = roles.includes("restaurant_admin") || roles.includes("super_admin") || !!ownedRestaurant;
        const hasSuper = roles.includes("super_admin");
        const hasRider = roles.includes("rider");

        let primary: "zone_manager" | "restaurant" | "rider" | null = null;
        if (hasZoneManager) primary = "zone_manager";
        else if (hasAdmin) primary = "restaurant";
        else if (hasRider) primary = "rider";

        if (active) {
          setIsAdmin(hasAdmin);
          setIsSuperAdmin(hasSuper);
          setIsRider(hasRider);
          setIsZoneManager(hasZoneManager);
          setPrimaryPartnerRole(primary);
          setRolesLoaded(true);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsRider(false);
          setIsZoneManager(false);
          setPrimaryPartnerRole(null);
          setRolesLoaded(true);
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      // Only an explicit logout ends the session. A transient SIGNED_OUT (e.g. a failed
      // token refresh after the phone suspended the tab) must not log the user out.
      if (!sess && event === "SIGNED_OUT" && !explicitSignOutRef.current) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        try {
          localStorage.setItem("kgt:has-session", "true");
        } catch {}
        if (active) setLoading(false);
        setTimeout(async () => {
          await loadRoles(sess.user.id);
        }, 0);
      } else {
        try {
          localStorage.removeItem("kgt:has-session");
        } catch {}
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsRider(false);
        setIsZoneManager(false);
        setPrimaryPartnerRole(null);
        setRolesLoaded(true);
        if (active) setLoading(false);
      }
    });

    const hasStoredToken = () => {
      if (typeof window === "undefined") return false;
      try {
        if (localStorage.getItem("kgt:has-session") === "true") return true;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || "";
          if (key.includes("-auth-token")) return true;
        }
      } catch {}
      return false;
    };

    // Restoring the stored session immediately from local Supabase cache.
    // Unblocks loading immediately so the user doesn't wait on background role queries.
    const restore = async (attempt = 0): Promise<void> => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 15000);
        if (!active) return;
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          try {
            localStorage.setItem("kgt:has-session", "true");
          } catch {}
          if (active) setLoading(false);
          // Load roles asynchronously in background without blocking UI
          void loadRoles(data.session.user.id);
          return;
        }

        // If there was a cached token but getSession hasn't loaded it yet, retry once
        if (attempt < 1 && hasStoredToken()) {
          await new Promise((r) => setTimeout(r, 400));
          return restore(attempt + 1);
        }

        setSession(null);
        setUser(null);
        try {
          localStorage.removeItem("kgt:has-session");
        } catch {}
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsRider(false);
        setIsZoneManager(false);
        setPrimaryPartnerRole(null);
        setRolesLoaded(true);
        if (active) setLoading(false);
      } catch {
        if (!active) return;
        if (attempt < 1 && hasStoredToken()) {
          await new Promise((r) => setTimeout(r, 400));
          return restore(attempt + 1);
        }
        if (active) setLoading(false);
      }
    };

    restore().finally(() => { if (active) setLoading(false); });

    // Phones freeze background tabs, so the access token can expire while the app is
    // hidden. Re-read/refresh the stored session when the user comes back.
    const revive = async () => {
      if (explicitSignOutRef.current) return;
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 15000);
        if (!active || !data.session) return;
        setSession(data.session);
        setUser(data.session.user);
      } catch { /* keep current session */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void revive(); };
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", revive);
      window.addEventListener("pageshow", revive);
    }

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("focus", revive);
        window.removeEventListener("pageshow", revive);
      }
    };
  }, []);

  const signOut = async () => {
    explicitSignOutRef.current = true;
    try {
      localStorage.removeItem("kgt:has-session");
    } catch {}
    // 'local' keeps other devices signed in; only this device's session ends.
    await supabase.auth.signOut({ scope: "local" });
    if (typeof window !== "undefined") {
      const isCustomer = navigator.userAgent.includes("KhanaGharTakCustomerApp");
      const isPartner = navigator.userAgent.includes("KhanaGharTakPartnerApp");
      window.location.assign(isCustomer || isPartner ? "/login" : "/");
    }
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        rolesLoaded,
        isAdmin,
        isSuperAdmin,
        isRider,
        isZoneManager,
        primaryPartnerRole,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
