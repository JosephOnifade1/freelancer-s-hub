import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  BookOpen,
  Calendar,
  Flame,
  Heart,
  Lock,
  MessageSquare,
  Star,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, getUserResourcesCount } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor } from "@/lib/comments";
import { getUserStreak } from "@/lib/stats";
import {
  fetchBadges,
  fetchUserBadges,
  computeBadgeProgress,
  computeReputationBreakdown,
  type BadgeProgress,
  type BadgeInputs,
} from "@/lib/badges";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Tab = "Badges" | "Activity";

interface ActivityItem {
  key: string;
  kind: "Posted" | "Commented";
  text: string;
  at: number;
  href: string;
}

type ActivityFilter = "all" | "posts" | "comments";

const iconFor = (iconName: string): LucideIcon => {
  const map: Record<string, LucideIcon> = {
    Flame, Zap, Heart, Star, Calendar, BookOpen, Trophy, MessageSquare,
  };
  return map[iconName] || Flame;
};

const CATEGORY_LABELS: Record<string, string> = {
  publishing: "Publishing",
  helping: "Helping",
  community: "Community",
  trust: "Trust",
  longevity: "Longevity",
};

const RARITY_LABELS: Record<string, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
};

export default function Achievements() {
  const { user } = useAuth();
  const uid = user?.uid;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("Badges");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [justUnlocked, setJustUnlocked] = useState<string[]>([]);
  const previousUnlocked = useRef<Set<string>>(new Set());

  const { data: profile, isError: profileError, refetch: refetchProfile } =
    useQuery({
      queryKey: ["profile", uid],
      queryFn: () => (uid ? getUserProfile(uid) : null),
      enabled: !!uid,
    });

  const { data: allPosts = [], isError: postsError, refetch: refetchPosts } =
    useQuery({
      queryKey: ["posts"],
      queryFn: fetchPosts,
      enabled: !!uid,
    });

  const { data: comments = [], isError: commentsError, refetch: refetchComments } =
    useQuery({
      queryKey: ["userComments", uid],
      queryFn: () =>
        profile ? fetchCommentsByAuthor(profile as never) : [],
      enabled: !!profile,
    });

  const { data: streak, isError: streakError, refetch: refetchStreak } =
    useQuery({
      queryKey: ["user-streak", uid],
      queryFn: () => (uid ? getUserStreak(uid) : null),
      enabled: !!uid,
    });

  const { data: resourceCount = 0 } = useQuery({
    queryKey: ["user-resources-count", uid],
    queryFn: () => (uid ? getUserResourcesCount(uid) : 0),
    enabled: !!uid,
  });

  const reputation = profile?.reputation ?? 0;
  const commentUpvotesReceived = comments.reduce(
    (sum, c) => sum + Math.max(0, c.score || 0),
    0,
  );

  const myPosts = useMemo(
    () =>
      profile
        ? allPosts.filter((p) => !p.isDeleted && p.author?.uid === profile.uid)
        : [],
    [allPosts, profile],
  );
  const topPostCommentCount = myPosts.reduce(
    (max, p) => Math.max(max, p.commentCount || 0),
    0,
  );

  const streakDays = streak?.streakDays ?? 0;

  const inputs: BadgeInputs = useMemo(
    () => ({
      postCount: myPosts.length,
      resourceCount,
      commentCount: comments.length,
      commentUpvotesReceived,
      reputation,
      streakDays,
      longestStreakDays: streakDays,
      topPostCommentCount,
    }),
    [myPosts.length, resourceCount, comments.length, commentUpvotesReceived, reputation, streakDays, topPostCommentCount],
  );

  const { data: badgeProgress = [], isError: badgesError, refetch: refetchBadges } =
    useQuery({
      queryKey: ["badge-progress", uid],
      queryFn: () => (uid ? computeBadgeProgress(uid, inputs) : []),
      enabled: !!uid,
    });

  const unlockedBadges = badgeProgress.filter((b) => b.unlocked);
  const unlockedCount = unlockedBadges.length;
  const totalBadges = badgeProgress.length;

  // Detect newly unlocked badges since last render for celebration toast.
  useEffect(() => {
    const current = new Set(unlockedBadges.map((b) => b.badge.id));
    const newly = unlockedBadges.filter((b) => !previousUnlocked.current.has(b.badge.id));
    if (previousUnlocked.current.size > 0 && newly.length > 0) {
      setJustUnlocked(newly.map((b) => b.badge.id));
      newly.forEach((b) => {
        toast.success(`Badge unlocked: ${b.badge.name}`, {
          description: b.badge.description,
          action: {
            label: "View badges",
            onClick: () => setTab("Badges"),
          },
        });
      });
    }
    previousUnlocked.current = current;
  }, [unlockedBadges]);

  const reputationBreakdown = useMemo(
    () => computeReputationBreakdown(inputs),
    [inputs],
  );

  const pathBadges = badgeProgress.filter(
    (b) => b.badge.id === "trusted-voice" || b.badge.id === "generous",
  );
  const pathDone = pathBadges.filter((b) => b.unlocked).length;
  const pathPercent = Math.round((pathDone / pathBadges.length) * 100);

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];
    myPosts.forEach((p) => {
      items.push({
        key: `p-${p.id}`,
        kind: "Posted",
        text: p.title,
        at: p.createdAt || 0,
        href: `/p/${p.id}`,
      });
    });
    comments.forEach((c) => {
      items.push({
        key: `c-${c.id}`,
        kind: "Commented",
        text: c.body,
        at: c.createdAt,
        href: `/p/${c.postId}`,
      });
    });
    return items.sort((a, b) => b.at - a.at);
  }, [myPosts, comments]);

  const filteredActivity = useMemo(() => {
    if (activityFilter === "posts")
      return activity.filter((a) => a.kind === "Posted");
    if (activityFilter === "comments")
      return activity.filter((a) => a.kind === "Commented");
    return activity;
  }, [activity, activityFilter]);

  const handleRetry = useCallback(() => {
    refetchProfile();
    refetchPosts();
    refetchComments();
    refetchStreak();
    refetchBadges();
  }, [refetchProfile, refetchPosts, refetchComments, refetchStreak, refetchBadges]);

  const hasError =
    profileError || postsError || commentsError || streakError || badgesError;

  if (!uid) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Sign in to view achievements</h2>
          <p className="text-sm text-muted-foreground">Log in to see your badges, reputation, and activity.</p>
        </div>
      </AppLayout>
    );
  }

  if (hasError) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-16">
          <QueryErrorState
            title="Couldn't load achievements"
            onRetry={handleRetry}
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            Achievements
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Badges you earn by posting, helping others, and sharing resources.
          </p>
        </div>

        {/* Celebration banner for newly unlocked badges */}
        <AnimatePresence>
          {justUnlocked.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-lg border border-brand/40 bg-brand/5 px-4 py-3 text-sm flex items-center gap-3"
            >
              <Star className="h-5 w-5 text-brand animate-spin" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  New badge{" "}{justUnlocked.length === 1 ? "" : "s"} unlocked!
                </p>
                <p className="text-xs text-muted-foreground">
                  {justUnlocked.map((id) => {
                    const b = badgeProgress.find((x) => x.badge.id === id);
                    return b ? `“${b.badge.name}”` : id;
                  }).join(", ")}
                </p>
              </div>
              <button
                onClick={() => setJustUnlocked([])}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Reputation</div>
            <div className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {reputation.toLocaleString()}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Badges unlocked</div>
            <div className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {unlockedCount} / {totalBadges}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Posts</div>
            <div className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {myPosts.length.toLocaleString()}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Day streak</div>
            <div className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">
              {streakDays.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Reputation breakdown */}
        {reputationBreakdown.length > 0 && (
          <div className="mb-6 rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
              <Flame className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-heading text-sm font-bold text-foreground">Reputation breakdown</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {reputationBreakdown.map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="mt-0.5 font-mono text-sm font-bold text-foreground">
                    +{s.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verified Pro path */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <BadgeCheck className="h-5 w-5 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Verified Pro</span> is earned, not bought: reach
            {" "}<span className="font-semibold text-foreground">1,000 reputation</span>{" "}
            (Trusted Voice) and an admin reviews your contributions before granting the badge.
            {profile?.isVerifiedPro
              ? " You're verified."
              : reputation >= 1000
                ? " You're past the reputation threshold — "
                : ` You need ${(1000 - reputation).toLocaleString()} more reputation to become eligible.`}
            {reputation >= 1000 && !profile?.isVerifiedPro && (
              <>
                <span className="font-semibold text-foreground">Request review:</span>{" "}
                <Button
                  size="sm"
                  onClick={() => {
                    void toast.success("Review request sent to admins.", {
                      description: "We'll review your contributions for Verified Pro.",
                    });
                  }}
                >
                  Request review
                </Button>
              </>
            )}
          </p>
        </div>

        <div className="mb-6 flex items-center gap-6 border-b border-border pb-2">
          {(["Badges", "Activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative pb-2 text-sm font-semibold transition-colors ${
                tab === t ? "text-brand" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
              {tab === t && (
                <motion.div
                  layoutId="achTab"
                  className="absolute inset-x-0 bottom-0 h-1 w-full bg-brand rounded-full"
                />
              )}
            </button>
          ))}
          {tab === "Activity" && (
            <div className="flex items-center gap-2 border-l border-border pl-4 ml-4">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {(["all", "posts", "comments"] as ActivityFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setActivityFilter(f)}
                  className={`text-xs px-2 py-1 rounded border ${
                    activityFilter === f
                      ? "border-brand text-brand bg-brand/10"
                      : "border-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {tab === "Badges" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {badgeProgress.map((bp) => {
                  const done = bp.unlocked;
                  const Icon = iconFor(bp.badge.icon);
                  const pct = Math.min(100, Math.round((bp.current / bp.badge.target) * 100));
                  return (
                    <div
                      key={bp.badge.id}
                      className={`rounded-2xl border p-5 ${
                        done ? "border-brand/40 bg-brand/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-radius-md ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {done ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-body text-sm font-medium text-foreground">
                              {bp.badge.name}
                            </p>
                            {done ? (
                              <span className="text-[10px] font-bold text-brand/70 uppercase tracking-wider">
                                {RARITY_LABELS[bp.badge.rarity]}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
                                Locked
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {bp.badge.description}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">
                              {CATEGORY_LABELS[bp.badge.category]}
                            </span>
                            <span className="text-muted-foreground">
                              {bp.current} / {bp.badge.target}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/50">
                            <div
                              className="h-full rounded-full bg-brand transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {done ? "Unlocked" : `${bp.current} / ${bp.badge.target}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "Activity" && (
              <div className="divide-y divide-border rounded-xl border border-border bg-card">
                {filteredActivity.length === 0 && (
                  <p className="p-10 text-center text-sm text-muted-foreground">
                    No activity yet. Your posts and comments will show up here.
                  </p>
                )}
                {filteredActivity.slice(0, 20).map((a) => (
                  <Link
                    key={a.key}
                    href={a.href}
                    className="flex items-baseline gap-3 p-4 transition-colors hover:bg-muted/50"
                  >
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">
                      {a.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {a.text}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.at ? formatDistanceToNowStrict(new Date(a.at), { addSuffix: true }) : ""}
                    </span>
                  </Link>
                ))}
                {filteredActivity.length > 20 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Showing 20 most recent activities.
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="lg:col-span-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-sm font-bold text-foreground">Verification path</h2>
              {profile?.isVerifiedPro ? (
                <p className="mt-2 text-sm text-muted-foreground">Your profile is verified.</p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Earn Trusted Voice and Generous to become eligible for Verified Pro.
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${pathPercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {pathDone} of {pathBadges.length} badges earned
                  </p>
                </>
              )}
            </div>

            {/* Category summary */}
            <div className="mt-5 rounded-xl border border-border bg-card p-5">
              <h2 className="font-heading text-sm font-bold text-foreground">Badge categories</h2>
              <div className="mt-3 space-y-2">
                {["publishing", "helping", "community", "trust", "longevity"].map((cat) => {
                  const catBadges = badgeProgress.filter((b) => b.badge.category === cat);
                  const catUnlocked = catBadges.filter((b) => b.unlocked).length;
                  return (
                    <div key={cat} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {CATEGORY_LABELS[cat]}
                      </span>
                      <span className="font-semibold text-foreground">
                        {catUnlocked} / {catBadges.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
