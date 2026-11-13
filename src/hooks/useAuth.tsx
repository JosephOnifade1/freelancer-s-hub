import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { provisionProfileOnServer } from "../lib/profile-provisioning";
import {
  INITIAL_PROVISIONING,
  nextProvisioningState,
  shouldAttemptAutomatically,
  type ProvisioningState,
} from "../lib/provisioning-state";

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
  const [provisioning, setProvisioning] = useState<ProvisioningState>(INITIAL_PROVISIONING);
  const queryClient = useQueryClient();

  const lastUid = useRef<string | null | undefined>(undefined);
  /**
   * State is mirrored into a ref because the auth listeners are installed once,
   * inside an effect, and would otherwise close over the first render's values
   * forever. Reading `provisioningRef.current` gives the policy the *current*
   * state without re-subscribing (which would drop auth events).
   */
  const provisioningRef = useRef<ProvisioningState>(INITIAL_PROVISIONING);
  /** De-duplicates concurrent attempts for one identity (requirement 6). */
  const inFlight = useRef<AbortController | null>(null);
  const lastAttemptAt = useRef<number | undefined>(undefined);

  const commitProvisioning = useCallback((next: ProvisioningState) => {
    provisioningRef.current = next;
    setProvisioning(next);
  }, []);

  /** Cancels any in-flight attempt and forgets its bookkeeping. */
  const resetProvisioning = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    lastAttemptAt.current = undefined;
    commitProvisioning({ status: "pending", attempts: 0 });
  }, [commitProvisioning]);

  /**
   * Runs one provisioning attempt and records the outcome.
   *
   * Every exit path through this function records a terminal state, so the UI
   * can never be left waiting on a request that already finished. It returns
   * nothing meaningful on purpose: callers act on the state, not a value, which
   * is what keeps "signed in" and "profile ready" from being conflated again.
   */
  const attemptProvisioning = useCallback(
    async (uid: string) => {
      if (inFlight.current) return; // one attempt per identity, always

      const controller = new AbortController();
      inFlight.current = controller;
      lastAttemptAt.current = Date.now();

      let outcome: Awaited<ReturnType<typeof provisionProfileOnServer>>;
      try {
        outcome = await provisionProfileOnServer({ signal: controller.signal });
      } finally {
        // Only clear if this attempt still owns the slot; a newer attempt that
        // replaced it must not be cancelled by this one finishing.
        if (inFlight.current === controller) inFlight.current = null;
      }

      // A superseded attempt does not get to write state. Without this, a slow
      // response from a previous identity (or a request aborted by logout) could
      // mark the *current* user provisioned.
      if (lastUid.current !== uid) return;

      const next = nextProvisioningState(provisioningRef.current, outcome);
      commitProvisioning(next);

      if (next.status === "ready") {
        // The provisioned profile unlocks queries that were waiting on it.
        queryClient.invalidateQueries();
      }
    },
    [commitProvisioning, queryClient],
  );

  useEffect(() => {
    let active = true;

    /**
     * Establish the viewer.
     *
     * Two independent facts are resolved here, and resolving them separately is
     * the substance of Phase 2B.4:
     *
     *  1. **Session** (`user`, `loading`) — owned by Supabase Auth.
     *  2. **Profile** (`provisioning`) — owned by Neon, created by an idempotent
     *     server call.
     *
     * Phase 2B.3 awaited (2) before publishing (1), so a Neon outage made a valid
     * session look provisional. Now (1) is published as soon as it is known and
     * (2) proceeds alongside it, which is what lets the UI say "signed in, profile
     * not ready" instead of bouncing to /login. A provisioning failure can no
     * longer reach `setUser(null)`; nothing in this function does.
     *
     * `acceptSession` remains the single funnel for every session — password
     * sign-in, the OAuth callback's session on first paint, and token refreshes.
     */
    const acceptSession = (session: { user: User } | null) => {
      if (!active) return;

      const nextUid = session?.user?.id ?? null;
      const identityChanged = lastUid.current !== nextUid;

      if (identityChanged) {
        // Query results can contain members-only posts, private pipeline rows,
        // or account data. Never let a different viewer inherit a warm cache.
        if (lastUid.current !== undefined) queryClient.clear();
        // A different user (or a sign-out) must not inherit the previous
        // identity's provisioning attempt or its attempt budget.
        resetProvisioning();
        lastUid.current = nextUid;
      }

      // Publish the session immediately. Nothing below can un-publish it.
      setUser(toAppUser(session?.user ?? null));
      setLoading(false);

      if (!nextUid) return;

      if (provisioningRef.current.status === "ready") return;

      // An identical identity re-announcing itself (Supabase emits several
      // events for one sign-in: INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED)
      // must not start a second request. The budget and cooldown live in
      // `shouldAttemptAutomatically` so the policy is testable on its own.
      if (!shouldAttemptAutomatically(provisioningRef.current, lastAttemptAt.current, Date.now())) {
        return;
      }

      void attemptProvisioning(nextUid);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      acceptSession(session);
    });

    // getSession may resolve after an auth event; don't overwrite the newer identity.
    // Kept as a single call expression on purpose: `phase1.1-session-architecture`
    // asserts that every `getSession()` reader is a known module on the one shared
    // client, and that invariant is easier to audit when the call is not split.
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) console.error("Could not restore session:", error);
        if (lastUid.current === undefined) acceptSession(data?.session ?? null);
      })
      .catch((error) => {
        console.error("Could not restore session:", error);
        if (lastUid.current === undefined) acceptSession(null);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
      // Cancel an outstanding request on unmount: its result would be applied to
      // a provider that no longer exists.
      inFlight.current?.abort();
      inFlight.current = null;
    };
  }, [attemptProvisioning, commitProvisioning, queryClient, resetProvisioning]);

  /**
   * Manual retry.
   *
   * Deliberately ignores the automatic-attempt budget: the budget exists to stop
   * *unsupervised* loops, not to refuse an explicit user action. It still cannot
   * create concurrency, because `attemptProvisioning` returns early while a
   * request is in flight.
   */
  const retryProvisioning = useCallback(() => {
    const uid = lastUid.current;
    if (!uid) return;
    if (provisioningRef.current.status === "ready") return;
    if (inFlight.current) return;
    void attemptProvisioning(uid);
  }, [attemptProvisioning]);

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
      //  • provisioning state is dropped too (Phase 2B.4): the next account on
      //    this device must start from a clean attempt budget, and an in-flight
      //    request for the departing user must not land afterwards.
      // All of this runs even if `signOut` throws (e.g. offline), because the
      // local session must not survive a failed network call.
      setUser(null);
      lastUid.current = null;
      queryClient.clear();
      resetProvisioning();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signOut,
        provisioning,
        retryProvisioning,
        isProvisioned: provisioning.status === "ready",
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
