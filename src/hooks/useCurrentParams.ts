"use client";

import { useParams as useNextParams } from "next/navigation";
import { useParams as useRouterParams } from "react-router-dom";

/**
 * Route parameters, resolved in both runtimes Borynx ships from one source tree.
 *
 * Phase 0.4 migration seam (step 3 — `useParams` consumers). The views that use
 * this are consumed by BOTH the Next App Router pages and the Vite app, so
 * neither router's hook can be imported unconditionally:
 *
 *   • Next build    — `next/navigation`'s `useParams()` is populated.
 *   • Vite / Vitest — that returns `null`, so React Router's `useParams()` is used.
 *
 * Both return a plain `Record<string, string | undefined>`, and the dynamic
 * segment names are already identical in the two route tables:
 *   /b/[slug] → slug · /l/[leadId] → leadId · /p/[id] + /b/[slug]/p/[id] → id
 *   /tag/[tagName] → tagName · /f/[handle] → handle  (React Router: :username)
 *
 * `useParams()` is safe to call unconditionally in both runtimes: React Router
 * returns `{}` outside a Router (it does not throw, unlike `useLocation`).
 *
 * MIGRATION-ONLY. When the Vite build is retired (migration step 7), delete the
 * React Router branch and import `useParams` from `next/navigation` directly.
 */
export function useCurrentParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): Partial<T> {
  const nextParams = useNextParams();
  const routerParams = useRouterParams();
  const merged = (nextParams ?? routerParams ?? {}) as Partial<T>;
  return merged;
}
