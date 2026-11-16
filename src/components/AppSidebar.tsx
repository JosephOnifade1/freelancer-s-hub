import { Home, Compass, Bookmark, Settings, Trophy, Plus, Bell, Briefcase, ShieldCheck, Inbox, TrendingUp, Zap, LogIn, KanbanSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useCurrentPathname } from "@/hooks/useCurrentPathname";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile } from "@/lib/users";
import { fetchOpenReportsCount } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { CreateCommunityModal } from "@/components/modals/CreateCommunityModal";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  badge?: string;
};

const nav = (
  title: string,
  url: string,
  icon: React.ElementType,
  badge?: string,
): NavItem => ({ title, url, icon, badge });

function NavItemRow({
  item,
  isActive,
  collapsed,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const inner = (
    <NavLink
      to={item.url}
      end
      className={() =>
        cn(
          "nav-item flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/50",
          collapsed ? "justify-center px-0" : "",
          isActive
            ? "bg-brand/10 text-brand font-semibold"
            : "text-ink-3 hover:bg-sunken hover:text-ink",
        )
      }
      data-active={isActive ? "true" : undefined}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", isActive ? "text-ember" : "text-ink-4")}
        aria-hidden
      />
      {!collapsed && (
        <span className="flex-1 whitespace-nowrap truncate">{item.title}</span>
      )}
      {!collapsed && item.badge && (
        <span className="ml-auto flex h-4.5 min-w-5 items-center justify-center rounded-full bg-ember px-1.5 text-[9px] font-bold text-white tabular-nums">
          {item.badge}
        </span>
      )}
      {collapsed && item.badge && (
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-ember" aria-hidden />
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative w-full flex justify-center">{inner}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            {item.title}
            {item.badge && ` (${item.badge})`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <div className="w-full">{inner}</div>;
}

export function AppSidebar() {
  const pathname = useCurrentPathname();
  const isActivePath = (url: string) =>
    pathname === url || (url !== "/" && pathname.startsWith(`${url}/`));

  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user?.uid,
  });
  const isModerator = profile?.role === "moderator" || profile?.role === "admin";

  const { data: openReportsCount = 0 } = useQuery({
    queryKey: ["open-reports-count"],
    queryFn: fetchOpenReportsCount,
    enabled: isModerator,
  });

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  const browse: NavItem[] = [
    nav(user ? "Feed" : "Browse posts", user ? "/" : "/new", Home),
    nav("New posts", "/new", Zap),
    nav("Popular", "/popular", TrendingUp),
    nav("Spaces", "/communities", Compass),
    nav("Opportunities", "/l", Briefcase),
  ].filter((item, index, list) =>
    !list.slice(0, index).some((prev) => prev.url === item.url),
  );

  const account: NavItem[] = user
    ? [
        nav("My pipeline", "/pipeline", KanbanSquare),
        nav("Applications", "/applications", Inbox),
        nav("Saved posts", "/bookmarks", Bookmark),
        nav("Achievements", "/achievements", Trophy),
        nav("Notifications", "/notifications", Bell),
        ...(isModerator
          ? [
              {
                title: "Moderation",
                url: "/admin",
                icon: ShieldCheck,
                badge: openReportsCount > 0 ? String(openReportsCount) : undefined,
              },
            ]
          : []),
        nav("Settings", "/settings", Settings),
      ]
    : [nav("Sign in", "/login", LogIn)];

  const sidebarWidth = collapsed ? "var(--sidebar-rail, 52px)" : "var(--sidebar-w, 256px)";

  return (
    <nav
      aria-label="Main navigation"
      style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
      className={cn(
        "relative flex flex-col h-screen sticky top-0 overflow-hidden z-30",
        "bg-surface border-r border-line transition-[width] duration-220 ease-out",
        "shrink-0",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b border-line shrink-0",
          collapsed ? "h-14 justify-center px-0" : "h-14 px-4 gap-2",
        )}
      >
        {collapsed ? (
          <span className="font-heading text-lg font-black text-ember select-none">B</span>
        ) : (
          <>
            <span className="font-heading text-base font-black text-ink select-none tracking-tight">
              BOR<span className="text-ember">YNX</span>
            </span>
          </>
        )}
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 space-y-4 scrollbar-hide">
        {/* Browse group */}
        <div className="space-y-0.5 px-2">
          {!collapsed && (
            <p className="eyebrow px-2 pb-1 text-[9.5px] tracking-widest text-ink-4 uppercase">
              Browse
            </p>
          )}
          {browse.map((item) => (
            <NavItemRow
              key={item.url}
              item={item}
              isActive={isActivePath(item.url)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="hairline-b mx-3" />

        {/* Workspace group */}
        <div className="space-y-0.5 px-2">
          {!collapsed && (
            <p className="eyebrow px-2 pb-1 text-[9.5px] tracking-widest text-ink-4 uppercase">
              {user ? "Your workspace" : "Join Borynx"}
            </p>
          )}

          {/* New Space button */}
          {user && (
            <CreateCommunityModal>
              {collapsed ? (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full justify-center rounded-lg p-2.5 text-ink-3 hover:bg-sunken hover:text-ink transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">New space</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-3 hover:bg-sunken hover:text-ink transition-colors"
                >
                  <Plus className="h-4 w-4 shrink-0 text-ink-4" />
                  <span>New space</span>
                </button>
              )}
            </CreateCommunityModal>
          )}

          {account.map((item) => (
            <NavItemRow
              key={item.url}
              item={item}
              isActive={isActivePath(item.url)}
              collapsed={collapsed}
            />
          ))}
        </div>

        {!user && !collapsed && (
          <p className="px-4 text-xs leading-relaxed text-ink-3">
            Browse freely. Sign in to post, join spaces, or apply.
          </p>
        )}
      </div>

      {/* Collapse toggle */}
      <div className={cn("shrink-0 border-t border-line py-2", collapsed ? "flex justify-center" : "px-3")}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-ink-3 hover:bg-sunken hover:text-ink transition-colors",
            collapsed ? "justify-center w-full" : "w-full",
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="eyebrow text-[9.5px]">Collapse</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
