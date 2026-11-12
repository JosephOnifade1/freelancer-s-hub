"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/auth-context";
import { loginPath } from "@/lib/return-path";

/**
 * Route protection for the App Router.
 *
 * Phase 1 finding: before this component, **no Next.js page was protected**.
 * `ProtectedRoute` was only wired into the frozen Vite `App.tsx` route table, so
 * on the canonical runtime every route rendered openly — a real regression
 * introduced when the App Router pages were first created, not a design choice.
 *
 * Chosen over middleware deliberately: this app keeps its session in browser
 * storage via the Supabase JS client (there is no `@supabase/ssr` cookie client),
 * so a `proxy.ts`/middleware check would see no session and bounce every signed-in
 * user to `/login`. Middleware becomes the right answer once sessions move to
 * cookies in a later phase.
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
