"use client";

import React, { forwardRef } from "react";
import NextLink from "next/link";
import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
  useSearchParams as useNextSearchParams,
} from "next/navigation";

// Next.js compatible Link component that accepts react-router-dom `to` prop or standard `href`
export interface CompatibleLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to?: string | { pathname?: string; search?: string; hash?: string };
  href?: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  state?: any; // accepted and ignored in Next.js
}

export const Link = forwardRef<HTMLAnchorElement, CompatibleLinkProps>(
  ({ to, href, replace, scroll, prefetch, state, children, ...props }, ref) => {
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
        {...props}
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

    const computedClass = typeof className === "function" ? className(navProps) : className;

    return (
      <Link
        ref={ref}
        to={to}
        href={href}
        className={`${computedClass || ""} ${isActive && activeClassName ? activeClassName : ""}`}
        {...props}
      >
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
    options?: { replace?: boolean; state?: any }
  ) => {
    if (typeof to === "number") {
      if (to === -1) {
        router.back();
      } else if (to === 1) {
        router.forward();
      }
      return;
    }

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
  const search = searchParams ? `?${searchParams.toString()}` : "";

  return {
    pathname,
    search,
    hash: "",
    state: null,
    key: "default",
  };
}

// Compatible useParams hook
export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  try {
    const { useParams: nextUseParams } = require("next/navigation");
    return (nextUseParams() || {}) as T;
  } catch {
    return {} as T;
  }
}

// Compatible useSearchParams hook
export function useSearchParams(): [URLSearchParams, (params: any, options?: any) => void] {
  const nextSearchParams = useNextSearchParams();
  const router = useNextRouter();
  const pathname = useNextPathname() || "/";

  const searchParams = new URLSearchParams(nextSearchParams?.toString() || "");

  const setSearchParams = (
    nextInit: any,
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
}: {
  to: string;
  replace?: boolean;
  state?: any;
}) {
  const router = useNextRouter();

  React.useEffect(() => {
    if (replace) {
      router.replace(to);
    } else {
      router.push(to);
    }
  }, [router, to, replace]);

  return null;
}

// Stubs for testing utilities if imported in test files
export const MemoryRouter = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Routes = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const Route = () => null;
