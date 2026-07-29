import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNowStrict } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCommunity, joinCommunity, leaveCommunity, getUserCommunities } from "@/lib/communities";
import { fetchPostsByCommunity } from "@/lib/posts";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile } from "@/lib/users";
import { toast } from "sonner";
import { VoteControls } from "@/components/VoteControls";
import {
  ArrowLeft,
  Code2,
  Users,
  UserPlus,
  MoreHorizontal,
  PenTool,
  HelpCircle,
  FileText,
  BarChart2,
  MessageSquare,
  Repeat,
  Bookmark,
  Flame,
  FileCode,
  Calendar,
  Play,
  CheckCircle2,
  Share2,
  ExternalLink,
  Plus,
  Lock,
  Globe,
  Award,
  Sparkles,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Real posts for this community are loaded inside the component via
// fetchPostsByCommunity(slug) — see the useQuery below.

const CommunityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<"Feed" | "Discussions" | "Resources" | "Members" | "Events" | "About">("Feed");
  const [localPosts, setLocalPosts] = useState<any[]>([]);
  const [hasLoadedRealPosts, setHasLoadedRealPosts] = useState(false);
  const [votedPolls, setVotedPolls] = useState<Record<string, string>>({});

  // Query space data
  const { data: community, isLoading: isCommunityLoading } = useQuery({
    queryKey: ["community", slug],
    queryFn: () => (slug ? fetchCommunity(slug) : null),
    enabled: !!slug,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user?.uid ? getUserProfile(user.uid) : null),
    enabled: !!user?.uid,
  });

  const { data: realPosts = [] } = useQuery({
    queryKey: ["communityPosts", slug],
    queryFn: () => (slug ? fetchPostsByCommunity(slug) : []),
    enabled: !!slug,
  });

  // Same flat-shape adapter used on Index.tsx, so none of this page's
  // rendering markup below needs to change.
  const mappedRealPosts = useMemo(() => {
    return realPosts.map((p) => ({
      id: p.id,
      authorName: p.author?.name || "Unknown",
      authorAvatar: p.author?.avatar || p.author?.avatarUrl,
      isVerified: p.author?.isVerifiedPro || false,
      timeAgo: p.createdAt ? formatDistanceToNowStrict(new Date(p.createdAt), { addSuffix: true }) : "recently",
      badge: (p.type || "discussion").toUpperCase(),
      badgeColor: "bg-[var(--brand-primary-soft)] text-[var(--brand-primary)] border-[var(--brand-primary)]/30",
      type: p.type,
      title: p.title,
      body: p.body,
      hasCodePreview: false,
      tags: p.tags || [],
      likes: p.score || 0,
      comments: p.commentCount || 0,
      shares: 0,
      isLiked: false,
      isBookmarked: false,
    }));
  }, [realPosts]);

  useEffect(() => {
    setHasLoadedRealPosts(false);
  }, [slug]);

  useEffect(() => {
    if (!hasLoadedRealPosts) {
      setLocalPosts(mappedRealPosts);
      if (mappedRealPosts.length > 0 || realPosts.length === 0) {
        setHasLoadedRealPosts(true);
      }
    }
  }, [mappedRealPosts, hasLoadedRealPosts, realPosts]);

  const { data: joinedSlugs = [] } = useQuery({
    queryKey: ["userCommunities", user?.uid],
    queryFn: () => (user?.uid ? getUserCommunities(user.uid) : []),
    enabled: !!user?.uid,
  });

  const isJoined = useMemo(() => {
    if (!slug) return false;
    return joinedSlugs.includes(slug);
  }, [joinedSlugs, slug]);

  const joinMutation = useMutation({
    mutationFn: () => {
      if (!user?.uid) throw new Error("Please sign in to join a space");
      if (!slug) throw new Error("Unknown space");
      return joinCommunity(user.uid, slug);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCommunities", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      toast.success(`Joined b/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to join space"),
  });

  const leaveMutation = useMutation({
    mutationFn: () => {
      if (!user?.uid) throw new Error("Please sign in first");
      if (!slug) throw new Error("Unknown space");
      return leaveCommunity(user.uid, slug);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userCommunities", user?.uid] });
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
      toast.success(`Left b/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to leave space"),
  });

  const handleOpenComposer = (type: "post" | "question" | "resource" | "poll") => {
    const mappedType = type === "post" ? "discussion" : type;
    navigate(`/submit?type=${mappedType}&space=${slug}`);
  };

  const handleToggleLike = (postId: string) => {
    setLocalPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isLiked = !p.isLiked;
          return { ...p, isLiked, likes: isLiked ? p.likes + 1 : p.likes - 1 };
        }
        return p;
      })
    );
  };

  const handleToggleBookmark = (postId: string) => {
    setLocalPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isBookmarked = !p.isBookmarked;
          toast.success(isBookmarked ? "Post saved to bookmarks" : "Removed from bookmarks");
          return { ...p, isBookmarked };
        }
        return p;
      })
    );
  };

  const handleVotePoll = (postId: string, optId: string) => {
    setVotedPolls((prev) => ({ ...prev, [postId]: optId }));
    toast.success("Vote recorded!");
  };

  // Filter posts based on tab
  const filteredPosts = useMemo(() => {
    if (activeTab === "Discussions") {
      return localPosts.filter((p) => p.type === "discussion" || p.type === "question");
    }
    if (activeTab === "Resources") {
      return localPosts.filter((p) => p.type === "resource");
    }
    return localPosts;
  }, [localPosts, activeTab]);

  const spaceName = community?.name || (slug === "frontend-hub" ? "Frontend Hub" : slug || "Frontend Hub");
  const spaceDesc =
    community?.description ||
    "A community for frontend developers to learn, share, and grow together.";

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1340px] px-4 py-5 md:px-6">
        {/* Back Button */}
        <button
          onClick={() => navigate("/communities")}
          className="inline-flex items-center gap-1.5 mb-5 font-body text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Spaces
        </button>

        {/* Space Banner Hero Card */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-6 mb-6 shadow-sm">
          {/* Subtle Ambient Background Mesh */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Logo & Details */}
            <div className="flex items-start md:items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-800 text-white shadow-xl shadow-purple-600/20 border border-purple-400/30">
                <Code2 className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-xl md:text-2xl font-bold text-foreground tracking-tight">
                    {spaceName}
                  </h1>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    ✓
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 text-primary" /> Public Space
                  </span>
                  <span>•</span>
                  <span>{(community?.memberCount || 2600).toLocaleString()} members</span>
                </div>

                <p className="font-body text-xs text-muted-foreground/90 max-w-2xl pt-0.5 leading-relaxed">
                  {spaceDesc}
                </p>

                {/* Stacked Avatars */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex -space-x-2 overflow-hidden">
                    {[
                      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
                      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
                      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
                      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80",
                    ].map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Member"
                        className="inline-block h-6 w-6 rounded-full ring-2 ring-[#0e0f14] object-cover"
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-card/60 px-2 py-0.5 rounded-full border border-border/40">
                    +24
                  </span>
                </div>
              </div>
            </div>

            {/* Right Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0 self-start md:self-center">
              <Button
                onClick={() => toast.success("Invite link copied to clipboard!")}
                variant="outline"
                className="h-9 px-4 text-xs font-semibold border-border/60 bg-secondary/40 text-foreground hover:bg-secondary gap-1.5 rounded-xl"
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </Button>

              <Button
                onClick={() => (isJoined ? leaveMutation.mutate() : joinMutation.mutate())}
                className={`h-9 px-5 text-xs font-semibold rounded-xl transition-all ${
                  isJoined
                    ? "bg-secondary text-foreground hover:bg-secondary/80"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                }`}
              >
                {isJoined ? "Joined ▾" : "Join Space"}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-6 border-b border-border/60 mb-6 overflow-x-auto no-scrollbar">
          {(["Feed", "Discussions", "Resources", "Members", "Events", "About"] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative pb-3 text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
                {isActive && (
                  <motion.div
                    layoutId="activeSpaceTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {activeTab === "Feed" || activeTab === "Discussions" || activeTab === "Resources" ? (
              <>
                {/* Create Post Input Widget */}
                <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
                  <div
                    onClick={() => handleOpenComposer("post")}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <img
                      src={user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                      alt="User"
                      className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/40"
                    />
                    <div className="flex-1 bg-muted/60 hover:bg-muted border border-border/40 rounded-xl px-4 py-2.5 text-xs text-muted-foreground transition-colors">
                      Share something with the space...
                    </div>
                  </div>

                  {/* Quick Action triggers */}
                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
                    <button
                      onClick={() => handleOpenComposer("post")}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <PenTool className="h-3.5 w-3.5 text-primary" />
                      <span>Post</span>
                    </button>
                    <button
                      onClick={() => handleOpenComposer("question")}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Question</span>
                    </button>
                    <button
                      onClick={() => handleOpenComposer("resource")}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <FileText className="h-3.5 w-3.5 text-purple-500" />
                      <span>Resource</span>
                    </button>
                    <button
                      onClick={() => handleOpenComposer("poll")}
                      className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Poll</span>
                    </button>
                  </div>
                </div>

                {/* Posts Feed */}
                <div className="space-y-4">
                  {filteredPosts.map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 hover:border-border transition-all shadow-sm"
                    >
                      {/* Author Header Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img
                            src={post.authorAvatar}
                            alt={post.authorName}
                            className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/40"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-heading text-xs font-bold text-foreground">
                                {post.authorName}
                              </span>
                              {post.isVerified && (
                                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                                  ✓
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground/60">• {post.timeAgo}</span>
                            </div>
                          </div>
                        </div>

                        {/* Category Badge */}
                        <Badge
                          className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 border ${post.badgeColor}`}
                        >
                          {post.badge}
                        </Badge>
                      </div>

                      {/* Content Body */}
                      <div className="space-y-2">
                        <h3 className="font-heading text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
                          {post.title}
                        </h3>
                        <p className="font-body text-xs text-muted-foreground/90 leading-relaxed">
                          {post.body}
                        </p>
                      </div>

                      {/* Code or Video Thumbnail if present */}
                      {post.hasCodePreview && (
                        <div className="rounded-xl border border-border/60 bg-muted/60 p-4 text-xs font-mono text-purple-600 dark:text-purple-300 overflow-x-auto flex items-center justify-between">
                          <div>
                            <div className="text-muted-foreground/70 text-[10px] mb-1">// StickyNav.tsx</div>
                            <code>{`const StickyNav = () => { useScrollPosition(); return <nav className="sticky top-0 z-50">...</nav>; };`}</code>
                          </div>
                          <FileCode className="h-8 w-8 text-purple-500/40 shrink-0 ml-4" />
                        </div>
                      )}

                      {post.hasVideoPreview && (
                        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-purple-900/30 via-indigo-900/20 to-slate-900/20 p-8 flex flex-col items-center justify-center text-center cursor-pointer group">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 group-hover:scale-110 transition-transform">
                            <Play className="h-5 w-5 fill-current ml-0.5" />
                          </div>
                          <div className="mt-3 font-heading text-xs font-bold text-foreground">
                            12 Animations with Framer Motion
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-0.5">Click to play preview video</span>
                        </div>
                      )}

                      {/* Interactive Poll */}
                      {post.type === "poll" && post.pollOptions && (
                        <div className="space-y-2 pt-1">
                          {post.pollOptions.map((opt) => {
                            const isVoted = votedPolls[post.id] === opt.id;
                            return (
                              <button
                                key={opt.id}
                                onClick={() => handleVotePoll(post.id, opt.id)}
                                className={`w-full text-left relative overflow-hidden rounded-xl border p-3 text-xs font-semibold transition-all ${
                                  isVoted
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/60 bg-card/40 text-foreground hover:bg-card/70"
                                }`}
                              >
                                <div
                                  className="absolute top-0 bottom-0 left-0 bg-primary/15 transition-all duration-500"
                                  style={{ width: `${opt.percent}%` }}
                                />
                                <div className="relative z-10 flex items-center justify-between">
                                  <span>{opt.label}</span>
                                  <span className="font-mono text-[11px] font-bold text-muted-foreground">
                                    {opt.percent}%
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                          <div className="text-[11px] text-muted-foreground font-medium pt-1">
                            {post.totalVotes} votes • Ends in {post.endsIn}
                          </div>
                        </div>
                      )}

                      {/* Hashtags */}
                      {Array.isArray(post.tags) && post.tags.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              className="font-mono text-[11px] font-medium text-muted-foreground/70 hover:text-primary cursor-pointer"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Engagements Footer Bar */}
                      <div className="flex items-center justify-between pt-3 border-t border-border/30 text-xs text-muted-foreground/80 font-medium">
                        <div className="flex items-center gap-5">
                          <VoteControls score={post.likes} entityId={post.id} type="post" orientation="horizontal" />

                          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                            <MessageSquare className="h-4 w-4" />
                            <span>{post.comments}</span>
                          </button>

                          <button
                            onClick={() => toast.success("Post link copied!")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                          >
                            <Repeat className="h-4 w-4" />
                            <span>{post.shares}</span>
                          </button>
                        </div>

                        <button
                          onClick={() => handleToggleBookmark(post.id)}
                          className={`p-1 rounded transition-colors ${
                            post.isBookmarked ? "text-primary" : "hover:text-foreground"
                          }`}
                        >
                          <Bookmark className={`h-4 w-4 ${post.isBookmarked ? "fill-current" : ""}`} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </>
            ) : activeTab === "Members" ? (
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 shadow-sm">
                <h3 className="font-heading text-base font-bold text-foreground">Space Members (2.6K)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: "MarceloDev", role: "Admin", points: "1,245", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" },
                    { name: "SarahWrites", role: "Moderator", points: "980", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" },
                    { name: "TechStart Inc.", role: "Moderator", points: "860", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80" },
                    { name: "BrightKey", role: "Member", points: "690", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
                    { name: "Waverly", role: "Member", points: "540", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80" },
                    { name: "NeonByte", role: "Member", points: "310", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80" },
                  ].map((m) => (
                    <div key={m.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/40">
                      <div className="flex items-center gap-3">
                        <img src={m.avatar} alt={m.name} className="h-9 w-9 rounded-xl object-cover" />
                        <div>
                          <div className="font-heading text-xs font-bold text-foreground">{m.name}</div>
                          <div className="font-body text-[10px] text-muted-foreground">{m.role}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1">
                        <Flame className="h-3 w-3 fill-amber-500 dark:fill-amber-400" /> {m.points}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeTab === "Events" ? (
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 shadow-sm">
                <h3 className="font-heading text-base font-bold text-foreground">Upcoming Space Events</h3>
                <div className="space-y-3">
                  {[
                    { title: "Build a Portfolio That Converts", host: "SarahWrites", date: "May 24, 2026", time: "6:00 PM", day: "24", month: "MAY" },
                    { title: "Framer Motion Deep Dive & Live Q&A", host: "BrightKey", date: "May 31, 2026", time: "7:00 PM", day: "31", month: "MAY" },
                  ].map((ev) => (
                    <div key={ev.title} className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border/40">
                      <div className="flex flex-col items-center justify-center h-12 w-12 rounded-xl bg-primary/15 text-primary border border-primary/20 shrink-0 font-bold">
                        <span className="text-[10px] uppercase font-mono">{ev.month}</span>
                        <span className="text-base leading-none">{ev.day}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-heading text-sm font-bold text-foreground">{ev.title}</h4>
                        <p className="font-body text-xs text-muted-foreground">with {ev.host} • {ev.date} at {ev.time}</p>
                      </div>
                      <Button size="sm" className="bg-primary text-primary-foreground text-xs font-semibold rounded-xl">
                        RSVP
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-4 text-xs text-muted-foreground leading-relaxed shadow-sm">
                <h3 className="font-heading text-base font-bold text-foreground">About Frontend Hub</h3>
                <p>Welcome to Frontend Hub! We are an open community dedicated to modern frontend engineering, UI/UX architecture, performance optimizations, and building developer tools.</p>
                <div className="space-y-2 pt-2">
                  <h4 className="font-bold text-foreground text-xs">Community Rules:</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Be respectful and constructive in code reviews and discussions.</li>
                    <li>No direct self-promotion without context. Share resources in the Resources tab.</li>
                    <li>Use code blocks and proper formatting when sharing code snippets.</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            {/* 1. About This Space Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground">About this space</h3>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">
                Share knowledge, solve problems, and build better on the frontend.
              </p>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30 text-center">
                <div className="p-2 rounded-xl bg-muted/40">
                  <div className="font-heading text-sm font-bold text-foreground">2.6K</div>
                  <div className="text-[10px] text-muted-foreground">Members</div>
                </div>
                <div className="p-2 rounded-xl bg-muted/40">
                  <div className="font-heading text-sm font-bold text-emerald-600 dark:text-emerald-400">312</div>
                  <div className="text-[10px] text-muted-foreground">Online</div>
                </div>
                <div className="p-2 rounded-xl bg-muted/40">
                  <div className="font-heading text-sm font-bold text-primary">48</div>
                  <div className="text-[10px] text-muted-foreground">Posts today</div>
                </div>
              </div>
            </div>

            {/* 2. Created By Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Created by
              </h3>
              <div className="flex items-center gap-3">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  alt="MarceloDev"
                  className="h-10 w-10 rounded-xl object-cover ring-1 ring-border/40"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-heading text-xs font-bold text-foreground">MarceloDev</span>
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      ✓
                    </span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-primary/30 text-primary">
                      Admin
                    </Badge>
                  </div>
                  <p className="font-body text-[11px] text-muted-foreground">
                    Frontend developer & product builder.
                  </p>
                  <p className="font-body text-[10px] text-muted-foreground/60 mt-0.5">Created Jan 2024</p>
                </div>
              </div>
            </div>

            {/* 3. Top Members Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Top Members</h3>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {[
                  { rank: 1, name: "MarceloDev", role: "Admin", score: "1,245", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" },
                  { rank: 2, name: "SarahWrites", role: "Moderator", score: "980", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" },
                  { rank: 3, name: "TechStart Inc.", role: "Moderator", score: "860", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80" },
                  { rank: 4, name: "BrightKey", role: "", score: "690", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
                  { rank: 5, name: "Waverly", role: "", score: "540", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-muted-foreground/60 w-3">
                        {item.rank}
                      </span>
                      <img src={item.avatar} alt={item.name} className="h-7 w-7 rounded-lg object-cover" />
                      <div>
                        <div className="flex items-center gap-1 font-body text-xs font-semibold text-foreground">
                          {item.name}
                          {item.role && (
                            <span className="text-[9px] text-muted-foreground font-normal">({item.role})</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      <Flame className="h-3 w-3 fill-amber-500 dark:fill-amber-400" /> {item.score}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Pinned Resources Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Pinned Resources</h3>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { title: "Frontend Developer Roadmap 2024", author: "MarceloDev", type: "PDF", icon: FileText },
                  { title: "React Performance Checklist", author: "TechStart Inc.", type: "PDF", icon: FileText },
                  { title: "Best VS Code Extensions", author: "BrightKey", type: "Link", icon: ExternalLink },
                ].map((res) => {
                  const Icon = res.icon;
                  return (
                    <div key={res.title} className="flex items-center gap-3 p-2 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer group">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-body text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                          {res.title}
                        </div>
                        <div className="font-body text-[10px] text-muted-foreground">
                          {res.author} • {res.type}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 5. Upcoming Events Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Upcoming Events</h3>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  { title: "Build a Portfolio That Converts", speaker: "SarahWrites", date: "May 24, 2026 • 6:00 PM", badge: "24 MAY", count: "+126" },
                  { title: "Framer Motion Deep Dive", speaker: "BrightKey", date: "May 31, 2026 • 7:00 PM", badge: "31 MAY", count: "+96" },
                ].map((ev) => (
                  <div key={ev.title} className="flex items-start gap-3 p-2 rounded-xl bg-muted/40">
                    <div className="flex flex-col items-center justify-center h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 shrink-0 font-bold">
                      <span className="text-[10px] leading-tight">{ev.badge}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-body text-xs font-semibold text-foreground truncate">{ev.title}</div>
                      <div className="font-body text-[10px] text-muted-foreground">with {ev.speaker}</div>
                      <div className="font-body text-[10px] text-muted-foreground/70 mt-0.5">{ev.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 6. Recent Activity Card */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Recent Activity</h3>
                <button className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                  View all
                </button>
              </div>

              <div className="space-y-2.5 pt-1 text-xs">
                {[
                  { user: "NeonByte", act: "joined the space", time: "2h ago", color: "bg-purple-500" },
                  { user: "James Lee", act: "posted a discussion", time: "3h ago", color: "bg-amber-500" },
                  { user: "Inova Agency", act: "shared a resource", time: "5h ago", color: "bg-cyan-500" },
                  { user: "Clara Bennett", act: "asked a question", time: "6h ago", color: "bg-indigo-500" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 rounded-full ${item.color} shrink-0`} />
                    <div className="font-body text-[11px] text-muted-foreground truncate">
                      <strong className="text-foreground font-semibold">{item.user}</strong> {item.act}{" "}
                      <span className="text-muted-foreground/50">• {item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating Action Button */}
        <button
          onClick={() => handleOpenComposer("post")}
          className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
        >
          <PenTool className="h-5 w-5" />
        </button>
      </div>
    </AppLayout>
  );
};

export default CommunityDetail;
