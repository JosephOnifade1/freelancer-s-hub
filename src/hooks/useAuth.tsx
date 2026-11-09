import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { ensureUserProfile } from "../lib/users";

import { AuthContext, type AppUser } from "./auth-context";

function toAppUser(user: User | null): AppUser | null {
  if (!user) return null;
  return Object.assign(user, {
    uid: user.id,
    displayName: user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? null,
    photoURL: user.user_metadata?.avatar_url ?? null,
  }) as AppUser;
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUid = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const acceptSession = (session: { user: User } | null) => {
      if (!active) return;
      const nextUid = session?.user?.id ?? null;
      // Query results can contain members-only posts, private pipeline rows,
      // or account data. Never let a different viewer inherit a warm cache.
      if (lastUid.current !== undefined && lastUid.current !== nextUid) queryClient.clear();
      lastUid.current = nextUid;
      const appUser = toAppUser(session?.user ?? null);
      if (appUser) ensureUserProfile(appUser).catch(console.error);
      setUser(appUser);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      acceptSession(session);
    });
    // getSession may resolve after an auth event; don't overwrite the newer identity.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Could not restore session:", error);
      if (lastUid.current === undefined) acceptSession(data?.session ?? null);
    }).catch((error) => {
      console.error("Could not restore session:", error);
      if (lastUid.current === undefined) acceptSession(null);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

