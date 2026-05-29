import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { withTimeout } from "@/lib/supabase-query";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({
  user: null, session: null, loading: true, isAdmin: false, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAdminRole = async (userId: string) => {
      try {
        const { data } = await withTimeout(
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "restaurant_admin")
            .maybeSingle(),
        );
        if (active) setIsAdmin(!!data);
      } catch {
        if (active) setIsAdmin(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer DB check to avoid deadlock inside the auth callback
        setTimeout(() => loadAdminRole(sess.user.id), 0);
      } else {
        setIsAdmin(false);
      }
    });

    withTimeout(supabase.auth.getSession(), 8000)
      .then(async ({ data }) => {
        if (!active) return;
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          await loadAdminRole(data.session.user.id);
        } else {
          setIsAdmin(false);
        }
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
        setIsAdmin(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
