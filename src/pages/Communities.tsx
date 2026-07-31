import { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  Code2,
  Palette,
  Briefcase,
  Megaphone,
  Leaf,
  TrendingUp,
  Compass,
  Plus,
  MoreHorizontal,
  ChevronRight,
  ChevronLeft,
  Users,
  FileText,
  ChevronDown,
  Globe,
  Zap,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAllCommunities,
  joinCommunity,
  leaveCommunity,
  getUserCommunities,
  getCommunityStyle,
  CommunityData,
} from "@/lib/communities";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { CreateCommunityModal } from "@/components/modals/CreateCommunityModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Category definitions. Counts are computed live from fetched communities
// below — not hardcoded — so they stay accurate as spaces are created.
const CATEGORY_DEFS = [
  { id: "All", label: "All Spaces", icon: Compass },
  { id: "Development", label: "Development", icon: Code2 },
  { id: "Design", label: "Design", icon: Palette },
  { id: "Business", label: "Business", icon: Briefcase },
  { id: "Marketing", label: "Marketing", icon: Megaphone },
  { id: "Lifestyle", label: "Lifestyle", icon: Leaf },
];

// Icon + colors now come straight from the community's real category via
// getCommunityStyle() (see lib/communities.ts) instead of guessing from slug text.
const getSpaceIcon = (category: string) => getCommunityStyle(category).icon;
const getSpaceIconBg = (category: string) => getCommunityStyle(category).iconBg;

