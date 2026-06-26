import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { VeteranCelebration } from "./VeteranCelebration";
import { MessageSquare, Plus, Bell, User, LogOut, Settings, Search, X, FileText, Sparkles, Monitor, Sun, Moon, Trophy, Circle, Shield, Check } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, UserProfile } from "@/lib/users";
import { useState, useEffect, useRef } from "react";
import { globalSearch, SearchResults } from "@/lib/search";
import { VerifiedBadge } from "./VerifiedBadge";
import { LiveReputation } from "./LiveReputation";
import { useTheme, ThemeMode } from "@/hooks/useTheme";
import { ref, set } from "firebase/database";
import { database } from "@/lib/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Breadcrumbs } from "./Breadcrumbs";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({ posts: [], users: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(p => {
        if (p) {
          setProfile(p);
          setIsOnline(p.status !== 'offline');
        }
      });
    }
  }, [user]);

  const toggleOnlineStatus = async () => {
    if (!user?.uid) return;
    const newOnline = !isOnline;
    setIsOnline(newOnline);
    await set(ref(database, `users/${user.uid}/status`), newOnline ? 'online' : 'offline');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (window.innerWidth < 1024) {
          setIsSearchExpanded(true);
        } else {
          searchInputRef.current?.focus();
        }
      }
      if (e.key === 'Escape') {
        setIsSearchExpanded(false);
        searchInputRef.current?.blur();
        setSearchQuery("");
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset expanded search on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSearchExpanded(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Debounced Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ posts: [], users: [] });
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await globalSearch(searchQuery);
        setSearchResults(results);
      } finally {
        setIsSearching(false);
        setActiveIndex(-1);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const allResults = [
    ...searchResults.users.map(u => ({ type: 'user' as const, data: u })),
    ...searchResults.posts.map(p => ({ type: 'post' as const, data: p }))
  ];

  const handleNav = (url: string) => {
    navigate(url);
    setIsSearchExpanded(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < allResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      const result = allResults[activeIndex];
      if (result.type === 'user') handleNav(`/f/${result.data.username || result.data.uid}`);
      else handleNav(result.data.category ? `/b/${result.data.category}/p/${result.data.id}` : `/p/${result.data.id}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full">
      <header 
        className={cn(
          "sticky top-0 z-30 w-full border-b border-border transition-all duration-300",
          theme === 'light' ? "bg-white/80 border-slate-200" : "bg-background/80 border-white/10 backdrop-blur-md",
          isAvatarMenuOpen && "bg-background/95 shadow-2xl"
        )}
      >
        <div className="h-14 flex items-center justify-between px-4 relative z-10">
          <div className={`flex items-center shrink-0 absolute left-4 ${isSearchExpanded ? "hidden sm:flex" : "flex"}`}>
            {/* Mobile-only Trigger */}
            <SidebarTrigger className="md:hidden mr-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200" />
            
            {/* Branding Group (Reddit Style) */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                  <img 
                    src="/logo-transparent.png" 
                    alt="Borynx Logo" 
                    className="h-full w-full object-cover transform scale-125" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-lg font-bold tracking-tight text-foreground leading-none">
                    Borynx
                  </span>
                  <span className="relative rounded-full bg-primary/10 px-2.5 py-1 font-body text-[10px] font-bold text-primary border border-primary/20 leading-none">
                    BETA
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Search Bar (Command Center) */}
          <div className={cn(
            "transition-all duration-500 z-20",
            isSearchExpanded ? "absolute inset-x-0 top-0 h-full bg-background z-40 px-4 flex items-center justify-center" : "absolute left-[260px] top-1/2 -translate-y-1/2 w-full max-w-[640px]"
          )}>
            {/* Desktop Search (Flexible width like Reddit) */}
            <div className={cn(
              "hidden lg:flex items-center w-full max-w-[640px] h-10 rounded-full px-4 group transition-all duration-300 theme-transition",
              theme === 'light' ? "bg-muted/40 border border-border hover:bg-muted/60" : "bg-muted/20 border border-border hover:bg-muted/30",
              isSearchExpanded && "hidden"
            )}>
              <Search className="h-4 w-4 text-muted-foreground mr-3" />
              <input 
                ref={searchInputRef}
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Find anything" 
                className="bg-transparent border-none outline-none w-full font-body text-sm text-foreground placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md border border-border bg-background/50 font-mono text-[9px] text-muted-foreground ml-2">
                <span className="opacity-70">⌘</span>K
              </div>
              
              {/* Instant Results Dropdown (Desktop) */}
              <div className={cn(
                "hidden group-focus-within:block absolute top-full left-0 right-0 mt-2 bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-xl shadow-2xl z-50 p-2 max-h-[480px] overflow-auto scrollbar-stealth theme-transition",
                (!searchQuery || (allResults.length === 0 && !isSearching)) && "group-focus-within:hidden"
              )}>
                {isSearching ? (
                  <div className="p-4 space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex gap-3 animate-pulse">
                        <div className="h-8 w-8 rounded-full bg-white/5" />
                        <div className="flex-1 space-y-2">
                          <div className="h-2 bg-white/5 rounded w-1/2" />
                          <div className="h-2 bg-white/5 rounded w-1/4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.users.length > 0 && (
                      <div>
                        <p className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">People</p>
                        {searchResults.users.map((u, i) => (
                          <button
                            key={u.uid}
                            onClick={() => handleNav(`/f/${u.username || u.uid}`)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                              "flex items-center gap-3 w-full p-2 rounded-lg transition-all text-left",
                              activeIndex === i ? "bg-primary/10" : "hover:bg-white/5"
                            )}
                          >
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                              {u.avatarUrl ? (
                                <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-[10px] font-bold">{u.displayName?.charAt(0)}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-semibold text-foreground truncate">{u.displayName}</span>
                                <VerifiedBadge isVerified={u.isVerifiedPro} size={10} showTooltip={false} />
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                <LiveReputation uid={u.uid} fallback={u.reputation} />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchResults.posts.length > 0 && (
                      <div>
                        <p className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground mt-2">Posts</p>
                        {searchResults.posts.map((p, i) => {
                          const idx = searchResults.users.length + i;
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleNav(p.category ? `/b/${p.category}/p/${p.id}` : `/p/${p.id}`)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={cn(
                                "flex items-center gap-3 w-full p-2 rounded-lg transition-all text-left",
                                activeIndex === idx ? "bg-primary/10" : "hover:bg-white/5"
                              )}
                            >
                              <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                {p.type === 'resource' ? <Sparkles className="h-4 w-4 text-[var(--brand-accent)]" /> : <FileText className="h-4 w-4 text-[var(--brand-primary)]" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-foreground truncate">{p.title}</div>
                                <div className="text-[10px] text-muted-foreground truncate opacity-60">#{p.tags?.join(' #')}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {searchQuery && allResults.length === 0 && !isSearching && (
                      <div className="p-8 text-center">
                        <p className="text-xs text-muted-foreground">
                          No results for <span className="text-foreground font-bold">"{searchQuery}"</span>. Try a different keyword.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Expanded Search */}
            {isSearchExpanded && (
              <div className="flex flex-col w-full h-full lg:hidden">
                <div className="flex items-center w-full gap-3 h-14">
                  <Search className="h-5 w-5 text-primary" />
                  <input 
                    ref={mobileInputRef}
                    autoFocus
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..." 
                    className="bg-transparent border-none outline-none w-full font-body text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => { setIsSearchExpanded(false); setSearchQuery(""); }} className="p-2 hover:bg-white/5 rounded-full">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Mobile Results Overlay */}
                <div className="flex-1 overflow-auto p-2">
                  {isSearching ? (
                     <div className="p-4 space-y-4">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex gap-3 animate-pulse">
                          <div className="h-10 w-10 rounded-full bg-white/5" />
                          <div className="flex-1 space-y-2 py-1">
                            <div className="h-2.5 bg-white/5 rounded w-2/3" />
                            <div className="h-2.5 bg-white/5 rounded w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                       {searchResults.users.map((u) => (
                        <button
                          key={u.uid}
                          onClick={() => handleNav(`/f/${u.username || u.uid}`)}
                          className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5"
                        >
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center shrink-0">
                            {u.avatarUrl ? (
                              <img src={u.avatarUrl} alt={u.displayName} className="h-full w-full object-cover" />
                            ) : (
                              <span className="font-bold">{u.displayName?.charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-semibold text-foreground">{u.displayName}</span>
                              <VerifiedBadge isVerified={u.isVerifiedPro} size={12} showTooltip={false} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <LiveReputation uid={u.uid} fallback={u.reputation} />
                            </div>
                          </div>
                        </button>
                      ))}

                      {searchResults.posts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleNav(p.category ? `/b/${p.category}/p/${p.id}` : `/p/${p.id}`)}
                          className="flex items-center gap-3 w-full p-3 rounded-xl bg-white/5"
                        >
                          <div className="h-10 w-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            {p.type === 'resource' ? <Sparkles className="h-5 w-5 text-[var(--brand-accent)]" /> : <FileText className="h-5 w-5 text-[var(--brand-primary)]" />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-semibold text-foreground truncate">{p.title}</div>
                            <div className="text-xs text-muted-foreground truncate opacity-60">#{p.tags?.join(' #')}</div>
                          </div>
                        </button>
                      ))}

                      {searchQuery && allResults.length === 0 && !isSearching && (
                        <div className="p-12 text-center">
                          <p className="text-sm text-muted-foreground">
                            No results for <span className="text-foreground font-bold">"{searchQuery}"</span>.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {user && (
            <div className={`flex items-center gap-2 lg:gap-3 shrink-0 ml-auto ${isSearchExpanded ? "hidden" : "flex"}`}>
              <button 
                onClick={() => setIsSearchExpanded(true)}
                className="lg:hidden p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-full transition-colors"
              >
                <Search className="h-5 w-5" />
              </button>

              <button className="hidden md:flex p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-full transition-colors">
                <MessageSquare className="h-5 w-5" />
              </button>
              
              <Link to="/submit" className="flex items-center gap-2 p-2 px-4 bg-accent/50 hover:bg-accent text-foreground rounded-full transition-colors font-body text-sm font-bold">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Link>

              <button className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 rounded-full transition-colors relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setIsAvatarMenuOpen(prev => !prev)}
                  className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full ml-1 focus:outline-none relative border-[2px] transition-all z-50",
                    isAvatarMenuOpen ? "border-primary ring-4 ring-primary/10" : "border-white/10"
                  )}
                >
                  <div className="h-full w-full rounded-full overflow-hidden bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center">
                    <img 
                      src={profile?.avatarUrl || user?.photoURL || ""} 
                      alt="Avatar" 
                      className="h-full w-full object-cover" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      onLoad={(e) => {
                        e.currentTarget.style.display = 'block';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'none';
                      }}
                    />
                    <span 
                      className="font-heading text-xs font-bold text-primary flex items-center justify-center h-full w-full"
                      style={{ display: (profile?.avatarUrl || user?.photoURL) ? 'none' : 'flex' }}
                    >
                      {profile?.initial || user?.displayName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2px] border-background z-10 transition-colors",
                    isOnline ? "bg-lime-500 shadow-[0_0_6px_rgba(132,204,22,1)]" : "bg-slate-500"
                  )} />
                </button>


              </div>
            </div>
          )}
        </div>

      </header>

      <AnimatePresence>
        {isAvatarMenuOpen && (
          <>
            {/* Backdrop */}
            <div 
              onClick={() => setIsAvatarMenuOpen(false)}
              className="fixed inset-0 z-[998] bg-transparent cursor-default"
            />
            {/* Menu */}
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
              className="fixed top-[3.75rem] right-4 w-[240px] bg-[var(--bg-surface)] border border-[var(--border-main)] rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-[999] overflow-hidden theme-transition"
            >
              <div className="py-2">
                <button 
                  onClick={() => { navigate(user ? `/f/${profile?.username || user.uid}` : '/login'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--text-primary)] group"
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">View Profile</span>
                </button>

                <button 
                  onClick={() => { navigate('/drafts'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--text-primary)] group"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Drafts</span>
                </button>

                <button 
                  onClick={() => { navigate('/premium'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--text-primary)] group"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Premium</span>
                </button>

                <button 
                  onClick={() => { setIsThemeModalOpen(true); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--text-primary)] group"
                >
                  <Moon className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Display Mode</span>
                </button>

                <div className="h-[1px] bg-white/5 my-1" />

                <button 
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--brand-danger)] group"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Log Out</span>
                </button>

                <button 
                  onClick={() => { navigate('/settings'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[var(--text-muted)] transition-all hover:bg-white/5 hover:text-[var(--text-primary)] group"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Settings</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex min-w-0 overflow-hidden relative">
        <AppSidebar />
        
        {/* High-Grade Boundary Toggle */}
        <div 
          className={cn(
            "fixed top-[5rem] z-50 transition-all duration-300 ease-in-out hidden md:flex pointer-events-none",
            state === "expanded" ? "left-[270px]" : "left-[30px]",
            "-translate-x-1/2"
          )}
        >
          <SidebarTrigger 
            className={cn(
              "rounded-full w-8 h-8 flex items-center justify-center p-0 border border-border transition-all duration-300 shadow-[0_0_10px_rgba(99,102,241,0.3)] hover:scale-110 active:scale-95 pointer-events-auto",
              theme === 'dark' ? "bg-[#0D0D12]/60 backdrop-blur-[8px]" : "bg-white"
            )}
          />
        </div>

        <main className="flex-1 overflow-y-auto bg-[var(--bg-app)] relative flex flex-col">
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <Breadcrumbs />
            {children}
          </div>
          
          {/* Sticky Technical Footer */}
          <footer className={cn(
            "sticky bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 px-4 flex items-center justify-between text-xs text-muted-foreground font-body",
            theme === 'light' ? "border-slate-200" : "border-white/10"
          )}>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lime-500"></span>
              </span>
              All systems operational
            </div>
            <div>&copy; {new Date().getFullYear()} Borynx</div>
          </footer>
        </main>
      </div>

      <VeteranCelebration />

      {/* Global Theme Selection Modal (Reddit Style) */}
      <AnimatePresence>
        {isThemeModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsThemeModalOpen(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-[20px] z-[9998]"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "relative z-[9999] w-full max-w-[420px] rounded-[20px] shadow-2xl overflow-hidden theme-transition",
                theme === 'light' ? "bg-[var(--bg-surface)] border border-black/5" : "bg-[var(--bg-surface)] border border-[var(--border-main)]"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-main)]">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Display Mode</h2>
                <button 
                  onClick={() => setIsThemeModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-[var(--text-muted)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-3 space-y-1">
                {[
                  { id: 'system', label: 'Auto (follow system settings)', Icon: Monitor },
                  { id: 'light',  label: 'Light', Icon: Sun },
                  { id: 'dark',   label: 'Dark',  Icon: Moon },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTheme(id as ThemeMode)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-xl transition-all group",
                      theme === id ? "bg-white/[0.03]" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Icon className={cn(
                        "h-5 w-5 transition-colors",
                        theme === id ? "text-[var(--brand-accent)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                      )} />
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        theme === id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        {label}
                      </span>
                    </div>
                    {theme === id && (
                      <Check className="h-5 w-5 text-[var(--brand-accent)]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="p-5 flex justify-end border-t border-[var(--border-main)]">
                <button
                  onClick={() => setIsThemeModalOpen(false)}
                  className="px-8 py-2.5 rounded-full bg-[var(--brand-primary)] hover:opacity-90 text-white text-sm font-bold transition-all shadow-lg shadow-primary/20"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
