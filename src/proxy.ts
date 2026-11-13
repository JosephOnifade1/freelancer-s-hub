import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseCredentials } from "@/lib/supabase-env";
import { isProtectedPath } from "@/lib/route-access";
import { loginPath, sanitizeReturnPath } from "@/lib/return-path";

/**
 * Request-level session handling (Phase 1.1).
 *
 * Next.js 16 renamed the `middleware` convention to `proxy` (the old filename is
 * deprecated and emits a build warning), so this lives in `src/proxy.ts`.
 *
 * Two jobs, in this order:
 *
 *  1. **Refresh the session.** Read the cookie session and, if the access token
 *     has expired, rotate it and write the new cookies onto the response. Without
 *     this, a signed-in user whose access token expired would be treated as
 *     anonymous by the server, and the browser would silently diverge. This is
 *     the phase's "no duplicate competing session sources" requirement: the
 *     cookies are the only session store, and this is the only thing that renews
 *     them.
 *
 *  2. **Gate the known-private routes.** A request for a protected path with no
 *     verified user is redirected to `/login?from=<path>`. The matcher below is
 *     narrow on purpose: static assets, images and API routes are never
 *     intercepted, and public pages are never protected.
 *
 * Layering: this is the first line, not the only line. `AuthGate` still guards
 * the same routes in the browser, because a proxy redirect alone cannot stop a
 * client-side transition from rendering a private subtree before the redirect
 * lands — and because demo mode (browser-local mock backend) has no cookie
 * session for the proxy to see.
 */

/**
 * Matcher: session refresh needs to run wherever cookies can change, but must
 * skip static assets. `/_next/static`, `/_next/image`, `favicon.ico` and files
 * with an extension are excluded.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|woff|woff2|ttf|otf)$).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const credentials = getSupabaseCredentials();

  // Unconfigured or demo mode: no cookie session exists to refresh or verify, so
  // the proxy must not interfere. `AuthGate` remains the sole guard there.
  if (!credentials) return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  // Start from a response we can attach rotated cookies to. For a redirect we
  // replace this object below, carrying the cookies across.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(credentials.url, credentials.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        // Mirror the new cookies onto the request so downstream Server
        // Components in *this* request see the refreshed session, then onto the
        // response so the browser persists them.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getUser()` verifies the JWT with Supabase; `getSession()` would only read
  // the cookie and trust it. It also triggers the refresh above when needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    // Preserve the full destination (path + query) through the existing,
    // already-validated `?from=` contract — no second validation system.
    const destination = sanitizeReturnPath(`${pathname}${search}`, "/");
    const redirectUrl = request.nextUrl.clone();
    const [redirectPath, redirectQuery] = loginPath(destination).split("?");
    redirectUrl.pathname = redirectPath;
    redirectUrl.search = redirectQuery ? `?${redirectQuery}` : "";

    const redirect = NextResponse.redirect(redirectUrl);
    // Carry any rotated cookies so a signed-out visitor with a stale cookie does
    // not keep re-presenting it on every hop (redirect-loop guard).
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  }

  return response;
}