const Communities = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // State
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"active" | "members" | "newest">("active");
  const [visibleCount, setVisibleCount] = useState(8);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Fetch communities
  const { data: communities = [], isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const { data: joinedSlugList = [] } = useQuery({
    queryKey: ["userCommunities", user?.uid],
    queryFn: () => (user?.uid ? getUserCommunities(user.uid) : []),
    enabled: !!user?.uid,
  });

  const joinedSlugs = useMemo(() => {
    return Object.fromEntries(joinedSlugList.map((slug) => [slug, true]));
  }, [joinedSlugList]);

  const joinMutation = useMutation({
    mutationFn: ({ slug }: { slug: string }) => {
      if (!user) throw new Error("Please log in to join spaces");
      return joinCommunity(user.uid, slug);
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["userCommunities", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success(`Joined b/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to join space"),
  });

  const leaveMutation = useMutation({
    mutationFn: ({ slug }: { slug: string }) => {
      if (!user) throw new Error("Please log in");
      return leaveCommunity(user.uid, slug);
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ["userCommunities", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      toast.success(`Left b/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to leave space"),
  });

  const handleToggleJoin = (slug: string, isJoined: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isJoined) {
      leaveMutation.mutate({ slug });
    } else {
      joinMutation.mutate({ slug });
    }
  };

  // Filtered & Sorted Communities
  const filteredCommunities = useMemo(() => {
    return communities.filter((c) => {
      const matchesCat = selectedCategory === "All" || c.category === selectedCategory;
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.slug.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [communities, selectedCategory, searchQuery]);

  const featuredSpaces = useMemo(() => {
    return communities.slice(0, 3);
  }, [communities]);

  // communities is already sorted by memberCount desc (see fetchAllCommunities),
  // so the top 5 here are genuinely the top 5 — no fake placeholder data.
  const trendingSpaces = useMemo(() => {
    return communities.slice(0, 5).map((c, idx) => ({
      rank: idx + 1,
      name: c.name,
      slug: c.slug,
      count: `${c.memberCount.toLocaleString()} members`,
      icon: getSpaceIcon(c.category),
    }));
  }, [communities]);

  const categories = useMemo(() => {
    return CATEGORY_DEFS.map((def) => ({
      ...def,
      count: def.id === "All" ? communities.length : communities.filter((c) => c.category === def.id).length,
    }));
  }, [communities]);

  // Spaces the current user has actually joined, for the "My Spaces" sidebar widget.
  const mySpaces = useMemo(() => {
    return communities.filter((c) => joinedSlugs[c.slug]).slice(0, 3);
  }, [communities, joinedSlugs]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1340px] px-4 py-6 md:px-6">
        {/* Main 2-column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed Column (8 cols) */}
          <div className="lg:col-span-8 space-y-7">
            {/* Page Title & Subtitle */}
            <div>
              <h1 className="font-heading text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Borynx Spaces
              </h1>
              <p className="font-body text-sm text-muted-foreground mt-1">
                Join communities, share knowledge, and grow together.
              </p>
            </div>

            {/* Search, Filter & Sort Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground/70" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search spaces..."
                  className="pl-9 pr-10 bg-card border-border/60 text-sm focus-visible:ring-primary h-10 rounded-xl"
                />
                <div className="absolute right-3 top-2.5 flex items-center gap-1 text-[10px] text-muted-foreground/50 bg-secondary/60 px-1.5 py-0.5 rounded border border-border/40">
                  <span>⌘K</span>
                </div>
              </div>

              <Button
                variant="outline"
                className="h-10 border-border/60 bg-card text-xs font-semibold gap-2 px-3.5 text-muted-foreground hover:text-foreground rounded-xl"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
              </Button>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="h-10 bg-card border border-border/60 rounded-xl px-3.5 text-xs font-semibold text-foreground focus:outline-none cursor-pointer appearance-none pr-8"
                >
                  <option value="active">Sort: Active</option>
                  <option value="members">Sort: Members</option>
                  <option value="newest">Sort: Newest</option>
                </select>
                <ChevronDown className="absolute right-3 top-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            {/* Category Filter Pills Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/10"
                        : "bg-card text-muted-foreground border-border/40 hover:text-foreground hover:border-border"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                        isSelected ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span>{cat.label}</span>
                    <span className="text-[10px] opacity-60 font-mono">({cat.count})</span>
                  </button>
                );
              })}
            </div>

            {/* Featured Spaces Section */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="font-heading text-sm font-semibold text-foreground">Featured Spaces</h2>
                <div className="flex items-center gap-2">
                  <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                    View all
                  </button>
                  <div className="flex items-center gap-1">
                    <button className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Featured Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featuredSpaces.map((space, idx) => {
                  const isJoined = !!joinedSlugs[space.slug];
                  const Icon = getSpaceIcon(space.category);
                  const style = getCommunityStyle(space.category);

                  return (
                    <motion.div
                      key={space.slug}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => navigate(`/b/${space.slug}`)}
                      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 flex flex-col justify-between h-[210px] shadow-sm"
                    >
                      {/* Background Visual Art / Mesh */}
                      <div
                        className={`absolute inset-0 opacity-10 dark:opacity-20 transition-opacity group-hover:opacity-25 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${style.bgGradient}`}
                      />

                      {/* Top Header Row with Badge */}
                      <div className="relative z-10 flex items-start justify-between">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl border ${style.iconBg}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        {space.badge && (
                          <Badge
                            className={`text-[10px] font-semibold tracking-wide border-0 px-2 py-0.5 ${
                              space.badge === "Trending"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30"
                                : space.badge === "Most Active"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/30"
                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30"
                            }`}
                          >
                            {space.badge}
                          </Badge>
                        )}
                      </div>

                      {/* Content */}
                      <div className="relative z-10 mt-3">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-heading text-base font-bold text-foreground group-hover:text-primary transition-colors">
                            {space.name}
                          </h3>
                          {space.isVerified && (
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                              ✓
                            </span>
                          )}
                        </div>
                        <p className="font-body text-xs text-muted-foreground/90 line-clamp-2 mt-1 leading-relaxed">
                          {space.description}
                        </p>
                      </div>

                      {/* Footer Stats */}
                      <div className="relative z-10 flex items-center gap-2 pt-2 text-[11px] font-medium text-muted-foreground/80 border-t border-border/30">
                        <span>{(space.memberCount || 0).toLocaleString()} members</span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {space.onlineCount || 100} online
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* All Spaces Section */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading text-base font-bold text-foreground">All Spaces</h2>
                <span className="text-xs text-muted-foreground font-mono">
                  Showing {filteredCommunities.length} spaces
                </span>
              </div>

              {/* Space List Rows */}
              <div className="space-y-2.5">
                {filteredCommunities.slice(0, visibleCount).map((space) => {
                  const isJoined = !!joinedSlugs[space.slug];
                  const Icon = getSpaceIcon(space.category);

                  return (
                    <div
                      key={space.slug}
                      onClick={() => navigate(`/b/${space.slug}`)}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/40 hover:border-border/80 transition-all cursor-pointer shadow-sm"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${getSpaceIconBg(
                            space.category
                          )}`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {space.name}
                            </h3>
                            {space.isVerified && (
                              <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="font-body text-xs text-muted-foreground truncate mt-0.5">
                            {space.description}
                          </p>
                        </div>
                      </div>

                      {/* Stats & Action */}
                      <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground/80 font-medium">
                          <div className="text-right">
                            <div className="font-semibold text-foreground text-xs">
                              {space.memberCount >= 1000
                                ? `${(space.memberCount / 1000).toFixed(1)}K`
                                : space.memberCount}{" "}
                              <span className="text-[11px] text-muted-foreground font-normal">Members</span>
                            </div>
                            <div className="flex items-center gap-1 justify-end text-[10px] text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              {space.onlineCount} Online
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            onClick={(e) => handleToggleJoin(space.slug, isJoined, e)}
                            size="sm"
                            variant={isJoined ? "secondary" : "default"}
                            className={`h-8 px-4 text-xs font-semibold rounded-lg transition-all ${
                              isJoined
                                ? "bg-secondary/80 text-foreground hover:bg-secondary"
                                : "bg-primary text-primary-foreground hover:opacity-90"
                            }`}
                          >
                            {isJoined ? "Joined ✓" : "Join"}
                          </Button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toast.info(`Options for b/${space.slug}`);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60 transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {visibleCount < filteredCommunities.length && (
                <div className="text-center pt-5">
                  <Button
                    onClick={() => setVisibleCount((prev) => prev + 5)}
                    variant="outline"
                    className="h-9 px-6 text-xs font-semibold border-border/60 text-muted-foreground hover:text-foreground rounded-xl"
                  >
                    Load more spaces <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. Create a Space Widget */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/20">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-heading text-sm font-bold text-foreground">Create a Space</h3>
                  <p className="font-body text-[11px] text-muted-foreground">
                    Start your own B-Space & community.
                  </p>
                </div>
              </div>

              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                Start your own B-Space and build a community around your passion or expertise.
              </p>

              <CreateCommunityModal>
                <Button className="w-full h-9 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:opacity-90 gap-1.5 shadow-sm shadow-primary/20">
                  <Plus className="h-4 w-4" /> Create Space
                </Button>
              </CreateCommunityModal>

              <button className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                Learn more <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {/* 2. My Spaces Widget */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">My Spaces</h3>
                <button
                  onClick={() => navigate("/communities")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  View all
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                {mySpaces.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">
                    You haven't joined any spaces yet. Join one below to see it here.
                  </p>
                )}
                {mySpaces.map((mySpace) => {
                  const Icon = getSpaceIcon(mySpace.category);
                  const style = getCommunityStyle(mySpace.category);
                  return (
                    <Link
                      key={mySpace.slug}
                      to={`/b/${mySpace.slug}`}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/60 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${style.iconBg}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-body text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {mySpace.name}
                        </span>
                      </div>
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30 text-[10px] font-bold px-2 py-0.5 border-0">
                        {mySpace.memberCount.toLocaleString()}
                      </Badge>
                    </Link>
                  );
                })}
              </div>

              <div className="pt-1">
                <Link
                  to="/communities"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  View all my spaces <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* 3. Trending This Week Widget */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Top Communities</h3>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-2.5 pt-1">
                {trendingSpaces.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.slug}
                      onClick={() => navigate(`/b/${item.slug}`)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-muted-foreground/60 w-3">
                          {item.rank}
                        </span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="font-body text-xs font-semibold text-foreground">
                            {item.name}
                          </div>
                          <div className="font-body text-[10px] text-muted-foreground">
                            {item.count}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4. Why Join a B-Space? Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3.5 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground">Why join a B-Space?</h3>

              <div className="space-y-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <strong className="text-foreground font-semibold block">Share knowledge</strong>
                    Learn and teach with experts and peers.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Globe className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <strong className="text-foreground font-semibold block">Grow your network</strong>
                    Connect with like-minded professionals.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <strong className="text-foreground font-semibold block">Stay updated</strong>
                    Get the latest resources and insights in your field.
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <strong className="text-foreground font-semibold block">Level up together</strong>
                    Collaborate, get feedback and achieve more.
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40">
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                  Learn more about B-Spaces <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </AppLayout>
    );
  };

export default Communities;
