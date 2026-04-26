import {
  Home,
  Users,
  Compass,
  Bookmark,
  User,
  Settings,
  PenSquare,
  Zap,
  Trophy,
  LogIn,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
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
  { title: "Home", url: "/", icon: Home },
];

const discover = [
  { title: "Communities", url: "/communities", icon: Compass },
  { title: "Bookmarks", url: "/bookmarks", icon: Bookmark },
  { title: "Achievements", url: "/achievements", icon: Trophy },
];

const personal = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={collapsed ? "p-2 py-4" : "p-4"}>
        <div className={`flex items-center overflow-hidden h-10 w-full ${collapsed ? "justify-center" : "relative"}`}>
          <div className={`h-8 w-8 shrink-0 rounded overflow-hidden ${collapsed ? "mx-auto" : "absolute top-1/2 -translate-y-1/2 left-0"} bg-white/5`}>
            <img src="/logo-transparent.png" alt="Soloboard Logo" className="h-full w-full object-cover transform scale-[1.3]" />
          </div>
          {!collapsed && (
            <span className="font-heading text-lg font-bold tracking-tight text-foreground ml-11">
              Soloboard
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>

        <SidebarGroup>
          <SidebarGroupLabel>
            Feed
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-[12px] w-full px-3 py-2 rounded-lg transition-all duration-200",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}>
                      <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span className="font-medium text-sm flex items-center">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            Discover
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discover.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-[12px] w-full px-3 py-2 rounded-lg transition-all duration-200",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}>
                      <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span className="font-medium text-sm flex items-center">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            You
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personal.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-[12px] w-full px-3 py-2 rounded-lg transition-all duration-200",
                      isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}>
                      <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={1.5} />
                      {!collapsed && <span className="font-medium text-sm flex items-center">{item.title}</span>}
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
          <div className="flex flex-col gap-2">
            {user ? (
              <button
                onClick={async () => {
                  await signOut();
                  navigate("/");
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3 font-body text-sm text-foreground transition-all hover:bg-secondary"
              >
                <LogOut className="h-5 w-5" strokeWidth={1.5} />
                Log Out
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3 font-body text-sm text-foreground transition-all hover:bg-secondary"
              >
                <LogIn className="h-5 w-5" strokeWidth={1.5} />
                Log In
              </button>
            )}
            <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-surface)]/50 p-3">
              <p className="font-body text-xs text-muted-foreground">
                Built for freelancers, by freelancers.
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
