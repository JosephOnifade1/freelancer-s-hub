import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

import type { ProvisioningState } from "@/lib/provisioning-state";

// Extend User to expose `uid` as an alias for `id`, and add Firebase-compatible fields,
// so existing code that references user.uid, user.displayName, user.photoURL, and user.email
// continues to work without modification.
export type AppUser = User & {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;

  /**
   * Whether the application profile exists in Neon (Phase 2B.4).
   *
   * `loading` answers "is the session known?"; `provisioning` answers "is the
   * profile ready?". They are separate on purpose: a visitor can be
   * `loading: false, user: <AppUser>, provisioning: failed` — signed in, with a
   * valid session, whose profile simply does not exist yet. Treating that as
   * signed-out is the bug this phase fixes.
   */
  provisioning: ProvisioningState;

  /**
   * Manual retry for a failed provisioning attempt.
   *
   * Safe to call at any time; it is a no-op while `ready` and de-duplicated
   * while a request is already in flight. This is the controlled retry the
   * brief requires — there is no hidden automatic loop beyond the small budget
   * in `provisioning-state.ts`.
   */
  retryProvisioning: () => void;

  /**
   * True once the session is known *and* the profile exists.
   *
   * Use this — not `user` alone — to decide whether to render something that
   * genuinely needs a profile row (username, bio, reputation). Ordinary
   * authenticated screens should keep using `user`.
   */
  isProvisioned: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  provisioning: { status: "pending", attempts: 0 },
  retryProvisioning: () => {},
  isProvisioned: false,
});

export const useAuth = (): AuthContextType => useContext(AuthContext);
