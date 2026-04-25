import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { VeteranCelebration } from "./VeteranCelebration";
import { MessageSquare, Plus, Bell, User, LogOut, Settings, Search, X } from "lucide-react";
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
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

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
            <div className={`flex items-center gap-2 ${isSearchExpanded ? "hidden sm:flex" : "flex"}`}>
              <SidebarTrigger className="mr-2" />
              <Link to="/" className="flex items-center gap-2">
                <h1 className="font-heading text-sm font-semibold text-foreground hidden min-[380px]:block">
                  Soloboard
                </h1>
                <span className="relative rounded-full bg-primary/15 px-2 py-0.5 font-body text-[10px] font-medium text-primary hidden sm:inline-block overflow-hidden">
                  <div className="absolute inset-0 beta-shimmer opacity-50" />
                  Beta
                </span>
              </Link>
            </div>

            {/* Search Bar (Command Center) */}
            <div className={cn(
              "flex-1 flex justify-center transition-all duration-300",
              isSearchExpanded ? "absolute inset-x-0 top-0 h-full bg-background z-40 px-4 items-center" : "relative mx-4"
            )}>
              {/* Desktop Search (Fixed 500px) */}
              <div className={cn(
                "hidden lg:flex items-center w-[500px] h-9 bg-[#09090B] border border-white/10 rounded-full px-4 group focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all",
                isSearchExpanded && "hidden"
              )}>
                <Search className="h-4 w-4 text-muted-foreground mr-2" />
                <input 
                  type="text" 
                  placeholder="Search discussions, resources, or freelancers..." 
                  className="bg-transparent border-none outline-none w-full font-body text-xs text-foreground placeholder:text-muted-foreground/50"
                />
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 font-body text-[10px] text-muted-foreground ml-2">
                  <span className="text-[8px] opacity-70">⌘</span>K
                </div>
                
                {/* Instant Results Placeholder */}
                <div className="hidden group-focus-within:block absolute top-full left-0 right-0 mt-2 bg-[#111118] border border-white/10 rounded-xl shadow-2xl z-50 p-4 max-h-[400px] overflow-auto">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-3">Instant Results</p>
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground italic">Start typing to see results...</div>
                  </div>
                </div>
              </div>

              {/* Mobile Expanded Search */}
              {isSearchExpanded && (
                <div className="flex items-center w-full gap-3">
                  <Search className="h-5 w-5 text-primary" />
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Search..." 
                    className="bg-transparent border-none outline-none w-full font-body text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => setIsSearchExpanded(false)} className="p-2 hover:bg-white/5 rounded-full">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>

            {user && (
              <div className={`flex items-center gap-5 shrink-0 ${isSearchExpanded ? "hidden" : "flex"}`}>
                <button 
                  onClick={() => setIsSearchExpanded(true)}
                  className="lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors"
                >
                  <Search className="h-5 w-5" />
                </button>

                <button className="hidden md:block p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors">
                  <MessageSquare className="h-5 w-5" />
                </button>
                
                <Link to="/submit" className="flex items-center gap-[12px] p-2 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-colors font-body text-sm font-medium">
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
                    <button className="flex items-center justify-center h-8 w-8 rounded-full ml-1 focus:outline-none relative border-[2px] border-white/10">
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
                      <Link to={user ? `/profile/${user.uid}` : `/profile`} className="cursor-pointer flex items-center">
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
