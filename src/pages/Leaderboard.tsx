import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Flame, Users, TrendingUp, Clock } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useQuery } from "@tanstack/react-query";
import { fetchModerationUsers } from "@/lib/reports";
import { fetchPosts } from "@/lib/posts";
import { Loader2 } from "lucide-react";

type LeaderboardMetric = "reputation" | "posts" | "streak";

const METRICS: { id: LeaderboardMetric; label: string; icon: typeof Trophy }[] = [
  { id: "reputation", label: "Reputation", icon: Trophy },
  { id: "posts", label: "Posts", icon: Users },
  { id: "streak", label: "Day streak", icon: Flame },
];

export default function Leaderboard() {
  const [metric, setMetric] = useState<LeaderboardMetric>("reputation");

  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["leaderboard-users"],
    queryFn: () => fetchModerationUsers(50),
  });

  const { data: allPosts = [], isError: postsError } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  // Derive per-user post counts for the "Posts" metric.
  const postCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allPosts.forEach((p) => {
      if (p.isDeleted || !p.author?.uid) return;
      counts[p.author.uid] = (counts[p.author.uid] || 0) + 1;
    });
    return counts;
  }, [allPosts]);

  const ranked = useMemo(() => {
    const list = users.map((u) => ({
      ...u,
      posts: postCounts[u.uid] || 0,
      streak: Math.floor(u.reputation / 100), // proxy until streak table exists
    }));
    return list.sort((a, b) => {
      if (metric === "reputation") return b.reputation - a.reputation;
      if (metric === "posts") return b.posts - a.posts;
      return b.streak - a.streak;
    });
  }, [users, postCounts, metric]);

  if (isError || postsError) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-16">
          <QueryErrorState
            title="Couldn't load leaderboard"
            onRetry={refetch}
          />
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (ranked.length === 0) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <EmptyState
            icon={Trophy}
            title="No contributors yet"
            description="Be the first to post and climb the leaderboard."
            action={
              <Link to="/submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Create a post
              </Link>
            }
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Leaderboard
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Top contributors by {metric}. Rankings update as activity happens.
            </p>
          </div>
          <div className="flex gap-2">
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  metric === m.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <th className="p-4 font-semibold">Rank</th>
                <th className="p-4 font-semibold">Contributor</th>
                <th className="p-4 font-semibold text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 20).map((u, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : String(i + 1);
                const isTop3 = i < 3;
                return (
                  <tr
                    key={u.uid}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isTop3 ? "bg-brand/10" : ""}`}
                  >
                    <td className="p-4 font-mono font-bold">
                      {isTop3 ? medal : <span className="text-muted-foreground">{medal}</span>}
                    </td>
                    <td className="p-4">
                      <Link to={`/f/${u.username}`} className="flex items-center gap-2">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-heading text-xs font-bold overflow-hidden">
                            {(u.username || u.name).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{u.name}</div>
                          <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="p-4 font-mono font-bold text-right text-foreground">
                      {metric === "reputation" ? u.reputation.toLocaleString() : metric === "posts" ? u.posts.toLocaleString() : u.streak.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {ranked.length > 20 && (
            <div className="px-4 py-3 text-center text-xs text-muted-foreground border-t border-border/50">
              Showing top 20 of {ranked.length} contributors.
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
