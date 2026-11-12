"use client";

import { AppLink as Link } from "@/components/AppLink";
import { useCurrentPathname } from "@/hooks/useCurrentPathname";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { isNavLinkActive } from "@/lib/nav-link-active";

/**
 * Native link with React Router `NavLink`-style active styling.
 *
 * Phase 0.3: this previously delegated to the React Router compatibility adapter
 * purely to obtain `isActive`. Active state is now computed here from the
 * dual-runtime pathname, so the component no longer needs the adapter's `NavLink`.
 *
 * Two behaviour decisions:
 *   1. Matching requires a segment boundary, so `/new` no longer claims
 *      `/newsletter`; `/` only ever matches exactly. `end` forces an exact match.
 *   2. `className` is resolved to a plain STRING before reaching the DOM — it is
 *      never handed to a parent that could stringify a render prop (the Phase 0.2
 *      bug that left every sidebar item unstyled).
 *
 * `to` and `state` remain accepted so existing call sites keep working while they
 * are migrated.
 */
export interface NavLinkCompatProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className"> {
  /** React Router style target. Prefer `href` in new code. */
  to?: string;
  href?: string;
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string | undefined);
  activeClassName?: string;
  pendingClassName?: string;
  /** When true the link is active only on an exact pathname match. */
  end?: boolean;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  (
    {
      to,
      href,
      className,
      activeClassName,
      pendingClassName,
      end,
      replace,
      scroll,
      prefetch,
      children,
      ...props
    },
    ref,
  ) => {
    // Dual-runtime read: `usePathname()` in Next, React Router's location in
    // Vite/Vitest. See `useCurrentPathname`.
    const pathname = useCurrentPathname();
    const target = href ?? to ?? "/";
    const isActive = isNavLinkActive(pathname, target, end);
    const navProps = { isActive, isPending: false };

    const baseClass = typeof className === "function" ? className(navProps) : className;
    const classes = [baseClass, isActive && activeClassName, navProps.isPending && pendingClassName]
      .filter(Boolean)
      .join(" ");

    return (
      <Link
        ref={ref}
        href={target}
        replace={replace}
        scroll={scroll}
        prefetch={prefetch}
        className={classes || undefined}
        {...props}
      >
        {children}
      </Link>
    );
  },
);

NavLink.displayName = "NavLink";
