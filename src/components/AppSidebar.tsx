import {
  Home,
  Compass,
  Bookmark,
  Settings,
  Trophy,
  Plus,
  Briefcase,
  TrendingUp,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { CreateCommunityModal } from "@/components/modals/CreateCommunityModal";

const mainNav = [
  { title: "Feed", url: "/", icon: Home },
  { title: "Popular", url: "/popular", icon: TrendingUp },
];

const discover = [
  { title: "Spaces", url: "/communities", icon: Compass },
  { title: "Leads", url: "/l", icon: Briefcase },
  { title: "Saved", url: "/bookmarks", icon: Bookmark },
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
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-8 h-10 transition-all duration-300 ease-in-out opacity-100">
            Browse
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title} className="px-8">
                  <SidebarMenuButton asChild isActive={isActive(item.url)} variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors",
                      isActive 
                        ? "bg-accent text-foreground font-medium" 
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}>
                      <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive(item.url) ? 2.5 : 1.5} />
                      <span className="text-sm whitespace-nowrap transition-all duration-300 opacity-100">
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
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-8 h-10 transition-all duration-300 ease-in-out opacity-100">
            Community
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {discover.map((item) => (
                <div key={item.title}>
                  <SidebarMenuItem className="px-8">
                    <SidebarMenuButton asChild isActive={isActive(item.url)} variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                      <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                        "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors",
                        isActive 
                          ? "bg-accent text-foreground font-medium" 
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      )}>
                        <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive(item.url) ? 2.5 : 1.5} />
                        <span className="text-sm whitespace-nowrap transition-all duration-300 opacity-100">
                          {item.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {item.title === "Spaces" && (
                    <SidebarMenuItem className="px-8 mt-1 mb-1">
                      <CreateCommunityModal>
                        <SidebarMenuButton variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                          <div className={cn(
                            "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors",
                            "text-muted-foreground hover:bg-accent/50 hover:text-foreground cursor-pointer"
                          )}>
                            <Plus className="h-[17px] w-[17px] shrink-0" strokeWidth={1.5} />
                            <span className="text-sm whitespace-nowrap transition-all duration-300 opacity-100">
                              New space
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
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground/70 px-8 h-10 transition-all duration-300 ease-in-out opacity-100">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {personal.map((item) => (
                <SidebarMenuItem key={item.title} className="px-8">
                  <SidebarMenuButton asChild isActive={isActive(item.url)} variant="ghost" className="p-0 h-auto hover:bg-transparent overflow-hidden">
                    <NavLink to={item.url} end className={({ isActive }: { isActive: boolean }) => cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors",
                      isActive 
                        ? "bg-accent text-foreground font-medium" 
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}>
                      <item.icon className="h-[17px] w-[17px] shrink-0" strokeWidth={isActive(item.url) ? 2.5 : 1.5} />
                      <span className="text-sm whitespace-nowrap transition-all duration-300 opacity-100">
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

    </Sidebar>
  );
}
