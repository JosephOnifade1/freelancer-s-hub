import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/**
 * Maps URL segments to human-readable display names.
 */
const SEGMENT_LABELS: Record<string, string> = {
  // Short namespace prefixes (no standalone page — see NON_NAVIGABLE_PREFIXES)
  b: "Space",
  f: "Profile",
  u: "Profile",
  p: "Post",
  // Real navigable segments
  l: "Opportunities",
  pipeline: "My pipeline",
  new: "New Posts",
  popular: "Popular",
  tag: "Tag",
  submit: "Create Post",
  settings: "Settings",
  communities: "Discover",
  bookmarks: "Bookmarks",
  achievements: "Achievements",
  // Leads sub-routes
  post: "Post opportunity",
  // Coming-soon pages
  drafts: "Drafts",
  premium: "Premium",
  pricing: "Pricing",
  status: "Status",
  privacy: "Privacy",
  terms: "Terms",
};

/**
 * URL prefix segments that have NO standalone page — they are only valid
 * as part of a longer path (e.g. /f/:uid, /b/:slug). Clicking just /f
 * would 404, so we render these as plain text, not links.
 */
const NON_NAVIGABLE_PREFIXES = new Set(["f", "u", "b", "p"]);

/**
 * Paths where the breadcrumb should be hidden entirely.
 */
const HIDDEN_PATHS = new Set(["/", "/login", "/signup"]);

export function Breadcrumbs() {
  const location = useLocation();

  if (HIDDEN_PATHS.has(location.pathname)) {
    return null;
  }

  const segments = location.pathname.split("/").filter(Boolean);

  // Build breadcrumb items: each item knows its display label, its target
  // href, and whether it's actually navigable.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const items: { seg: string; href: string; label: string; isNavigable: boolean }[] = [];

  for (let index = 0; index < segments.length; index++) {
    const seg = segments[index];

    // Namespace prefix + its value collapse into one crumb: b/dev, f/joseph, Post.
    if (NON_NAVIGABLE_PREFIXES.has(seg) && segments[index + 1]) {
      const value = segments[index + 1];
      const href = "/" + segments.slice(0, index + 2).join("/");
      let label: string;
      if (seg === "p") label = "Post";
      else if (UUID.test(value)) label = seg === "b" ? "Space" : "Profile";
      else label = `${seg === "u" ? "f" : seg}/${decodeURIComponent(value)}`;
      items.push({ seg: value, href, label, isNavigable: true });
      index += 1;
      continue;
    }

    const href = "/" + segments.slice(0, index + 1).join("/");
    const label = SEGMENT_LABELS[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    items.push({ seg, href, label, isNavigable: !NON_NAVIGABLE_PREFIXES.has(seg) });
  }

  return (
    <div className="mb-6">
      <Breadcrumb>
        <BreadcrumbList>
          {/* Home anchor */}
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                to="/"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Home className="h-3.5 w-3.5" />
                <span className="text-[12px] font-medium font-body ">
                  Borynx
                </span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {items.map(({ href, label, isNavigable }, index) => {
            const isLast = index === items.length - 1;
            return (
              <div key={href} className="flex items-center gap-2">
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3 opacity-40" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {isLast ? (
                    // Last segment is always plain text (current page)
                    <BreadcrumbPage className="text-[12px] font-bold font-heading text-foreground tracking-tight max-w-[120px] truncate sm:max-w-none">
                      {label}
                    </BreadcrumbPage>
                  ) : isNavigable ? (
                    // Navigable intermediate segment gets a real link
                    <BreadcrumbLink asChild>
                      <Link
                        to={href}
                        className="text-[12px] font-medium font-body text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    // Non-navigable prefix (f, b, p, u) — render as plain text separator
                    <span className="text-[12px] font-medium font-body text-muted-foreground/50 select-none">
                      {label}
                    </span>
                  )}
                </BreadcrumbItem>
              </div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
