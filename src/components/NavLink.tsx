import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A compatibility wrapper for NavLink that adds activeClassName and pendingClassName support.
 */
export interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string | ((props: { isActive: boolean; isPending: boolean }) => string | undefined);
  activeClassName?: string;
  pendingClassName?: string;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        {...props}
        // Hand NavLink a plain STRING. A className render prop cannot survive
        // Radix <Slot>, which merges `className={fn}` from the parent
        // (SidebarMenuButton asChild) with the child's props and stringifies
        // the function into the class attribute.
        className={(navProps) => {
          const baseClass = typeof className === "function" ? className(navProps) : className;
          return cn(
            baseClass,
            navProps.isActive && activeClassName,
            navProps.isPending && pendingClassName
          ) ?? "";
        }}
      />
    );
  },
);

NavLink.displayName = "NavLink";
