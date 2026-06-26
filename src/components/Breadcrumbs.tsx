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
import { cn } from "@/lib/utils";

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  // If we are on the home page, don't show breadcrumbs or just show Home
  if (location.pathname === "/" || location.pathname === "/login" || location.pathname === "/signup") {
    return null;
  }

  const getDisplayName = (path: string) => {
    const names: Record<string, string> = {
      b: "Spaces",
      u: "People",
      f: "Freelancers",
      p: "Posts",
      l: "Leads",
      submit: "Create",
      settings: "Settings",
      communities: "Discover",
      bookmarks: "Bookmarks",
      achievements: "Achievements",
    };
    return names[path] || path.charAt(0).toUpperCase() + path.slice(1);
  };

  return (
    <div className="mb-6 px-1">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Home className="h-3.5 w-3.5" />
                <span className="text-[12px] font-medium font-body tracking-wide">Borynx</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          
          {pathnames.map((value, index) => {
            const last = index === pathnames.length - 1;
            const to = `/${pathnames.slice(0, index + 1).join("/")}`;

            return (
              <div key={to} className="flex items-center gap-2">
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3 w-3 opacity-40" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {last ? (
                    <BreadcrumbPage className="text-[12px] font-bold font-heading text-foreground tracking-tight max-w-[120px] truncate sm:max-w-none">
                      {getDisplayName(value)}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={to} className="text-[12px] font-medium font-body text-muted-foreground hover:text-foreground transition-colors">
                        {getDisplayName(value)}
                      </Link>
                    </BreadcrumbLink>
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
