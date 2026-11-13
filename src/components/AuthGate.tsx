"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/auth-context";
import { loginPath } from "@/lib/return-path";

/**
 * Client-side route protection — the second of two layers (Phase 1.1).
 *
 * Phase 1 added this because no Next.js page was protected at all: `ProtectedRoute`
 * was wired only into the frozen Vite table, and with a browser-storage session a
 * server-side check would have seen no session and bounced signed-in users.
 *
 * Phase 1.1 moved the session into cookies readable by the server, and
 * `src/proxy.ts` now redirects anonymous requests for every protected path
 * *before* any HTML is produced. This component was **kept, not removed**, because
 * the proxy alone is not sufficient:
 *
 *  1. **Client-side transitions.** The proxy only runs on a real request. An
 *     already-loaded page navigating via `next/link` would render the private
 *     subtree first, then redirect. This component returns `null` instead, so
 *     private content never paints.
 *  2. **Demo mode.** `NEXT_PUBLIC_DEMO_MODE=true` runs the browser-local mock
 *     backend, which has no cookie session for the proxy to read. This guard is
 *     the only protection in that mode.
 *  3. **No duplicate work.** It reads the same `AuthProvider` state the rest of
 *     the UI uses — it does not fetch the session again.
 *
 * Behaviour
 *  - While the session is resolving, render nothing for protected content (no
 *    flash of protected UI, no flash of the login form).
 *  - Signed out → replace to `/login?from=<current path>`.
 *  - Signed in → render the children.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading || user) return;
    router.replace(loginPath(pathname));
  }, [loading, user, pathname, router]);

  // Session unknown → hold. This is what prevents protected content from
  // flashing before the redirect.
  if (loading) return null;
  // Redirecting → render nothing rather than the protected subtree.
  if (!user) return null;

  return <>{children}</>;
}
