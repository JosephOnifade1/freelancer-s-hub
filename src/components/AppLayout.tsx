import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/components/ui/sidebar-context";
import { AppSidebar } from "@/components/AppSidebar";
import { VeteranCelebration } from "./VeteranCelebration";
import { NotificationBell } from "./NotificationBell";
import { Plus, User, LogOut, Settings, Search, X, FileText, Sparkles, Monitor, Sun, Moon, Shield, Check, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, UserProfile } from "@/lib/users";
import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { globalSearch, SearchResults } from "@/lib/search";
import { VerifiedBadge } from "./VerifiedBadge";
import { LiveReputation } from "./LiveReputation";
import { useTheme, ThemeMode } from "@/hooks/useTheme";
import { supabase, isDemoMode } from "@/lib/supabase";
import { saveOwnProfile, isProfileError } from "@/lib/profile-client";
import { toast } from "sonner";
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
import { ProfileProvisioningNotice } from "./ProfileProvisioningNotice";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: profile, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user?.uid,
  });
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults>({ posts: [], users: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const isAvailable = profile?.status === "Available";
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const { state } = useSidebar();

  const toggleAvailability = async () => {
    if (!user?.uid || !profile || availabilityPending) return;
    const nextAvailable = !isAvailable;
    setAvailabilityPending(true);
    try {
      // Phase 2C: written to Neon. No uid is sent — the server updates the session's
      // own row, so the toggle cannot target another account.
      const result = await saveOwnProfile({ status: nextAvailable ? "Available" : "Busy" });
      if (isProfileError(result)) throw new Error("Could not update your work status.");
      queryClient.setQueryData<UserProfile | null>(["profile", user.uid], (previous) =>
        previous ? { ...previous, status: nextAvailable ? "Available" : "Busy" } : previous);
      queryClient.invalidateQueries({ queryKey: ["profile", user.uid] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your work status.");
    } finally {
      setAvailabilityPending(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
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
      setSearchError(false);
      return;
    }

    let cancelled = false;
    setSearchError(false);
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await globalSearch(searchQuery);
        if (!cancelled) setSearchResults(results);
      } catch {
        if (!cancelled) { setSearchError(true); setSearchResults({ posts: [], users: [] }); }
      } finally {
        if (!cancelled) { setIsSearching(false); setActiveIndex(-1); }
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const allResults = [
    ...searchResults.users.map(u => ({ type: 'user' as const, data: u })),
    ...searchResults.posts.map(p => ({ type: 'post' as const, data: p }))
  ];

  const handleNav = (url: string) => {
    router.push(url);
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
          theme === 'light' ? "bg-white/90 border-border" : "bg-background/90 border-white/10 backdrop-blur-md",
          isAvatarMenuOpen && "bg-background/95 shadow-2xl"
        )}
      >
        <div className="h-12 flex items-center justify-between px-4 sm:px-6 relative z-10">
          <div className={`flex shrink-0 items-center ${isSearchExpanded ? "hidden lg:flex" : "flex"}`}>
            {/* Mobile-only Trigger */}
            <SidebarTrigger className="md:hidden mr-2 hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200" />

            {/* Branding Group (Reddit Style) */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div className="h-7 w-7 shrink-0 rounded-radius-md bg-brand/10 flex items-center justify-center overflow-hidden border border-brand/20">
                  <img
                    src="/logo-transparent.png"
                    alt="Borynx Logo"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-base font-bold tracking-tight text-foreground leading-none">
                    Borynx
                  </span>
                  <span className="hidden sm:inline-flex rounded-md border border-border px-1.5 py-0.5 font-body text-[10px] font-semibold text-muted-foreground leading-none">
                    BETA
                  </span>
                </div>
              </Link>
            </div>
          </div>

          {/* Search Bar (Command Center) */}
          <div className={cn(
            "transition-all duration-500 z-20",
            isSearchExpanded ? "absolute inset-x-0 top-0 z-40 flex h-full items-center justify-center bg-background px-4" : "relative mx-auto hidden min-w-0 max-w-[640px] flex-1 lg:flex"
          )}>
            {/* Desktop Search (Flexible width like Reddit) */}
            <div className={cn(
              "hidden lg:flex items-center w-full max-w-[720px] h-10 rounded-radius-xl px-4 group transition-all duration-300 theme-transition",
              theme === 'light' ? "bg-muted/40 border border-border hover:bg-muted/60 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand" : "bg-muted/20 border border-border hover:bg-muted/30 focus-within:border-brand focus-within:ring-1 focus-within:ring-brand",
              isSearchExpanded && "hidden"
            )}>
              <Search className="h-4 w-4 text-muted-foreground mr-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search posts and people"
                aria-label="Search posts and people"
                className="bg-transparent border-none outline-none w-full font-body text-sm text-foreground placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded-md border border-border bg-background/50 tabular-nums text-[9px] text-muted-foreground ml-2">
                <span className="opacity-70">⌘</span>K
              </div>

              {/* Instant Results Dropdown (Desktop) */}
              <div className={cn(
                "hidden group-focus-within:block absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-2xl z-50 p-2 max-h-[480px] overflow-auto scrollbar-stealth theme-transition",
                (!searchQuery || (allResults.length === 0 && !isSearching && !searchError)) && "group-focus-within:hidden"
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
                        <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground">People</p>
                        {searchResults.users.map((u, i) => (
                          <button
                            key={u.uid}
                            onClick={() => handleNav(`/f/${u.username || u.uid}`)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className={cn(
                              "flex items-center gap-3 w-full p-2 rounded-lg transition-all text-left",
                              activeIndex === i ? "bg-muted" : "hover:bg-white/5"
                            )}
                          >
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
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
                        <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground mt-2">Posts</p>
                        {searchResults.posts.map((p, i) => {
                          const idx = searchResults.users.length + i;
                          return (
                            <button
                              key={p.id}
                              onClick={() => handleNav(p.category ? `/b/${p.category}/p/${p.id}` : `/p/${p.id}`)}
                              onMouseEnter={() => setActiveIndex(idx)}
                              className={cn(
                                "flex items-center gap-3 w-full p-2 rounded-lg transition-all text-left",
                                activeIndex === idx ? "bg-muted" : "hover:bg-white/5"
                              )}
                            >
                              <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                {p.type === 'resource' ? <Sparkles className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
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

                    {searchError && <p role="alert" className="p-4 text-xs text-destructive">Search unavailable. Check your connection and try again.</p>}
                    {searchQuery && allResults.length === 0 && !isSearching && !searchError && (
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
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <input
                    ref={mobileInputRef}
                    autoFocus
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search posts and people"
                    aria-label="Search posts and people"
                    className="bg-transparent border-none outline-none w-full font-body text-sm text-foreground placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => { setIsSearchExpanded(false); setSearchQuery(""); }} aria-label="Close search" className="p-2 hover:bg-muted rounded-full">
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
                          <div className="h-10 w-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
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
                            {p.type === 'resource' ? <Sparkles className="h-5 w-5 text-muted-foreground" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-semibold text-foreground truncate">{p.title}</div>
                            <div className="text-xs text-muted-foreground truncate opacity-60">#{p.tags?.join(' #')}</div>
                          </div>
                        </button>
                      ))}

                      {searchError && <p role="alert" className="p-4 text-xs text-destructive">Search unavailable. Check your connection and try again.</p>}
                    {searchQuery && allResults.length === 0 && !isSearching && !searchError && (
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

          {user ? (
            <div className={`flex items-center gap-2 lg:gap-3 shrink-0 ml-auto ${isSearchExpanded ? "hidden" : "flex"}`}>
              <button
                onClick={() => setIsSearchExpanded(true)}
                aria-label="Search"
                className="lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-full transition-colors"
              >
                <Search className="h-5 w-5" />
              </button>

              <Link to="/submit" className="flex items-center gap-1.5 h-9 px-3 sm:px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-radius-md transition-colors font-body text-sm font-semibold">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Create</span>
              </Link>

              <NotificationBell />

              <div className="relative">
                <button
                  onClick={() => setIsAvatarMenuOpen(prev => !prev)}
                  className={cn(
                    "flex items-center justify-center h-7 w-7 rounded-full ml-1 focus:outline-none relative border-[2px] transition-all z-50",
                    isAvatarMenuOpen ? "border-brand ring-4 ring-brand/10" : "border-white/10"
                  )}
                >
                  <div className="h-full w-full rounded-full overflow-hidden bg-brand/10 hover:bg-brand/20 transition-colors flex items-center justify-center">
                    <img
                      src={profile?.avatarUrl || user?.user_metadata?.avatar_url || ""}
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
                      className="font-heading text-xs font-bold text-brand flex items-center justify-center h-full w-full"
                      style={{ display: (profile?.avatarUrl || user?.user_metadata?.avatar_url) ? 'none' : 'flex' }}
                    >
                      {profile?.initial || user?.user_metadata?.display_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                </button>


              </div>
            </div>
          ) : (
            <div className={`ml-auto flex shrink-0 items-center gap-2 ${isSearchExpanded ? "hidden" : ""}`}>
              <button type="button" onClick={() => setIsSearchExpanded(true)} aria-label="Search" className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"><Search className="h-5 w-5" /></button>
              <Link to="/login" className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-foreground hover:bg-muted">Sign in</Link>
              <Link to="/signup" className="hidden min-h-10 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground sm:inline-flex">Join free</Link>
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
              className="fixed top-[3.75rem] right-4 w-[240px] bg-card border border-border rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-[999] overflow-hidden theme-transition"
            >
              <div className="py-2">
                <button
                  onClick={() => { router.push(user ? `/f/${profile?.username || user.uid}` : '/login'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground group"
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">View Profile</span>
                </button>

                {/* Public work availability, not a fake online presence indicator. */}
                <button
                  type="button"
                  onClick={() => profileError ? refetchProfile() : void toggleAvailability()}
                  disabled={!profile && !profileError || availabilityPending}
                  aria-label={profileError ? "Retry loading work status" : "Toggle public work availability"}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground disabled:opacity-60"
                >
                  <Briefcase className={`h-4 w-4 shrink-0 ${isAvailable ? "text-success" : ""}`} />
                  <span className="flex items-center gap-2">
                    {profileError ? "Work status unavailable · Retry" : !profile ? "Loading work status…" : isAvailable ? "Open to work" : "Not open to work"}
                    {profile && <span className={`h-1.5 w-1.5 rounded-full ${isAvailable ? "bg-success" : "bg-muted-foreground"}`} />}
                  </span>
                </button>

                <button
                  onClick={() => { router.push('/drafts'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground group"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Drafts</span>
                </button>

                <button
                  onClick={() => { router.push('/premium'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground group"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Premium</span>
                </button>

                <button
                  onClick={() => { setIsThemeModalOpen(true); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground group"
                >
                  <Moon className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Display Mode</span>
                </button>

                <div className="h-[1px] bg-white/5 my-1" />

                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-destructive group"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="flex items-center">Log Out</span>
                </button>

                <button
                  onClick={() => { router.push('/settings'); setIsAvatarMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground group"
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
              "rounded-full w-8 h-8 flex items-center justify-center p-0 border border-border transition-all duration-300 hover:scale-110 active:scale-95 pointer-events-auto",
              "bg-background"
            )}
          />
        </div>

        <main className="flex-1 overflow-y-auto bg-background relative flex flex-col">
          <div className="flex-1 min-w-0 p-2 sm:p-4 lg:p-6">
            {isDemoMode && <div role="note" className="mb-4 rounded-radius-md border border-warning/50 bg-warning/10 px-4 py-2 text-[11px] text-foreground">Demo mode · Content and uploads are stored in this browser only. Opportunities here are not real client jobs.</div>}
            {/* Phase 2B.4: a provisioning failure is surfaced here, not as a logout. */}
            <ProfileProvisioningNotice />
            <Breadcrumbs />
            {children}
          </div>

          <footer className="border-t border-border px-4 py-3 text-[10px] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Borynx
          </footer>
        </main>
      </div>

      {user && <VeteranCelebration />}

      {/* Global Theme Selection Modal (Reddit Style) */}
      <AnimatePresence>
        {isThemeModalOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsThemeModalOpen(false)}
              className="fixed inset-0 bg-black/60 z-[9998]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "relative z-[9999] w-full max-w-[420px] rounded-[20px] shadow-2xl overflow-hidden theme-transition",
                theme === 'light' ? "bg-card border border-black/5" : "bg-card border border-border"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="text-lg font-bold text-foreground">Display Mode</h2>
                <button
                  onClick={() => setIsThemeModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-muted-foreground transition-colors"
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
                        theme === id ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className={cn(
                        "text-sm font-medium transition-colors",
                        theme === id ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        {label}
                      </span>
                    </div>
                    {theme === id && (
                      <Check className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="p-5 flex justify-end border-t border-border">
                <button
                  onClick={() => setIsThemeModalOpen(false)}
                  className="px-8 py-2.5 rounded-full bg-brand hover:opacity-90 text-white text-sm font-bold transition-all shadow-lg shadow-brand/20"
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
