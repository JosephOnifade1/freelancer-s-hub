"use client";

import React, { forwardRef } from "react";
import NextLink from "next/link";
import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
  useSearchParams as useNextSearchParams,
  useParams as nextUseParams,
} from "next/navigation";

/** Mirrors the shapes React Router's `setSearchParams` accepts. */
export type URLSearchParamsInit =
  | string
  | URLSearchParams
  | Record<string, string | number | boolean | undefined | null>
  | ((current: URLSearchParams) => URLSearchParams);

// Next.js compatible Link component that accepts react-router-dom `to` prop or standard `href`
export interface CompatibleLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to?: string | { pathname?: string; search?: string; hash?: string };
  href?: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  /** React Router's `state`. Next has no equivalent, so the adapter writes it
   *  to `history.state` on click and `useLocation()` reads it back (see below). */
  state?: unknown;
}

export // ── React Router `state` bridge ──────────────────────────────────────────────
// Next.js has no per-navigation state object. React Router's `state` is only
// used by the auth flow (`ProtectedRoute` → `/login` → back to the original
// page), so the adapter stores it on `history.state` and `useLocation()`
// surfaces it again. No Storage / cookies are involved.
const STATE_KEY = "__borynx_nav_state";

function writeHistoryState(value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState({ ...(window.history.state || {}), [STATE_KEY]: value }, "");
  } catch {
    /* history is unavailable (e.g. sandboxed iframe) — redirect falls back to "/" */
  }
}

function readHistoryState(): unknown {
  if (typeof window === "undefined") return null;
  try {
    return (window.history.state as Record<string, unknown> | null)?.[STATE_KEY] ?? null;
  } catch {
    return null;
  }
}

export const Link = forwardRef<HTMLAnchorElement, CompatibleLinkProps>(
  ({ to, href, replace, scroll, prefetch, state, children, ...rest }, ref) => {
    let resolvedHref = href || "/";
    if (to) {
      if (typeof to === "string") {
        resolvedHref = to;
      } else if (typeof to === "object") {
        resolvedHref = `${to.pathname || ""}${to.search || ""}${to.hash || ""}` || "/";
      }
    }

    return (
      <NextLink
        ref={ref}
        href={resolvedHref}
        replace={replace}
        scroll={scroll}
        prefetch={prefetch}
        {...rest}
        onClick={(event) => {
          // Persist React Router `state` for the destination route. Next only
          // re-renders on click when navigation actually happens; modifier
          // clicks and external handlers keep their normal behaviour.
          if (state !== undefined) writeHistoryState(state);
          rest.onClick?.(event);
        }}
      >
        {children}
      </NextLink>
    );
  }
);
Link.displayName = "CompatibleLink";

// Compatible NavLink component
export interface NavLinkProps extends Omit<CompatibleLinkProps, "className"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string | undefined);
  activeClassName?: string;
  pendingClassName?: string;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  ({ to, href, className, activeClassName, pendingClassName, children, ...props }, ref) => {
    const pathname = useNextPathname() || "/";
    let target = href || "/";
    if (to) {
      if (typeof to === "string") target = to;
      else if (typeof to === "object") target = to.pathname || "/";
    }

    const isActive = target === "/" ? pathname === "/" : pathname.startsWith(target);
    const navProps = { isActive, isPending: false };

    // Per React Router's NavLink contract, a function `className` is ALWAYS a
    // render prop and its result must never be stringified into the DOM.
    const computedClass = typeof className === "function" ? className(navProps) : className;
    const classes = [computedClass, isActive && activeClassName].filter(Boolean).join(" ");

    return (
      <Link ref={ref} to={to} href={href} className={classes || undefined} {...props}>
        {children}
      </Link>
    );
  }
);
NavLink.displayName = "CompatibleNavLink";

// Compatible useNavigate hook
export function useNavigate() {
  const router = useNextRouter();

  return (
    to: string | number,
    options?: { replace?: boolean; state?: unknown }
  ) => {
    if (typeof to === "number") {
      if (to === -1) {
        router.back();
      } else if (to === 1) {
        router.forward();
      }
      return;
    }

    if (options?.state !== undefined) writeHistoryState(options.state);

    if (options?.replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  };
}

// Compatible useLocation hook
export function useLocation() {
  const pathname = useNextPathname() || "/";
  const searchParams = useNextSearchParams();
  const query = searchParams ? searchParams.toString() : "";
  // React Router exposes `search` with a leading "?" (or "" when empty) —
  // `postAuthRedirect` concatenates it directly onto `pathname`.
  const search = query ? `?${query}` : "";

  return {
    pathname,
    search,
    hash: "",
    state: readHistoryState(),
    key: "default",
  };
}

// Compatible useParams hook
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  // Static import (the old dynamic require() broke under Turbopack/ESM).
  return (nextUseParams() || {}) as T;
}

// Compatible useSearchParams hook
export function useSearchParams(): [
  URLSearchParams,
  (params: URLSearchParamsInit, options?: { replace?: boolean }) => void,
] {
  const nextSearchParams = useNextSearchParams();
  const router = useNextRouter();
  const pathname = useNextPathname() || "/";

  const searchParams = new URLSearchParams(nextSearchParams?.toString() || "");

  const setSearchParams = (
    nextInit: URLSearchParamsInit,
    navigateOptions?: { replace?: boolean }
  ) => {
    let newParams = new URLSearchParams();
    if (typeof nextInit === "function") {
      newParams = new URLSearchParams(nextInit(searchParams));
    } else if (nextInit instanceof URLSearchParams) {
      newParams = nextInit;
    } else if (typeof nextInit === "object" && nextInit !== null) {
      Object.entries(nextInit).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          newParams.set(key, String(val));
        }
      });
    }

    const queryString = newParams.toString();
    const destination = queryString ? `${pathname}?${queryString}` : pathname;

    if (navigateOptions?.replace) {
      router.replace(destination);
    } else {
      router.push(destination);
    }
  };

  return [searchParams, setSearchParams];
}

// Compatible Navigate component
export function Navigate({
  to,
  replace,
  state,
}: {
  to: string;
  replace?: boolean;
  state?: unknown;
}) {
  const router = useNextRouter();

  React.useEffect(() => {
    if (state !== undefined) writeHistoryState(state);
    if (replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  }, [router, to, replace, state]);

  return null;
}

// Stubs for testing utilities if imported in test files
export const MemoryRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Routes = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Route = () => null;
