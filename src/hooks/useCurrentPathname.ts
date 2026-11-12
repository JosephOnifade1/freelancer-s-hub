"use client";

import { usePathname } from "next/navigation";
import { useLocation } from "react-router-dom";

/**
 * Current pathname, resolved in both runtimes Borynx ships from one source tree.
 *
 * Phase 0.3 migration seam. Components migrated to native Next.js navigation need
 * the current path, but the Vite build (the rollback path) and Vitest render them
 * without an App Router context, where `usePathname()` returns `null` rather than
 * throwing.
 *
 *   • Next build   — `usePathname()` is populated. (`react-router-dom` is aliased to
 *                    `src/lib/navigation.tsx` there, whose `useLocation()` is itself
 *                    backed by `usePathname()`, so both branches agree.)
 *   • Vite / Vitest — `usePathname()` is `null`, so the real `react-router-dom`
 *                    location is used.
 *
 * This file is the ONLY place a migrated navigation component touches React
 * Router. When the Vite build is retired and the adapter is deleted (migration
 * step 7), delete the fallback here — the hook then collapses to `usePathname()`.
 */
export function useCurrentPathname(): string {
  const nextPathname = usePathname();
  const { pathname } = useLocation();
  return nextPathname || pathname || "/";
}
