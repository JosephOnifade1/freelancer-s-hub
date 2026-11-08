import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { motion } from "framer-motion";
import { BadgeCheck, BookOpen, Calendar, Flame, Heart, Lock, MessageSquare, Star, Trophy, Zap, type LucideIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, getUserResourcesCount } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor } from "@/lib/comments";
import { getUserStreak } from "@/lib/stats";

type Tab = "Badges" | "Activity";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  current: number;
  target: number;
}

const Achievements = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Badges");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user?.uid ? getUserProfile(user.uid) : null),
    enabled: !!user?.uid,
  });

  const { data: allPosts = [] } = useQuery({ queryKey: ["posts"], queryFn: fetchPosts, enabled: !!profile });

  const { data: resourceCount = 0 } = useQuery({
    queryKey: ["user-resources-count", user?.uid],
    queryFn: () => (user?.uid ? getUserResourcesCount(user.uid) : 0),
    enabled: !!user?.uid,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["userComments", profile?.uid],
    queryFn: () => (profile ? fetchCommentsByAuthor(profile) : []),
    enabled: !!profile,
  });

  const { data: streak } = useQuery({
    queryKey: ["user-streak", user?.uid],
    queryFn: () => (user?.uid ? getUserStreak(user.uid) : null),
    enabled: !!user?.uid,
  });

  const reputation = profile?.reputation ?? 0;
  const commentUpvotes = comments.reduce((sum, c) => sum + Math.max(0, c.score || 0), 0);
  const streakDays = streak?.streakDays ?? 0;

  const myPosts = useMemo(
    () => (profile ? allPosts.filter((p) => !p.isDeleted && p.author?.uid === profile.uid) : []),
    [allPosts, profile],
  );
  const mostCommented = myPosts.reduce((max, p) => Math.max(max, p.commentCount || 0), 0);

  const badges: BadgeDef[] = [
    { id: "first-post", name: "First Post", description: "Publish your first post.", icon: Flame, current: myPosts.length, target: 1 },
    { id: "rising-voice", name: "Rising Voice", description: "Reach 100 reputation.", icon: Zap, current: reputation, target: 100 },
    { id: "helper", name: "Helper", description: "Get 10 upvotes on your comments.", icon: Heart, current: commentUpvotes, target: 10 },
    { id: "trusted-voice", name: "Trusted Voice", description: "Reach 1,000 reputation.", icon: Star, current: reputation, target: 1000 },
    { id: "consistent", name: "Consistent", description: "Post or comment 30 days in a row.", icon: Calendar, current: streakDays, target: 30 },
    { id: "generous", name: "Generous", description: "Share 5 resource posts.", icon: BookOpen, current: resourceCount, target: 5 },
    { id: "veteran", name: "Veteran Freelancer", description: "Reach 5,000 reputation.", icon: Trophy, current: reputation, target: 5000 },
    { id: "convo-starter", name: "Conversation Starter", description: "Get 50 comments on a single post.", icon: MessageSquare, current: mostCommented, target: 50 },
  ];

  const unlocked = (b: BadgeDef) => b.current >= b.target;
  const unlockedCount = badges.filter(unlocked).length;

  const pathBadges = badges.filter((b) => b.id === "trusted-voice" || b.id === "generous");
  const pathDone = pathBadges.filter(unlocked).length;
  const pathPercent = Math.round((pathDone / pathBadges.length) * 100);

  const activity = useMemo(() => {
    const items = [
      ...myPosts.map((p) => ({ key: `p-${p.id}`, kind: "Posted", text: p.title, at: p.createdAt || 0, href: `/p/${p.id}` })),
      ...comments.filter((c) => !c.isDeleted).map((c) => ({ key: `c-${c.id}`, kind: "Commented", text: c.body, at: c.createdAt, href: `/p/${c.postId}` })),
    ];
    return items.sort((a, b) => b.at - a.at).slice(0, 15);
  }, [myPosts, comments]);

  const stats = [
    { label: "Reputation", value: reputation.toLocaleString() },
    { label: "Badges", value: `${unlockedCount} / ${badges.length}` },
    { label: "Posts", value: myPosts.length.toLocaleString() },
    { label: "Day streak", value: String(streakDays) },
  ];

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-6">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground md:text-3xl">Achievements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Badges you earn by posting, helping others and sharing resources.</p>
        </div>

        <div className="mb-6 grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:grid-cols-4 md:divide-y-0">
          {stats.map((s) => (
            <div key={s.label} className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="mt-1 font-heading text-2xl font-bold text-foreground">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Verified Pro path: eligibility is automatic, granting is reviewed */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
          <BadgeCheck className="h-5 w-5 shrink-0 text-brand" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Verified Pro</span> is earned, not
            bought: reach <span className="font-semibold text-foreground">1,000 reputation</span>{" "}
            (Trusted Voice) and an admin reviews your contributions before granting the badge.
            {reputation >= 1000
              ? " You're past the reputation threshold — you're eligible for review."
              : ` You need ${(1000 - reputation).toLocaleString()} more reputation to become eligible.`}
          </p>
        </div>

        <div className="mb-6 flex items-center gap-6 border-b border-border">
          {(["Badges", "Activity"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative pb-3 text-sm font-semibold transition-colors ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t}
              {tab === t && <motion.div layoutId="achTab" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {tab === "Badges" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {badges.map((b) => {
                  const done = unlocked(b);
                  const Icon = b.icon;
                  const pct = Math.min(100, Math.round((b.current / b.target) * 100));
                  return (
                    <div key={b.id} className={`rounded-xl border bg-card p-4 ${done ? "border-brand/40" : "border-border"}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {done ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.description}</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {done ? "Unlocked" : `${Math.min(b.current, b.target).toLocaleString()} / ${b.target.toLocaleString()}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "Activity" && (
              <div className="divide-y divide-border rounded-xl border border-border bg-card">
                {activity.length === 0 && (
                  <p className="p-10 text-center text-sm text-muted-foreground">Nothing yet. Your posts and comments will show up here.</p>
                )}
                {activity.map((a) => (
                  <Link key={a.key} to={a.href} className="flex items-baseline gap-3 p-4 transition-colors hover:bg-muted/40">
                    <span className="w-20 shrink-0 text-xs font-medium text-muted-foreground">{a.kind}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {a.at ? formatDistanceToNowStrict(new Date(a.at), { addSuffix: true }) : ""}
                    </span>
                  </Link>
                ))}
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
                  <p className="mt-2 text-sm text-muted-foreground">Earn Trusted Voice and Generous to get verified.</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${pathPercent}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{pathDone} of {pathBadges.length} badges earned</p>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default Achievements;
