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
  Plus,
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
import { CreateCommunityModal } from "@/components/modals/CreateCommunityModal";

const mainNav = [
  { title: "Home", url: "/", icon: Home },
];

const discover = [
  { title: "Borynx Spaces", url: "/communities", icon: Compass },
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
    <Sidebar collapsible="icon" className="overflow-hidden">
      <SidebarContent className="pt-6">
        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-8 h-10 transition-all duration-300 ease-in-out opacity-100">
            Feed
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title} className="px-8">
                  <SidebarMenuButton asChild isActive={isActive(item.url)} variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-300",
                      isActive 
                        ? "bg-accent text-foreground font-bold shadow-sm" 
                        : "text-[var(--text-muted)] hover:bg-accent/50 hover:text-[var(--text-primary)]"
                    )}>
                      <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive(item.url) ? 2.5 : 1.5} />
                      <span className="text-[14px] whitespace-nowrap transition-all duration-300 opacity-100">
                        {item.title}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-8 h-10 transition-all duration-300 ease-in-out opacity-100">
            Spaces
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discover.map((item) => (
                <div key={item.title}>
                  <SidebarMenuItem className="px-8">
                    <SidebarMenuButton asChild isActive={isActive(item.url)} variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                      <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                        "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-300",
                        isActive 
                          ? "bg-accent text-foreground font-bold shadow-sm" 
                          : "text-[var(--text-muted)] hover:bg-accent/50 hover:text-[var(--text-primary)]"
                      )}>
                        <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive(item.url) ? 2.5 : 1.5} />
                        <span className="text-[14px] whitespace-nowrap transition-all duration-300 opacity-100">
                          {item.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {item.title === "Borynx Spaces" && (
                    <SidebarMenuItem className="px-8 mt-1 mb-1">
                      <CreateCommunityModal>
                        <SidebarMenuButton variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                          <div className={cn(
                            "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-300",
                            "text-[var(--text-muted)] hover:bg-accent/50 hover:text-[var(--text-primary)] cursor-pointer"
                          )}>
                            <Plus className="h-[17px] w-[17px] shrink-0" strokeWidth={1.5} />
                            <span className="text-[14px] whitespace-nowrap transition-all duration-300 opacity-100">
                              Start a B-Space
                            </span>
                          </div>
                        </SidebarMenuButton>
                      </CreateCommunityModal>
                    </SidebarMenuItem>
                  )}
                </div>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="px-0">
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-8 h-10 transition-all duration-300 ease-in-out opacity-100">
            You
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personal.map((item) => (
                <SidebarMenuItem key={item.title} className="px-8">
                  <SidebarMenuButton asChild isActive={isActive(item.url)} variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-300",
                      isActive 
                        ? "bg-accent text-foreground font-bold shadow-sm" 
                        : "text-[var(--text-muted)] hover:bg-accent/50 hover:text-[var(--text-primary)]"
                    )}>
                      <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive(item.url) ? 2.5 : 1.5} />
                      <span className="text-[14px] whitespace-nowrap transition-all duration-300 opacity-100">
                        {item.title}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 transition-all duration-300 ease-in-out opacity-100">
        <div className="flex flex-col gap-2">
          <div className="rounded-lg border border-[var(--border-main)] bg-[var(--bg-surface)]/50 p-3 text-center">
            <p className="font-body text-xs text-muted-foreground">
              Built for freelancers, by freelancers.
            </p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
