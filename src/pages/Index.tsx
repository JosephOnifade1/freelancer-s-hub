import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { getUserProfile } from "@/lib/users";
import { toast } from "sonner";
import { VoteControls } from "@/components/VoteControls";
import {
  PenTool,
  HelpCircle,
  FileText,
  BarChart2,
  MessageSquare,
  Repeat,
  Bookmark,
  TrendingUp,
  Flame,
  Award,
  Users,
  ChevronRight,
  Code2,
  Sparkles,
  Zap,
  Globe,
  Share2,
  Plus,
  MoreHorizontal,
  FileCode,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateSpacePostModal } from "@/components/modals/CreateSpacePostModal";

// Initial Home Feed Posts matching Image 2 screenshot
const INITIAL_HOME_POSTS = [
  {
    id: "p1",
    authorName: "MarceloDev",
    authorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
    isVerified: true,
    timeAgo: "2h ago",
    badge: "RESOURCE",
    badgeColor: "bg-purple-900/60 text-purple-300 border-purple-700/50",
    type: "resource",
    title: "I tripled my freelance rate in 6 months — here's exactly how",
    body: "Last year I was charging $40/hr for React development. After repositioning myself as a specialist in fintech dashboards, I'm now at $120/hr.",
    tags: ["#pricing", "#growth", "#dev"],
    likes: 187,
    comments: 42,
    shares: 28,
    isLiked: false,
    isBookmarked: false,
    visualType: "chart",
  },
  {
    id: "p2",
    authorName: "DesignKara",
    authorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    isVerified: true,
    timeAgo: "1d ago",
    badge: "RESOURCE",
    badgeColor: "bg-purple-900/60 text-purple-300 border-purple-700/50",
    type: "resource",
    title: "The proposal template that landed me 8 clients this quarter",
    body: "I've spent two years refining my proposal process. This Notion template includes sections for scope, timeline, pricing tiers, and a 'why me' section that converts.",
    tags: ["#proposals", "#templates", "#design"],
    likes: 312,
    comments: 67,
    shares: 18,
    isLiked: false,
    isBookmarked: false,
    visualType: "doc",
  },
  {
    id: "p3",
    authorName: "SarahWrites",
    authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
    isVerified: true,
    timeAgo: "1d ago",
    badge: "QUESTION",
    badgeColor: "bg-indigo-900/60 text-indigo-300 border-indigo-700/50",
    type: "question",
    title: "How do you handle clients who ghost after the discovery call?",
    body: "Had 4 discovery calls this month. All went great, everyone seemed excited. Then... silence. No follow-up emails answered. Is this normal? What's your process?",
    tags: ["#clients", "#sales"],
    likes: 94,
    comments: 31,
    shares: 5,
    isLiked: false,
    isBookmarked: false,
  },
  {
    id: "p4",
    authorName: "NomadAnna",
    authorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80",
    isVerified: true,
    timeAgo: "1d ago",
    badge: "QUESTION",
    badgeColor: "bg-indigo-900/60 text-indigo-300 border-indigo-700/50",
    type: "question",
    title: "Best invoicing tools for international freelancers?",
    body: "I work with clients in 4 different countries. Currency conversion, tax compliance, and payment tracking are a nightmare. What tools are you using? Looking for recommendations.",
    tags: ["#tools", "#finance", "#international"],
    likes: 45,
    comments: 23,
    shares: 7,
    isLiked: false,
    isBookmarked: false,
  },
  {
    id: "p5",
    authorName: "FreelanceMike",
    authorAvatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80",
    isVerified: true,
    timeAgo: "1d ago",
    badge: "RESOURCE",
    badgeColor: "bg-purple-900/60 text-purple-300 border-purple-700/50",
    type: "resource",
    title: "Stop undercharging: A framework for value-based pricing",
    body: "If you're still pricing by the hour, you're leaving money on the table. Here's a simple framework I use: identify the business outcome, estimate its value, then price based on that — not time.",
    tags: ["#pricing", "#strategy"],
    likes: 73,
    comments: 19,
    shares: 11,
    isLiked: false,
    isBookmarked: false,
    visualType: "value",
  },
  {
    id: "p6",
    authorName: "Borynx Team",
    authorAvatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80",
    isVerified: true,
    timeAgo: "1d ago",
    badge: "WEEKLY",
    badgeColor: "bg-purple-950/80 text-purple-300 border-purple-800/60",
    type: "weekly",
    title: "🏆 Weekly Thread: Share your biggest win this week",
    body: "Every Friday we celebrate. Big or small — landed a new client, shipped a project, finally sent that invoice, took a day off. Drop your win below. Let's cheer each other on!",
    tags: ["#wins", "#community"],
    likes: 156,
    comments: 89,
    shares: 12,
    isLiked: false,
    isBookmarked: false,
  },
];

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"For You" | "Following">("For You");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"post" | "question" | "resource" | "poll">("post");
  const [postsList, setPostsList] = useState(INITIAL_HOME_POSTS);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user ? getUserProfile(user.uid) : null),
    enabled: !!user,
  });

  const handleOpenComposer = (type: "post" | "question" | "resource" | "poll") => {
    setModalType(type);
    setCreateModalOpen(true);
  };

  const handleNewPostCreated = (newPost: {
    id?: string;
    authorName?: string;
    authorAvatar?: string;
    type?: string;
    title?: string;
    body?: string;
    tags?: string[];
  }) => {
    setPostsList([
      {
        id: newPost.id || `home-p-${Date.now()}`,
        authorName: newPost.authorName || profile?.displayName || user?.displayName || "You",
        authorAvatar: newPost.authorAvatar || user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
        isVerified: true,
        timeAgo: "Just now",
        badge: (newPost.type || "post").toUpperCase(),
        badgeColor: "bg-purple-900/60 text-purple-300 border-purple-700/50",
        type: newPost.type || "post",
        title: newPost.title || "Untitled Post",
        body: newPost.body || "",
        tags: Array.isArray(newPost.tags)
          ? newPost.tags.map((t: string) => (t.startsWith("#") ? t : `#${t}`))
          : ["#general"],
        likes: 1,
        comments: 0,
        shares: 0,
        isLiked: true,
        isBookmarked: false,
      },
      ...postsList,
    ]);
  };

  const handleToggleLike = (postId: string) => {
    setPostsList((prev) =>
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
    setPostsList((prev) =>
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

  // Filter posts based on active Tab
  const displayedPosts = useMemo(() => {
    if (activeTab === "Following") {
      return postsList.filter((p) => p.authorName !== "Borynx Team");
    }
    return postsList;
  }, [postsList, activeTab]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1380px] px-4 py-6 md:px-6">
        {/* Main 2-Column Grid: Left Feed (8 cols), Right Sidebar (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Top Tab Bar: For You / Following */}
            <div className="flex items-center gap-6 border-b border-border/60 pb-1">
              {(["For You", "Following"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-all whitespace-nowrap ${
                      isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div
                        layoutId="activeHomeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Composer Bar: "What's on your mind?" */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
              <div
                onClick={() => handleOpenComposer("post")}
                className="flex items-center gap-3 cursor-pointer"
              >
                <img
                  src={
                    user?.photoURL ||
                    profile?.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
                  }
                  alt="User"
                  className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/40 shrink-0"
                />
                <div className="flex-1 bg-muted/50 hover:bg-muted border border-border/40 rounded-xl px-4 py-2.5 text-xs text-muted-foreground transition-colors">
                  What's on your mind?
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
              {displayedPosts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 hover:border-border transition-all shadow-sm"
                >
                  {/* Author Row */}
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

                    {/* Badge */}
                    <Badge
                      className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 border ${post.badgeColor}`}
                    >
                      {post.badge}
                    </Badge>
                  </div>

                  {/* Main Title & Body Layout: Left Text & Right Graphic (if visualType exists) */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start">
                    <div className="space-y-2 flex-1 min-w-0">
                      <h3
                        onClick={() => navigate(`/p/${post.id}`)}
                        className="font-heading text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer leading-snug"
                      >
                        {post.title}
                      </h3>
                      <p className="font-body text-xs text-muted-foreground/90 leading-relaxed">
                        {post.body}
                      </p>

                      {/* Hashtags */}
                      {Array.isArray(post.tags) && post.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          {post.tags.map((tag) => (
                            <span
                              key={tag}
                              onClick={() => navigate(`/tag/${tag.replace('#', '')}`)}
                              className="font-mono text-[11px] font-medium text-muted-foreground/70 hover:text-primary cursor-pointer"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right Visual Card for specific posts matching screenshot */}
                    {post.visualType === "chart" && (
                      <div className="w-full md:w-56 shrink-0 rounded-xl border border-purple-500/30 bg-purple-900/10 dark:bg-gradient-to-br dark:from-purple-950/80 dark:via-[#0e0f18] dark:to-slate-950 p-4 flex flex-col justify-between h-32">
                        <div className="flex items-baseline justify-between text-foreground dark:text-white font-mono">
                          <span className="text-sm font-bold">$40 → $120</span>
                        </div>
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                          6 MONTHS
                        </span>
                        {/* SVG Upward Trendline */}
                        <svg className="w-full h-10 overflow-visible text-purple-500 stroke-current stroke-2 fill-none">
                          <path d="M 0 30 Q 50 25, 100 15 T 200 5" />
                        </svg>
                      </div>
                    )}

                    {post.visualType === "doc" && (
                      <div className="w-full md:w-52 shrink-0 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs space-y-2 shadow-inner">
                        <div className="font-heading font-bold text-foreground text-[11px] border-b border-border/40 pb-1">
                          Project Proposal
                        </div>
                        <div className="space-y-1 text-[10px] text-muted-foreground">
                          <div>1. Overview</div>
                          <div>2. Scope</div>
                          <div>3. Timeline</div>
                          <div>4. Investment</div>
                          <div>5. Why Us</div>
                          <div>6. Next Steps</div>
                        </div>
                      </div>
                    )}

                    {post.visualType === "value" && (
                      <div className="w-full md:w-52 shrink-0 rounded-xl border border-purple-500/30 bg-purple-900/10 dark:bg-gradient-to-br dark:from-[#120f24] dark:to-[#0c0d12] p-4 flex flex-col items-center justify-center text-center space-y-1">
                        <div className="font-heading font-black text-xs text-foreground dark:text-white uppercase tracking-wider">
                          VALUE BASED PRICING
                        </div>
                        <p className="text-[9px] text-purple-600 dark:text-purple-300/80">A SIMPLE FRAMEWORK</p>
                      </div>
                    )}
                  </div>

                  {/* Engagements Footer Bar */}
                  <div className="flex items-center justify-between pt-3 border-t border-border/30 text-xs text-muted-foreground/80 font-medium">
                    <div className="flex items-center gap-5">
                      <VoteControls score={post.likes} entityId={post.id} type="post" orientation="horizontal" />

                      <button
                        onClick={() => navigate(`/p/${post.id}`)}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
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
          </div>

          {/* Right Sidebar Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Widget 1: Trending Tags */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <h3 className="font-heading text-sm font-bold text-foreground">Trending Tags</h3>
                </div>
                <button
                  onClick={() => navigate("/tag/all")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  View all
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {["#pricing", "#growth", "#dev", "#clients", "#sales", "#tools", "#finance", "#international"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => navigate(`/tag/${tag.replace("#", "")}`)}
                    className="px-2.5 py-1 rounded-xl bg-muted/50 hover:bg-muted border border-border/40 text-xs font-mono font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Widget 2: Top Contributors */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-500" />
                  <h3 className="font-heading text-sm font-bold text-foreground">Top Contributors</h3>
                </div>
                <button
                  onClick={() => navigate("/achievements")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { rank: 1, name: "MarceloDev", score: "6,530 XP", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
                  { rank: 2, name: "SarahWrites", score: "5,110 XP", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" },
                  { rank: 3, name: "Design Kara", score: "4,320 XP", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" },
                  { rank: 4, name: "TechStart Inc.", score: "3,870 XP", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80" },
                  { rank: 5, name: "BrightKey", score: "3,210 XP", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-muted-foreground/60 w-3">
                        {c.rank}
                      </span>
                      <img src={c.avatar} alt={c.name} className="h-7 w-7 rounded-lg object-cover" />
                      <div className="flex items-center gap-1 font-body text-xs font-semibold text-foreground">
                        <span>{c.name}</span>
                        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                          ✓
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      {c.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 3: Active B-Spaces */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Active B-Spaces</h3>
                <button
                  onClick={() => navigate("/communities")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { name: "Frontend Hub", count: "2.6K members", slug: "frontend-hub", iconColor: "bg-purple-600" },
                  { name: "Indie Builders", count: "1.8K members", slug: "indie-builders", iconColor: "bg-amber-600" },
                  { name: "Growth Operators", count: "1.2K members", slug: "growth-operators", iconColor: "bg-blue-600" },
                  { name: "UI/UX Collective", count: "1.1K members", slug: "ui-ux-collective", iconColor: "bg-indigo-600" },
                  { name: "Freelance Business", count: "980 members", slug: "freelance-business", iconColor: "bg-emerald-600" },
                ].map((space) => (
                  <div
                    key={space.name}
                    onClick={() => navigate(`/b/${space.slug}`)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${space.iconColor} text-white font-bold text-xs shadow-md`}>
                        {space.name[0]}
                      </div>
                      <div>
                        <div className="font-heading text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                          {space.name}
                        </div>
                        <div className="font-body text-[10px] text-muted-foreground">{space.count}</div>
                      </div>
                    </div>
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 4: Weekly Leaderboard */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Weekly Leaderboard</h3>
                <button
                  onClick={() => navigate("/achievements")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                >
                  View all
                </button>
              </div>

              <div className="space-y-2.5 pt-1">
                {[
                  { rank: 1, name: "MarceloDev", score: "+630 XP", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
                  { rank: 2, name: "SarahWrites", score: "+480 XP", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80" },
                  { rank: 3, name: "Design Kara", score: "+350 XP", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" },
                  { rank: 4, name: "TechStart Inc.", score: "+290 XP", avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80" },
                  { rank: 5, name: "BrightKey", score: "+250 XP", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-muted-foreground/60 w-3">
                        {c.rank}
                      </span>
                      <img src={c.avatar} alt={c.name} className="h-7 w-7 rounded-lg object-cover" />
                      <div className="flex items-center gap-1 font-body text-xs font-semibold text-foreground">
                        <span>{c.name}</span>
                        <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                          ✓
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-500">
                      {c.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 5: Your Streak */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground">Your Streak</h3>

              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Flame className="h-6 w-6 fill-amber-500" />
                </div>
                <div>
                  <div className="font-heading text-lg font-black text-foreground">7 days</div>
                  <div className="font-body text-[11px] text-muted-foreground">Keep it going! 🔥</div>
                </div>
              </div>

              {/* Day Pills */}
              <div className="flex items-center justify-between pt-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
                  <div
                    key={idx}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[11px] font-bold shadow-md shadow-primary/20"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <Button
                onClick={() => navigate("/achievements")}
                variant="outline"
                className="w-full h-9 border-border/60 bg-muted/40 hover:bg-muted text-xs font-semibold rounded-xl text-foreground"
              >
                View Progress
              </Button>
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

        {/* Create Post Modal */}
        <CreateSpacePostModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          spaceSlug="home"
          spaceName="Borynx Feed"
          initialType={modalType}
          onPostCreated={handleNewPostCreated}
        />
      </div>
    </AppLayout>
  );
};

export default Index;
