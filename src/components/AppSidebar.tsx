import { Home, Compass, Bookmark, Settings, Trophy, Plus, Bell, Briefcase, ShieldCheck, Inbox, TrendingUp, Zap, Users, LogIn, KanbanSquare, AlertTriangle } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile } from "@/lib/users";
import { fetchOpenReportsCount } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { CreateCommunityModal } from "@/components/modals/CreateCommunityModal";

type NavItem = {
  title: string;
  url: string;
  icon: typeof Home;
  badge?: string;
};

const nav = (
  title: string,
  url: string,
  icon: typeof Home,
  badge?: string,
): NavItem => ({ title, url, icon, badge });

export function AppSidebar() {
  const location = useLocation();
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

  const browse = [
    nav(user ? "Feed" : "Browse posts", user ? "/" : "/new", Home),
    nav("New posts", "/new", Zap),
    nav("Popular", "/popular", TrendingUp),
    nav("Spaces", "/communities", Compass),
    nav("Opportunities", "/l", Briefcase),
  ].filter((item, index, list) => !list.slice(0, index).some((previous) => previous.url === item.url));
  const account = user ? [
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
  ] : [nav("Sign in", "/login", LogIn)];

  const renderItems = (items: typeof browse) => items.map((item) => (
    <SidebarMenuItem key={item.url} className="px-4 sm:px-6">
      <SidebarMenuButton asChild isActive={location.pathname === item.url} variant="ghost" className="h-auto overflow-hidden p-0 hover:bg-transparent">
        <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
          "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "bg-accent font-semibold text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}>
          <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="whitespace-nowrap">{item.title}</span>
          {item.badge && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-amber-900">
              {item.badge}
            </span>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));

  return (
    <Sidebar collapsible="icon" className="overflow-hidden">
      <SidebarContent className="pt-4">
        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="h-9 px-7 text-xs font-medium text-muted-foreground">Browse</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{renderItems(browse)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="h-9 px-7 text-xs font-medium text-muted-foreground">{user ? "Your workspace" : "Join Borynx"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {user && <SidebarMenuItem className="px-4 sm:px-6">
                <CreateCommunityModal>
                  <SidebarMenuButton variant="ghost" className="h-auto min-h-10 cursor-pointer overflow-hidden p-0 hover:bg-transparent">
                    <span className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"><Plus className="h-[18px] w-[18px] shrink-0" /> New space</span>
                  </SidebarMenuButton>
                </CreateCommunityModal>
              </SidebarMenuItem>}
              {renderItems(account)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {!user && <p className="px-7 pt-3 text-xs leading-relaxed text-muted-foreground">Browse public content freely. Sign in to post, join, apply or save.</p>}
      </SidebarContent>
    </Sidebar>
  );
}
