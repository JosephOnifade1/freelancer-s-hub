import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { VeteranCelebration } from "./VeteranCelebration";
import { MessageSquare, Plus, Bell, User, LogOut, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, UserProfile } from "@/lib/users";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(p => {
        if (p) setProfile(p);
      });
    }
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="mr-2" />
              <Link to="/" className="flex items-center gap-2">
                <h1 className="font-heading text-sm font-semibold text-foreground">
                  Soloboard
                </h1>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 font-body text-[10px] font-medium text-primary hidden sm:inline-block">
                  Beta
                </span>
              </Link>
            </div>

            {user && (
              <div className="flex items-center gap-5">
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors">
                  <MessageSquare className="h-5 w-5" />
                </button>
                
                <Link to="/submit" className="flex items-center gap-1.5 p-2 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors font-body text-sm font-medium">
                  <Plus className="h-5 w-5" />
                  <span className="hidden sm:inline">Create</span>
                </Link>

                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center h-8 w-8 rounded-full ml-1 focus:outline-none relative">
                      <div className="h-full w-full rounded-full overflow-hidden bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center">
                        {profile?.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                        ) : (
                          <span className="font-heading text-xs font-bold text-primary">
                            {profile?.initial || "?"}
                          </span>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2px] border-background bg-lime-500 shadow-[0_0_6px_rgba(132,204,22,1)] z-10"></div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{profile?.displayName || "User"}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          @{profile?.username || "loading"}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={profile?.username ? `/@${profile.username}` : `/profile`} className="cursor-pointer flex items-center">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/settings" className="cursor-pointer flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-500 focus:text-red-500">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </header>
          <main className="flex-1 overflow-y-auto flex flex-col">
            <div className="flex-1">
              {children}
            </div>
            
            {/* Sticky Technical Footer */}
            <footer className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 px-4 flex items-center justify-between text-xs text-muted-foreground font-body">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
                </span>
                All systems operational
              </div>
              <div>&copy; {new Date().getFullYear()} Soloboard</div>
            </footer>
          </main>
        </div>
      </div>
      <VeteranCelebration />
    </SidebarProvider>
  );
}
