import { redirect } from "next/navigation";
import { loginPath } from "./return-path";
import { getServerUser } from "./supabase-server";
import { isSupabaseConfigured } from "./supabase-env";

/**
 * Server-side session helpers for private route pages (Phase 1.2).
 *
 * This is the one place a *route page* resolves identity on the server. It adds
 * no new session mechanism: it wraps `getServerUser()` from
 * `src/lib/supabase-server.ts`, which reads the `@supabase/ssr` cookies and
 * verifies them with `auth.getUser()`. There is deliberately no second way to
 * obtain a server user — everything server-side funnels through here.
 *
 * Identity vs application data
 * ----------------------------
 * Everything this module returns comes from Supabase Auth: who the user *is*.
 * It never reads the `profiles` table or any other application data. That keeps
 * the future boundary clean:
 *
 *     Supabase Auth  →  authenticated user id  →  application data (later Neon + Drizzle)
 *
 * A page resolves identity here, then hands the id to whatever reads application
 * data. Nothing couples the two stores together.
 */

export interface ServerSession {
  /** Supabase Auth user id — the identity that future data lookups will key on. */
  uid: string;
  email: string | null;
  /** `email_confirmed_at` from Supabase Auth, surfaced for the account UI. */
  emailConfirmedAt: string | null;
}

/**
 * Resolves the authenticated identity for a private page, or `null`.
 *
 * Returns `null` in two distinct situations, and callers must tell them apart:
 *  - Supabase is not configured (demo mode / unconfigured build) — there is no
 *    cookie session to read, so the client guard remains authoritative.
 *  - A configured request with no verified user — a real anonymous request.
 *
 * Use `hasServerAuth()` for the redirect decision rather than `session === null`,
 * so demo mode is not redirected into a login form that cannot work.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const user = await getServerUser();
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    emailConfirmedAt: user.email_confirmed_at ?? null,
  };
}

/**
 * Whether this request can be authenticated on the server at all.
 *
 * False when Supabase is unconfigured or running in demo mode (the mock backend
 * keeps its session in localStorage, which the server can never see).
 */
export function hasServerAuth(): boolean {
  return isSupabaseConfigured;
}

/**
 * Enforces server-side access for a private route page.
 *
 * Returns the session when a verified user exists. Otherwise redirects to
 * `/login?from=<current path>` — the same contract, validator and shape the
 * proxy and `AuthGate` already use, so there is one redirect mechanism in the
 * app, not three.
 *
 * The redirect is a `307` from the render phase: no private markup is produced.
 */
export async function requireServerSession(currentPath: string): Promise<ServerSession> {
  const session = await getServerSession();
  if (session) return session;
  redirect(loginPath(currentPath));
}
