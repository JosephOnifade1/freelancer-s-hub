import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { getSupabaseCredentials } from "./supabase-env";

/**
 * Server-side Supabase access (Phase 1.1).
 *
 * Server Components, route handlers and server actions use this to read the
 * authenticated identity from the request's cookies. The browser client
 * (`@/lib/supabase`) writes those cookies; this reads and refreshes them.
 *
 * `setAll` is wrapped in a try/catch on purpose: Server Components cannot mutate
 * cookies, and `@supabase/ssr` documents that the failure is expected there.
 * Token refresh in Server Components is therefore best-effort — the durable
 * refresh happens in `src/proxy.ts`, which can write cookies to the response.
 *
 * No service-role key is read or used anywhere. Everything here runs with the
 * anon key plus the user's own session, so RLS still applies.
 *
 * This module imports `next/headers`, which throws outside a request scope — that
 * is the guard that keeps it out of client bundles (a `server-only` import was
 * avoided rather than adding a dependency for it).
 */

/** The current request's Supabase client, or `null` when Supabase is unconfigured. */
export async function createSupabaseServerClient() {
  const credentials = getSupabaseCredentials();
  if (!credentials) return null;

  const cookieStore = await cookies();

  return createServerClient(credentials.url, credentials.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // proxy.ts refreshes the session and writes the rotated cookies.
        }
      },
    },
  });
}

/**
 * The authenticated user for this request, or `null`.
 *
 * `getUser()` (not `getSession()`) is the correct server-side call: it verifies
 * the JWT with Supabase Auth instead of trusting cookie contents.
 */
export async function getServerUser(): Promise<User | null> {
  try {
    const client = await createSupabaseServerClient();
    if (!client) return null;
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data.user ?? null;
  } catch (error) {
    // A transient failure must not crash a page render; callers treat this as
    // "no verified session" and fall back to the client guard.
    console.error("Could not read the server session:", error);
    return null;
  }
}
