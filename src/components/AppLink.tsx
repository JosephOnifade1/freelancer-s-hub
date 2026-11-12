"use client";

import NextLink from "next/link";
import { Link as RouterLink } from "react-router-dom";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Internal link that behaves natively in both builds Borynx ships from one tree.
 *
 * Why this exists (Phase 0.3 finding): `next/link` renders a plain anchor
 * everywhere, but its click handler bails out unless an App Router context is
 * present (`if (!router) return`). In the Vite build there is no Next router, so
 * every migrated link fell through to a FULL PAGE RELOAD instead of React
 * Router's client-side navigation — content still resolved (Vite serves the SPA
 * shell for every path) but state, scroll position and in-flight queries were
 * lost on each click.
 *
 *   • Next build   — renders `next/link`: client-side navigation + prefetch.
 *   • Vite / Vitest — renders React Router's `Link`: the original SPA behaviour.
 *
 * `usePathname()` is the runtime discriminator: it returns a path inside the App
 * Router and `null` without that context. It is a plain context read, called
 * unconditionally, so hook order is stable. Every view is mounted with
 * `dynamic(..., { ssr: false })`, so this never renders on a server and cannot
 * cause a hydration divergence.
 *
 * Migration step 7 (retire Vite): delete the React Router branch and the import.
 */
export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  children?: ReactNode;
}

export const AppLink = forwardRef<HTMLAnchorElement, AppLinkProps>(
  ({ href, replace, scroll, prefetch, children, ...rest }, ref) => {
    const isAppRouter = usePathname() !== null;

    if (isAppRouter) {
      return (
        <NextLink
          ref={ref}
          href={href}
          replace={replace}
          scroll={scroll}
          prefetch={prefetch}
          {...rest}
        >
          {children}
        </NextLink>
      );
    }

    return (
      <RouterLink ref={ref} to={href} {...rest}>
        {children}
      </RouterLink>
    );
  },
);

AppLink.displayName = "AppLink";
