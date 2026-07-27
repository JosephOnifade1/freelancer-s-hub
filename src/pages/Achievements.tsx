import React, { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile, getUserResourcesCount } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor } from "@/lib/comments";
import { toast } from "sonner";
import {
  Trophy,
  Flame,
  Zap,
  Heart,
  Star,
  Calendar,
  BookOpen,
  MessageSquare,
  Lock,
  CheckCircle2,
  ChevronRight,
  Share2,
  Award,
  ShieldCheck,
  TrendingUp,
  Info,
  Sparkles,
  Folder,
  Sun,
  Moon,
  Clock,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TabType = "Overview" | "Badges" | "Milestones" | "Activity" | "Challenges";

const Achievements = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("Overview");
  const [leaderboardTimeframe, setLeaderboardTimeframe] = useState<"This Month" | "All Time" | "This Week">("This Month");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user?.uid ? getUserProfile(user.uid) : null),
    enabled: !!user?.uid,
  });

  const { data: allPosts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
    enabled: !!profile,
  });

  const { data: resourceCount = 0 } = useQuery({
    queryKey: ["user-resources-count", user?.uid],
    queryFn: () => (user?.uid ? getUserResourcesCount(user.uid) : 0),
    enabled: !!user?.uid,
  });

  const { data: userComments = [] } = useQuery({
    queryKey: ["userComments", profile?.uid],
    queryFn: () => (profile ? fetchCommentsByAuthor(profile) : []),
    enabled: !!profile,
  });

  const reputation = profile?.reputation || 4820;
  const commentUpvotes = userComments.reduce(
    (sum, c) => sum + Math.max(0, c.score || 0),
    0
  );

  const userPosts = profile
    ? allPosts.filter(
        (p) =>
          !p.isDeleted &&
          (p.author?.uid === profile.uid ||
            p.author?.name === profile.username ||
            p.author?.name === profile.displayName)
      )
    : [];

  // Achievement Badges Definitions
  const achievementBadges = [
    {
      id: "first-post",
      name: "First Post",
      description: "Publish your very first post.",
      icon: Flame,
      unlocked: userPosts.length >= 1,
    },
    {
      id: "rising-voice",
      name: "Rising Voice",
      description: "Reach 100 reputation points.",
      icon: Zap,
      unlocked: reputation >= 100,
    },
    {
      id: "helper",
      name: "Helper",
      description: "Get 10 upvotes on comments.",
      icon: Heart,
      unlocked: commentUpvotes >= 10,
    },
    {
      id: "trusted-voice",
      name: "Trusted Voice",
      description: "Reach 1,000 reputation.",
      icon: Star,
      unlocked: reputation >= 1000,
    },
    {
      id: "consistent",
      name: "Consistent",
      description: "Post 30 days in a row.",
      icon: Calendar,
      unlocked: false,
    },
    {
      id: "generous",
      name: "Generous",
      description: "Share 5 resource posts.",
      icon: BookOpen,
      unlocked: resourceCount >= 5,
    },
    {
      id: "veteran",
      name: "Veteran Freelancer",
      description: "Reach 5,000 reputation.",
      icon: Trophy,
      unlocked: reputation >= 5000,
    },
    {
      id: "convo-starter",
      name: "Conversation Starter",
      description: "Get 50 comments on a single post.",
      icon: MessageSquare,
      unlocked: userPosts.some((p) => (p.commentCount || 0) >= 50),
    },
  ];

  const unlockedCount = achievementBadges.filter((a) => a.unlocked).length;
  const isTrustedVoice = achievementBadges.find((a) => a.id === "trusted-voice")?.unlocked ?? false;
  const isGenerous = achievementBadges.find((a) => a.id === "generous")?.unlocked ?? false;
  const verificationProgress = (isTrustedVoice ? 50 : 0) + (isGenerous ? 50 : 0) || 45;

  const handleShareAchievements = () => {
    toast.success("Achievements link copied to clipboard!");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1380px] px-4 py-6 md:px-6">
        {/* Top Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              Achievements
            </h1>
            <span className="text-2xl">🏆</span>
          </div>
          <p className="font-body text-xs text-muted-foreground mt-1">
            Every action counts. Unlock badges, hit milestones, and level up.
          </p>
        </div>

        {/* Top Stat Overview Bar Card */}
        <div className="rounded-2xl border border-border/60 bg-card p-5 mb-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-border/40">
            {/* Stat 1: Level */}
            <div className="space-y-1 pr-4">
              <div className="text-[11px] font-medium text-muted-foreground">Level</div>
              <div className="font-heading text-2xl font-extrabold text-foreground">14</div>
              <div className="text-[10px] text-muted-foreground/70">Next: Level 15</div>
            </div>

            {/* Stat 2: Total Points */}
            <div className="space-y-1 pt-3 md:pt-0 md:px-4">
              <div className="text-[11px] font-medium text-muted-foreground">Total Points</div>
              <div className="font-heading text-2xl font-extrabold text-foreground">
                {reputation.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                <span>+230</span> <span className="text-muted-foreground/70">this week</span>
              </div>
            </div>

            {/* Stat 3: Badges */}
            <div className="space-y-1 pt-3 md:pt-0 md:px-4">
              <div className="text-[11px] font-medium text-muted-foreground">Badges</div>
              <div className="font-heading text-2xl font-extrabold text-foreground">
                23 <span className="text-sm font-normal text-muted-foreground/60">/ 48 unlocked</span>
              </div>
              <div className="text-[10px] text-muted-foreground/70">
                {unlockedCount} from main path
              </div>
            </div>

            {/* Stat 4: Rank */}
            <div className="flex items-center justify-between pt-3 md:pt-0 md:pl-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">Rank</div>
                <div className="font-heading text-2xl font-extrabold text-foreground">Top 6%</div>
                <div className="text-[10px] text-muted-foreground/70">Among all users</div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg shadow-purple-600/30 border border-purple-400/30 shrink-0">
                <Star className="h-6 w-6 fill-white text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-6 border-b border-border/60 mb-6 overflow-x-auto no-scrollbar">
          {(["Overview", "Badges", "Milestones", "Activity", "Challenges"] as TabType[]).map((tab) => {
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
                    layoutId="activeAchieveTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Main Grid: Left Main Content (8 cols) & Right Sidebar (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* 1. Verification Path Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-purple-900/10 dark:bg-gradient-to-r dark:from-[#120f24] dark:via-[#0d0e17] dark:to-[#110f22] p-6 shadow-sm">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 max-w-xl">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-purple-500" />
                    <h3 className="font-heading text-base font-bold text-foreground">
                      Verification Path
                    </h3>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[220px] text-xs p-2.5">
                          Complete Trusted Voice & Generous achievements to receive your official verified creator badge.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-bold text-muted-foreground">
                      <span className="uppercase tracking-wider">PROGRESS</span>
                      <span className="text-purple-600 dark:text-purple-300 font-mono">{verificationProgress}%</span>
                    </div>
                    <Progress value={verificationProgress} className="h-2 bg-purple-500/20 [&>div]:bg-purple-600 dark:[&>div]:bg-purple-500" />
                  </div>

                  <p className="font-body text-xs text-muted-foreground/90">
                    Complete Trusted Voice & Generous to get verified on Borynx.
                  </p>
                </div>

                {/* Shield Graphic */}
                <div className="flex shrink-0 items-center justify-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600/20 to-indigo-600/30 border border-purple-500/30 shadow-lg shadow-purple-600/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Achievement Badges Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-foreground">
                    Achievement Badges
                  </h2>
                  <p className="font-body text-xs text-muted-foreground">
                    {unlockedCount} of 8 unlocked. Keep contributing to earn more.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("Badges")}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  View all
                </button>
              </div>

              {/* 4x2 Badge Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {achievementBadges.map((badge) => {
                  const Icon = badge.icon;
                  return (
                    <div
                      key={badge.id}
                      className={`relative flex flex-col items-center justify-between rounded-2xl border p-4 text-center transition-all min-h-[160px] ${
                        badge.unlocked
                          ? "border-purple-500/50 bg-purple-500/10 dark:bg-gradient-to-b dark:from-purple-950/30 dark:to-[#0e0f14] shadow-md shadow-purple-500/10"
                          : "border-border/40 bg-card hover:border-border/80"
                      }`}
                    >
                      <div className="space-y-2 flex flex-col items-center">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform ${
                            badge.unlocked
                              ? "bg-purple-600/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 scale-105"
                              : "bg-muted/50 text-muted-foreground/40 border border-border/30"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>

                        <div>
                          <h3 className="font-heading text-xs font-bold text-foreground">
                            {badge.name}
                          </h3>
                          <p className="font-body text-[10px] text-muted-foreground/80 leading-tight mt-1">
                            {badge.description}
                          </p>
                        </div>
                      </div>

                      <div className="pt-3 w-full">
                        {badge.unlocked ? (
                          <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/40 text-[9px] font-bold tracking-wider px-2 py-0.5 w-full justify-center">
                            ✓ UNLOCKED
                          </Badge>
                        ) : (
                          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground/50 border border-border/30 rounded-lg py-1 bg-muted/30">
                            <Lock className="h-3 w-3" />
                            <span>LOCKED</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Milestone Progress Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-foreground">
                    Milestone Progress
                  </h2>
                  <p className="font-body text-xs text-muted-foreground">
                    Big milestones. Bigger flex.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("Milestones")}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  View all
                </button>
              </div>

              {/* 4 Big Milestone Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {/* Milestone 1 */}
                <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col items-center text-center justify-between space-y-3 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    <Zap className="h-6 w-6" />
                  </div>

                  <div>
                    <div className="font-heading text-xl font-black text-foreground">100</div>
                    <div className="font-heading text-xs font-bold text-muted-foreground">Posts</div>
                    <p className="font-body text-[10px] text-muted-foreground/70 mt-1">
                      Share knowledge consistently
                    </p>
                  </div>

                  <div className="w-full space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-muted-foreground font-mono">100 / 100</div>
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-purple-600 dark:text-purple-300 bg-purple-500/10 py-1 rounded-lg border border-purple-500/20">
                      <CheckCircle2 className="h-3 w-3 fill-purple-500 text-white" /> Completed
                    </div>
                  </div>
                </div>

                {/* Milestone 2 */}
                <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col items-center text-center justify-between space-y-3 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    <Heart className="h-6 w-6 fill-amber-500" />
                  </div>

                  <div>
                    <div className="font-heading text-xl font-black text-foreground">1K</div>
                    <div className="font-heading text-xs font-bold text-muted-foreground">Reactions</div>
                    <p className="font-body text-[10px] text-muted-foreground/70 mt-1">
                      Earn upvotes and reactions
                    </p>
                  </div>

                  <div className="w-full space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-muted-foreground font-mono">820 / 1,000</div>
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 py-1 rounded-lg border border-amber-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" /> In progress
                    </div>
                  </div>
                </div>

                {/* Milestone 3 */}
                <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col items-center text-center justify-between space-y-3 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                    <Folder className="h-6 w-6" />
                  </div>

                  <div>
                    <div className="font-heading text-xl font-black text-foreground">10</div>
                    <div className="font-heading text-xs font-bold text-muted-foreground">Resources</div>
                    <p className="font-body text-[10px] text-muted-foreground/70 mt-1">
                      Share valuable resources
                    </p>
                  </div>

                  <div className="w-full space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-muted-foreground font-mono">10 / 10</div>
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 py-1 rounded-lg border border-cyan-500/20">
                      <CheckCircle2 className="h-3 w-3 fill-cyan-500 text-white" /> Completed
                    </div>
                  </div>
                </div>

                {/* Milestone 4 */}
                <div className="rounded-2xl border border-border/60 bg-card p-4 flex flex-col items-center text-center justify-between space-y-3 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    <Trophy className="h-6 w-6" />
                  </div>

                  <div>
                    <div className="font-heading text-xl font-black text-foreground">5K</div>
                    <div className="font-heading text-xs font-bold text-muted-foreground">Points</div>
                    <p className="font-body text-[10px] text-muted-foreground/70 mt-1">
                      Earn points through activity
                    </p>
                  </div>

                  <div className="w-full space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold text-muted-foreground font-mono">4,820 / 5,000</div>
                    <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-1 rounded-lg border border-emerald-500/20">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> In progress
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Activity Badges Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-base font-bold text-foreground">
                    Activity Badges
                  </h2>
                  <p className="font-body text-xs text-muted-foreground">
                    Recognizing your everyday actions.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("Activity")}
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                >
                  View all
                </button>
              </div>

              {/* Activity Cards Row */}
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                {[
                  { title: "Early Bird", sub: "Posted before 9 AM", icon: Sun },
                  { title: "Night Owl", sub: "Posted after 10 PM", icon: Moon },
                  { title: "Commenter", sub: "Commented on 10 posts", icon: MessageSquare },
                  { title: "Engager", sub: "Reacted to 50 posts", icon: Heart },
                  { title: "Sparker", sub: "Started a conversation", icon: Zap },
                ].map((act) => {
                  const Icon = act.icon;
                  return (
                    <div
                      key={act.title}
                      className="flex flex-col items-center text-center p-3 rounded-xl border border-border/60 bg-card space-y-2 shadow-sm"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-primary border border-border/40">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-heading text-xs font-bold text-foreground">{act.title}</div>
                        <div className="font-body text-[9px] text-muted-foreground/70 leading-tight mt-0.5">
                          {act.sub}
                        </div>
                      </div>
                      <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30 text-[9px] font-bold px-2 py-0">
                        +50 ✓
                      </Badge>
                    </div>
                  );
                })}

                {/* +6 More Card */}
                <div className="flex flex-col items-center justify-center text-center p-3 rounded-xl border border-dashed border-border/60 bg-muted/20 space-y-1">
                  <div className="font-heading text-sm font-extrabold text-foreground">+6</div>
                  <div className="font-heading text-xs font-bold text-muted-foreground">More</div>
                  <p className="font-body text-[9px] text-muted-foreground/60 leading-tight">
                    Keep exploring to unlock
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. Your Progress Arc Gauge Panel */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground">Your Progress</h3>

              {/* Arc Gauge */}
              <div className="flex flex-col items-center justify-center relative py-2">
                <svg viewBox="0 0 200 110" className="w-48 h-28 overflow-visible">
                  <defs>
                    <linearGradient id="purpleGauge" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>
                  {/* Background Arc */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted/40"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  {/* Progress Arc (~85%) */}
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#purpleGauge)"
                    strokeWidth="12"
                    strokeDasharray="251"
                    strokeDashoffset="38"
                    strokeLinecap="round"
                  />
                </svg>

                {/* Center Level Info */}
                <div className="absolute bottom-1 flex flex-col items-center text-center">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">Level</span>
                  <span className="font-heading text-2xl font-black text-foreground leading-none">14</span>
                  <span className="font-body text-[10px] font-bold text-purple-600 dark:text-purple-300 mt-1">
                    2,180 <span className="text-muted-foreground/70">/ 2,500 XP</span>
                  </span>
                  <span className="text-[9px] text-muted-foreground/60">320 XP to next level</span>
                </div>
              </div>

              {/* XP Breakdown List */}
              <div className="space-y-2 pt-2 border-t border-border/30 text-xs">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  XP Breakdown
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Posts</span>
                  <span className="font-mono text-foreground font-semibold">1,420 XP</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Comments</span>
                  <span className="font-mono text-foreground font-semibold">860 XP</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Reactions</span>
                  <span className="font-mono text-foreground font-semibold">1,150 XP</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Resources</span>
                  <span className="font-mono text-foreground font-semibold">670 XP</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Spaces</span>
                  <span className="font-mono text-foreground font-semibold">900 XP</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/30 font-bold text-foreground">
                  <span>Total</span>
                  <span className="font-mono text-primary font-bold">4,820 XP</span>
                </div>
              </div>
            </div>

            {/* 2. Current Streak Panel */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Current Streak</h3>
                <span className="text-xs">🔥</span>
              </div>

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
              <div className="flex items-center justify-between pt-2">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
                  <div
                    key={idx}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[11px] font-bold shadow-md shadow-primary/20"
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Recent Activity */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Recent Activity</h3>
              </div>

              <div className="space-y-3 pt-1 text-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                    <Trophy className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">You earned Consistency King</div>
                    <div className="text-[10px] text-muted-foreground">2h ago</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20">
                    <Award className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">You earned Great Contributor</div>
                    <div className="text-[10px] text-muted-foreground">2 days ago</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20">
                    <Star className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground">You earned Resource Sharer</div>
                    <div className="text-[10px] text-muted-foreground">3 days ago</div>
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      <Zap className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground">You reached Level 14</div>
                      <div className="text-[10px] text-muted-foreground">5 days ago</div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-bold shrink-0">
                    +230 XP
                  </Badge>
                </div>
              </div>

              <button
                onClick={() => setActiveTab("Activity")}
                className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold pt-2 transition-colors"
              >
                View all activity <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 4. Top Achievers Leaderboard */}
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Top Achievers</h3>
                <select
                  value={leaderboardTimeframe}
                  onChange={(e) => setLeaderboardTimeframe(e.target.value as "This Month" | "All Time" | "This Week")}
                  className="bg-muted/50 text-[11px] font-semibold text-muted-foreground border border-border/40 rounded-lg px-2 py-1 outline-none cursor-pointer"
                >
                  <option value="This Month">This Month</option>
                  <option value="This Week">This Week</option>
                  <option value="All Time">All Time</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                {[
                  {
                    rank: 1,
                    name: "SarahWrites",
                    isVerified: true,
                    xp: "8,740 XP",
                    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
                  },
                  {
                    rank: 2,
                    name: "Design Kara",
                    isVerified: true,
                    xp: "7,210 XP",
                    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
                  },
                  {
                    rank: 3,
                    name: "MarceloDev",
                    isVerified: true,
                    xp: "6,530 XP",
                    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
                  },
                  {
                    rank: 4,
                    name: "TechStart Inc.",
                    isVerified: true,
                    xp: "5,920 XP",
                    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&q=80",
                  },
                  {
                    rank: 5,
                    name: "BrightKey",
                    isVerified: true,
                    xp: "5,110 XP",
                    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80",
                  },
                ].map((achiever) => (
                  <div
                    key={achiever.name}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-muted-foreground/60 w-3">
                        {achiever.rank}
                      </span>
                      <img
                        src={achiever.avatar}
                        alt={achiever.name}
                        className="h-7 w-7 rounded-lg object-cover ring-1 ring-border/40"
                      />
                      <div className="flex items-center gap-1 font-body text-xs font-semibold text-foreground">
                        <span>{achiever.name}</span>
                        {achiever.isVerified && (
                          <span className="flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      {achiever.xp}
                    </span>
                  </div>
                ))}

                {/* Current User Row */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 mt-1">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={user?.photoURL || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                      alt="You"
                      className="h-7 w-7 rounded-lg object-cover ring-1 ring-purple-500/50"
                    />
                    <div>
                      <div className="font-body text-xs font-bold text-foreground">You</div>
                      <div className="text-[9px] text-purple-600 dark:text-purple-300 font-semibold">Top 6%</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-purple-600 dark:text-purple-300">
                    4,820 XP
                  </span>
                </div>
              </div>
            </div>

            {/* 5. Achievement Unlocked Promo Card */}
            <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-purple-900/10 dark:bg-gradient-to-br dark:from-purple-950 dark:via-[#0d0e17] dark:to-indigo-950 p-6 flex flex-col items-center text-center space-y-4 shadow-sm">
              {/* Glowing Trophy Art */}
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/30 shadow-lg shadow-purple-500/20">
                <Trophy className="h-10 w-10 text-purple-600 dark:text-purple-200 fill-purple-500/40" />
              </div>

              <div>
                <h4 className="font-heading text-sm font-bold text-foreground dark:text-white">
                  Achievement unlocked?
                </h4>
                <p className="font-body text-xs text-muted-foreground dark:text-purple-200/80 mt-1 leading-relaxed">
                  Share your badge on your profile and inspire others.
                </p>
              </div>

              <Button
                onClick={handleShareAchievements}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-lg shadow-primary/20 gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" /> Share Your Achievements
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Achievements;
