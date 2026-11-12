/**
 * LEGACY-BUILD SHIM — not used by the Next.js build.
 *
 * `next/link` for the rollback snapshot: renders React Router's `Link` so the
 * frozen Vite application keeps client-side navigation (a bare anchor would do a
 * full page reload). See `./next-navigation.ts` for the full rationale.
 *
 * The Next.js build resolves the real `next/link` and never sees this file.
 */
import { forwardRef } from "react";
import { Link as RouterLink } from "react-router-dom";

export interface LegacyLinkProps extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean | null;
  children?: React.ReactNode;
}

const LegacyLink = forwardRef<HTMLAnchorElement, LegacyLinkProps>(
  ({ href, replace, scroll: _scroll, prefetch: _prefetch, children, ...rest }, ref) => (
    // `scroll`/`prefetch` are accepted for signature parity with next/link and
    // intentionally unused: React Router owns scrolling in the snapshot.
    <RouterLink ref={ref} to={href} replace={replace} {...rest}>
      {children}
    </RouterLink>
  ),
);

LegacyLink.displayName = "LegacyNextLink";

export default LegacyLink;
