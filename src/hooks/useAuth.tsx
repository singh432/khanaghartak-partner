import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/supabase-query";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isRider: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, isAdmin: false, isSuperAdmin: false, isRider: false, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isRider, setIsRider] = useState(false);

  useEffect(() => {
    let active = true;

    const loadRoles = async (userId: string) => {
      try {
        const [{ data }, { data: ownedRestaurant }] = await Promise.all([
          withTimeout(supabase.from("user_roles").select("role").eq("user_id", userId)),
          withTimeout(supabase.from("restaurants").select("id").eq("owner_id", userId).limit(1).maybeSingle()),
        ]);
        const roles = (data ?? []).map((r: any) => r.role);
        if (active) {
          setIsAdmin(roles.includes("restaurant_admin") || roles.includes("super_admin") || !!ownedRestaurant);
          setIsSuperAdmin(roles.includes("super_admin"));
          setIsRider(roles.includes("rider"));
        }
      } catch {
        if (active) { setIsAdmin(false); setIsSuperAdmin(false); setIsRider(false); }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setLoading(true);
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(async () => {
          await loadRoles(sess.user.id);
          if (active) setLoading(false);
        }, 0);
      } else {
        setIsAdmin(false); setIsSuperAdmin(false); setIsRider(false); setLoading(false);
      }
    });

    // Restoring the stored session can be slow (brokered preview storage), so retry
    // instead of treating a slow read as "signed out" — that is what forced re-login.
    const restore = async (attempt = 0): Promise<void> => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 15000);
        if (!active) return;
        if (data.session) {
          setSession(data.session);
          setUser(data.session.user);
          await loadRoles(data.session.user.id);
        } else if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600));
          return restore(attempt + 1);
        } else {
          setSession(null); setUser(null);
          setIsAdmin(false); setIsSuperAdmin(false); setIsRider(false);
        }
      } catch {
        if (!active) return;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 600));
          return restore(attempt + 1);
        }
        // Keep whatever session we already have; never force a sign-out on a slow read.
      }
    };

    restore().finally(() => { if (active) setLoading(false); });

    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); if (typeof window !== "undefined") window.location.assign("/"); };

  return (
    <Ctx.Provider value={{ user, session, loading, isAdmin, isSuperAdmin, isRider, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
