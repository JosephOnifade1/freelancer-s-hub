/**
 * Route access inventory (Phase 1.1).
 *
 * The single source of truth for which App Router URLs require a session. It is
 * imported by `src/proxy.ts` (request-level protection) and by the tests, so the
 * proxy's behaviour and the tested behaviour cannot drift apart.
 *
 * Derived from the real route tree in `src/app/**` and from the routes the legacy
 * Vite table (`src/App.tsx`) wraps in `ProtectedRoute` — not from guesswork. The
 * two must agree, otherwise one runtime protects a page the other exposes.
 *
 * Deliberately free of imports: it is evaluated in the proxy runtime and in
 * plain node tests.
 */

/**
 * URLs that require an authenticated session.
 *
 * Matched by exact path or by prefix (`/settings` also matches `/settings/…`).
 * Keep this list aligned with `src/app/**` — the inventory test fails if a gated
 * page drops out of it.
 */
export const PROTECTED_ROUTES = [
  "/onboarding",
  "/submit",
  "/pipeline",
  "/applications",
  "/notifications",
  "/admin",
  "/bookmarks",
  "/achievements",
  "/my-reports",
  "/settings",
  "/drafts",
  "/premium",
  "/l/post",
  "/f/me",
  "/following",
] as const;

/**
 * Public routes, listed explicitly rather than inferred.
 *
 * These must stay reachable while signed out: a redirect here would break the
 * login form itself, the marketing pages, or the public content that anonymous
 * visitors are meant to browse (Borynx is read-open — see the "browse without an
 * account" copy on the opportunities board).
 */
export const PUBLIC_ROUTES = [
  "/", // feed, including ?feed=following (filtered client-side)
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/new",
  "/popular",
  "/leaderboard",
  "/communities",
  "/pricing",
  "/status",
  "/privacy",
  "/terms",
  "/l", // opportunities board
  "/b",
  "/p",
  "/f",
  "/u",
] as const;

/**
 * Public *prefixes*: dynamic content routes that anonymous visitors may read.
 *
 * `/f/[handle]` and `/u/[username]` are public profiles; `/b/[slug]`,
 * `/b/[slug]/p/[id]` and `/p/[id]` are public posts and communities;
 * `/l/[leadId]` is a public opportunity; `/tag/[tagName]` is a public feed.
 *
 * Their *write* actions stay behind RLS and the sign-in CTAs — the page itself is
 * read-open by design.
 */
export const PUBLIC_PREFIXES = [
  "/b/",
  "/p/",
  "/f/",
  "/u/",
  "/l/",
  "/tag/",
] as const;

/** The auth flow's own routes — never a valid post-login destination. */
export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"] as const;

/** True when the path requires a session. */
export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * True when the path is explicitly readable without a session.
 *
 * Only used to document intent and to test the classification: the proxy works
 * by *protecting* the known-private list and leaving everything else alone, so an
 * unclassified new route is public (and therefore visible) rather than silently
 * broken. Adding a private page means adding it to `PROTECTED_ROUTES`.
 */
export function isPublicPath(pathname: string): boolean {
  if ((PUBLIC_ROUTES as readonly string[]).includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
