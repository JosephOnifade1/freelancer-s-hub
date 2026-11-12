/**
 * LEGACY-BUILD SHIM — not used by the Next.js build.
 *
 * Phase 0.5 froze `src/App.tsx` + Vite as a rollback snapshot and made the App
 * Router the canonical runtime. Application code (views/components) now imports
 * navigation from `next/navigation` and `next/link` directly — no dual-runtime
 * abstraction in app code.
 *
 * The rollback snapshot still has to *run*, and it has no Next router. This file
 * is a thin implementation of the `next/navigation` surface on top of React
 * Router, wired in only when the legacy build compiles:
 *
 *   • `tsconfig.legacy.json` maps `next/navigation` → this file (typecheck/IDE)
 *   • `vite.config.ts` / `vitest.config.ts` alias it (bundle/test runtime)
 *
 * The Next.js build never resolves this file: `next.config.mjs` only aliases
 * `react-router-dom` → `src/lib/navigation.tsx`, never `next/*`. It exists so the
 * rollback snapshot keeps working, not as a navigation framework.
 *
 * Rule (Phase 0.5): do not add features here. If a new Next-native API is needed,
 * add only the signature the rollback snapshot actually calls.
 */
import { useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from "react-router-dom";

/** Mirrors `next/navigation`'s `usePathname()`. */
export function usePathname(): string {
  return useLocation().pathname;
}

export interface LegacyRouter {
  push: (href: string, options?: { scroll?: boolean }) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
  back: () => void;
  forward: () => void;
  refresh: () => void;
  prefetch: (href: string) => void;
}

/**
 * Mirrors `next/navigation`'s `useRouter()`.
 *
 * The returned object is memoised because it is a stable object in Next.js, and
 * views put `router` in effect dependency arrays.
 */
export function useRouter(): LegacyRouter {
  const navigate = useNavigate();
  return useMemo<LegacyRouter>(
    () => ({
      push: (href) => navigate(href),
      replace: (href) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      // The snapshot renders from an SPA cache; there is no server component
      // tree to refresh.
      refresh: () => {},
      prefetch: () => {},
    }),
    [navigate],
  );
}

/** Mirrors `next/navigation`'s `useParams()`. */
export function useParams<T extends Record<string, string | string[] | undefined>>(): T {
  return useRouterParams() as T;
}

/** Mirrors `next/navigation`'s `useSearchParams()` (read-only, no setter). */
export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}

/** Mirrors `next/navigation`'s `useSelectedLayoutSegment()`. */
export function useSelectedLayoutSegment(): string | null {
  const segments = useLocation().pathname.split("/").filter(Boolean);
  return segments[0] ?? null;
}
