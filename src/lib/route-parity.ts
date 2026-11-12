/**
 * Route parity inventory (Phase 0.2).
 *
 * The Vite app routes with `react-router-dom` (`src/App.tsx`); the Next.js app
 * routes with the App Router (`src/app/**\/page.tsx`). Both must expose the same
 * URLs, otherwise a link that works in one build 404s in the other.
 *
 * This module is the single source of truth used by the route-parity test. It is
 * intentionally a plain list — regenerating it is a deliberate act, so a new
 * App Router page without a matching entry is caught in review.
 */

/** Every App Router URL, with dynamic segments written as `[param]`. */
export const APP_ROUTES = [
  "/",
  "/login",
  "/signup",
  "/communities",
  "/new",
  "/popular",
  "/leaderboard",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/submit",
  "/onboarding",
  "/settings",
  "/pipeline",
  "/applications",
  "/notifications",
  "/bookmarks",
  "/achievements",
  "/my-reports",
  "/drafts",
  "/admin",
  // Phase 0.5: legacy SPA routes that had no App Router equivalent (404 on Next).
  "/pricing",
  "/status",
  "/premium",
  "/u/[username]",
  "/tag/[tagName]",
  "/b/[slug]",
  "/b/[slug]/p/[id]",
  "/p/[id]",
  "/f/[handle]",
  "/f/me",
  "/l",
  "/l/post",
  "/l/[leadId]",
  // Redirect-only aliases from src/App.tsx
  "/b",
  "/p",
  "/f",
  "/u",
  "/following",
] as const;

/**
 * Redirect-only paths: they rendered `<Navigate>` in `src/App.tsx` and now have
 * a thin App Router page (`src/lib/redirect-to.tsx`) that forwards the same way.
 * Kept here so a test can prove both builds redirect identically.
 */
export const REDIRECT_ROUTES: { path: string; redirectsTo: string }[] = [
  { path: "/b", redirectsTo: "/communities" },
  { path: "/p", redirectsTo: "/" },
  { path: "/f", redirectsTo: "/" },
  { path: "/u", redirectsTo: "/" },
  { path: "/following", redirectsTo: "/?feed=following" },
];

const compiled = APP_ROUTES.map((route) => ({
  route,
  pattern: new RegExp(
    "^" + route.replace(/\[[^\]]+\]/g, "[^/]+").replace(/\//g, "\\/") + "$"
  ),
}));

/** True when `pathname` matches an App Router page. */
export function matchesAppRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return compiled.some(({ pattern }) => pattern.test(normalized));
}
