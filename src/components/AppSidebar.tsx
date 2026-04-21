import {
  Flame,
  Clock,
  Users,
  Compass,
  Bookmark,
  User,
  Settings,
  PenSquare,
  Zap,
  Trophy,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Hot Feed", url: "/", icon: Flame },
  { title: "New", url: "/new", icon: Clock },
  { title: "Following", url: "/following", icon: Users },
];

const discover = [
  { title: "Communities", url: "/communities", icon: Compass },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark },
  { title: "Achievements", url: "/achievements", icon: Trophy },
];

const personal = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-heading text-lg font-bold tracking-tight text-foreground">
              Soloboard
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {!collapsed && (
          <div className="px-4 pb-2">
            <NavLink
              to="/submit"
              className="flex w-full items-center gap-2 rounded-lg bg-primary px-3 py-2.5 font-body text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 glow-primary"
            >
              <PenSquare className="h-4 w-4" />
              New Post
            </NavLink>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-xs uppercase tracking-wider text-muted-foreground/60">
            Feed
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-xs uppercase tracking-wider text-muted-foreground/60">
            Discover
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discover.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="font-body text-xs uppercase tracking-wider text-muted-foreground/60">
            You
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personal.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3">
            <p className="font-body text-xs text-muted-foreground">
              Built for freelancers, by freelancers.
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
