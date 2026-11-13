import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { provisionProfileOnServer } from "../lib/profile-provisioning";

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
    /**
     * Establish the viewer.
     *
     * Phase 2B.3: the profile now lives in Neon and is created by a server-side,
     * idempotent call. That call happens *here*, before `setUser`, so a session
     * is not reported as a signed-in user until their profile actually exists.
     * Reporting first and provisioning in the background would show a logged-in
     * shell around pages that cannot yet read a profile.
     *
     * `acceptSession` is the single funnel for every session — password sign-in,
     * the OAuth callback's session on first paint, and later token refreshes —
     * so there is one provisioning path, not one per entry point.
     */
    const acceptSession = async (session: { user: User } | null) => {
      if (!active) return;
      const nextUid = session?.user?.id ?? null;
      // Query results can contain members-only posts, private pipeline rows,
      // or account data. Never let a different viewer inherit a warm cache.
      if (lastUid.current !== undefined && lastUid.current !== nextUid) queryClient.clear();
      lastUid.current = nextUid;

      const appUser = toAppUser(session?.user ?? null);
      if (appUser) await provisionProfileOnServer();
      if (!active) return;

      setUser(appUser);
      setLoading(false);
    };

    // Never let a provisioning failure strand the app in `loading`: the session
    // is real even if the profile call failed, and the server routes surface
    // their own unavailable state.
    const accept = (session: { user: User } | null) => {
      acceptSession(session).catch((error) => {
        console.error("Profile provisioning failed:", error);
        if (!active) return;
        setUser(toAppUser(session?.user ?? null));
        setLoading(false);
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      accept(session);
    });
    // getSession may resolve after an auth event; don't overwrite the newer identity.
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Could not restore session:", error);
      if (lastUid.current === undefined) accept(data?.session ?? null);
    }).catch((error) => {
      console.error("Could not restore session:", error);
      if (lastUid.current === undefined) accept(null);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [queryClient]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      // Phase 1: drop the viewer and their cached rows *before* the caller
      // redirects.
      //  • `setUser(null)` — the SIGNED_OUT auth event usually arrives a tick
      //    later; until it does the header would still render the old identity.
      //    Clearing first means no stale authenticated UI is ever painted.
      //  • `queryClient.clear()` — the uid-change effect above only fires on the
      //    *next* session, so without this a shared device could briefly read
      //    the previous account's cached rows.
      // Both run even if `signOut` throws (e.g. offline), because the local
      // session must not survive a failed network call.
      setUser(null);
      lastUid.current = null;
      queryClient.clear();
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

