import { useMemo, type ReactNode } from "react";
import { Flame, Award, Users, Compass, TrendingUp } from "lucide-react";
import { PostData } from "@/components/PostCard";
import { Link } from "react-router-dom";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useQuery } from "@tanstack/react-query";
import { getTopContributors } from "@/lib/users";
import { fetchAllCommunities, getUserCommunities } from "@/lib/communities";
import { getMostActiveThisWeek, getUserStreak, getCommunityHealthStats } from "@/lib/stats";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function SidebarQuery({ label, isError, isLoading, onRetry, children }: {
  label: string;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isError) return (
    <p role="alert" className="font-body text-xs text-muted-foreground">
      Couldn't load {label}. <button type="button" onClick={onRetry} className="font-semibold text-brand hover:underline">Try again</button>
    </p>
  );
  if (isLoading) return <p role="status" className="font-body text-xs text-muted-foreground">Loading {label}…</p>;
  return <>{children}</>;
}

type FeedState = "loading" | "error" | "ready";

export function FeedSidebar({ posts = [], currentUserUid, feedState = "ready" }: {
  posts?: PostData[]; currentUserUid?: string; feedState?: FeedState;
}) {
  const contributorsQuery = useQuery({
    queryKey: ["top-contributors"],
    queryFn: () => getTopContributors(5),
    refetchInterval: 60000,
  });

  const spacesQuery = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const membershipsQuery = useQuery({
    queryKey: ["userCommunities", currentUserUid],
    queryFn: () => (currentUserUid ? getUserCommunities(currentUserUid) : []),
    enabled: !!currentUserUid,
  });

  const activityQuery = useQuery({
    queryKey: ["most-active-week"],
    queryFn: () => getMostActiveThisWeek(5),
    refetchInterval: 60000,
  });

  const streakQuery = useQuery({
    queryKey: ["user-streak", currentUserUid],
    queryFn: () => (currentUserUid ? getUserStreak(currentUserUid) : null),
    enabled: !!currentUserUid,
  });

  const healthQuery = useQuery({
    queryKey: ["community-health"],
    queryFn: getCommunityHealthStats,
    refetchInterval: 120000,
  });

  const topContributors = contributorsQuery.data ?? [];
  const activeSpaces = spacesQuery.data ?? [];
  const joinedSlugs = membershipsQuery.data ?? [];
  const mostActive = activityQuery.data ?? [];
  const streak = streakQuery.data;
  const health = healthQuery.data;

  const { topTags, stats } = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const userMap: Record<string, boolean> = {};

    posts.forEach((post) => {
      post.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      if (post.author?.uid) userMap[post.author.uid] = true;
    });

    const calculatedTags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      topTags: calculatedTags,
      stats: {
        authorsInFeed: Object.keys(userMap).length,
        totalPosts: posts.length,
      },
    };
  }, [posts]);

  return (
    <div className="space-y-4">
      {/* Trending Tags */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-1 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Flame className="h-3.5 w-3.5 text-muted-foreground" />
          <h3>Trending Tags</h3>
        </div>
        {feedState !== "ready" ? (
          <p role="status" className="font-body text-xs text-muted-foreground">{feedState === "error" ? "Feed tags unavailable." : "Loading feed tags…"}</p>
        ) : topTags.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {topTags.map((tag) => (
              <Link
                key={tag.name}
                to={`/tag/${tag.name}`}
                className="rounded-md bg-background border border-border px-2 py-0.5 font-body text-[10px] font-medium text-muted-foreground transition-all hover:text-foreground"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top Contributors */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-1 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Award className="h-3.5 w-3.5 text-muted-foreground" />
          <h3>Top Contributors</h3>
        </div>
        <SidebarQuery label="contributors" {...contributorsQuery} onRetry={() => void contributorsQuery.refetch()}>
          {topContributors.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">No contributors yet.</p>
          ) : (
            <div className="space-y-2">
              {topContributors.map((user, i) => (
                <Link
                  key={user.uid || user.username}
                  to={user.uid ? `/f/${user.username || user.uid}` : "#"}
                  className="flex items-center gap-1.5 group hover:opacity-80 transition-opacity"
                >
                  <span className="font-heading text-xs font-bold text-muted-foreground w-3">{i + 1}</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full font-heading text-[9px] font-bold overflow-hidden bg-muted text-foreground group-hover:opacity-90">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                    ) : (
                      user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="flex-1 font-body text-xs font-medium text-foreground group-hover:underline transition-colors flex items-center gap-1">
                    {user.displayName || user.username}
                    <VerifiedBadge isVerified={user.isVerifiedPro} size={9} showTooltip={false} />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SidebarQuery>
      </div>

      {/* Active Spaces */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-1 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Compass className="h-3.5 w-3.5 text-muted-foreground" />
          <h3>Active Spaces</h3>
        </div>
        <SidebarQuery label="spaces" {...spacesQuery} onRetry={() => void spacesQuery.refetch()}>
          {currentUserUid && membershipsQuery.isLoading && <p role="status" className="mb-1 text-xs text-muted-foreground">Loading your memberships…</p>}
        {currentUserUid && membershipsQuery.isError && <p role="alert" className="mb-1 text-xs text-muted-foreground">Memberships unavailable. <button type="button" onClick={() => void membershipsQuery.refetch()} className="font-semibold text-brand hover:underline">Try again</button></p>}
          {activeSpaces.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">No spaces yet.</p>
          ) : (
            <div className="space-y-2">
              {activeSpaces.slice(0, 5).map((space) => (
                <Link
                  key={space.slug}
                  to={`/b/${space.slug}`}
                  className="flex items-center justify-between group hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground font-heading text-[10px] font-bold">
                      {space.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-xs font-semibold text-foreground group-hover:underline transition-colors truncate">
                        {space.name}
                      </p>
                      <p className="font-body text-[10px] text-muted-foreground">
                        {space.memberCount.toLocaleString()} members
                      </p>
                    </div>
                  </div>
                  {!membershipsQuery.isError && joinedSlugs.includes(space.slug) && (
                    <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-brand text-[9px] font-bold text-brand-foreground">
                      ✓
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </SidebarQuery>
      </div>

      {/* Most Active This Week */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-1 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <h3>Most Active This Week</h3>
        </div>
        <SidebarQuery label="weekly activity" {...activityQuery} onRetry={() => void activityQuery.refetch()}>
          {mostActive.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">No activity yet this week.</p>
          ) : (
            <div className="space-y-2">
              {mostActive.map((c, i) => (
                <Link
                  key={c.uid}
                  to={`/f/${c.username || c.uid}`}
                  className="flex items-center justify-between p-1 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums text-xs font-bold text-muted-foreground/60 w-3">{i + 1}</span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg overflow-hidden bg-muted text-foreground font-heading text-[10px] font-bold">
                      {c.avatarUrl ? (
                        <img src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" />
                      ) : (
                        (c.displayName || c.username || "?").charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-body text-xs font-semibold text-foreground">
                      <span>{c.displayName || c.username}</span>
                      <VerifiedBadge isVerified={c.isVerifiedPro} size={9} showTooltip={false} />
                    </div>
                  </div>
                  <span className="tabular-nums text-xs font-bold text-foreground">
                    {c.contributions} {c.contributions === 1 ? "contribution" : "contributions"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </SidebarQuery>
      </div>

      {/* Your Streak — personal, only shown when logged in */}
      {currentUserUid && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-3">
          <h3 className="font-heading text-sm font-bold text-foreground">Your Streak</h3>
          <SidebarQuery label="your streak" {...streakQuery} onRetry={() => void streakQuery.refetch()}>
            {streak && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning border border-warning/20">
                    <Flame className="h-5 w-5 fill-warning" />
                  </div>
                  <div>
                    <div className="font-heading text-base font-black text-foreground">{streak.streakDays} days</div>
                    <div className="font-body text-[10px] text-muted-foreground">
                      {streak.streakDays > 0 ? "Keep it going" : "Post or comment to start a streak"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {WEEKDAY_LABELS.map((day, idx) => {
                    const isActive = streak.activeWeekdays.includes(idx);
                    return (
                      <div
                        key={idx}
                        className={`flex h-6 w-6 items-center justify-center rounded-full tabular-nums text-[10px] font-bold ${
                          isActive ? "bg-brand text-brand-foreground shadow-md shadow-brand/20" : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {day}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </SidebarQuery>
        </div>
      )}

      {/* Feed activity */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-2 flex items-center gap-2 border-b border-border pb-1 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <h3>Feed Activity</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="font-heading text-base font-bold text-foreground">{feedState === "ready" ? stats.authorsInFeed : "—"}</p>
            <p className="font-body text-[10px] text-muted-foreground">Authors in feed</p>
          </div>
          <div>
            <p className="font-heading text-base font-bold text-foreground">{feedState === "ready" ? stats.totalPosts : "—"}</p>
            <p className="font-body text-[10px] text-muted-foreground">Posts in feed</p>
          </div>
          <div>
            <p className="font-heading text-base font-bold text-foreground">{!healthQuery.isError && health ? `${health.helpfulRate}%` : "—"}</p>
            <p className="font-body text-[10px] text-muted-foreground">Posts with replies</p>
          </div>
          <div>
            <p className="font-heading text-base font-bold text-foreground">{!healthQuery.isError ? health?.avgResponseLabel ?? "—" : "—"}</p>
            <p className="font-body text-[10px] text-muted-foreground">Avg response</p>
          </div>
        </div>
        {healthQuery.isError && <p role="alert" className="mt-2 text-xs text-muted-foreground">Community activity unavailable. <button type="button" onClick={() => void healthQuery.refetch()} className="font-semibold text-brand hover:underline">Try again</button></p>}
      </div>
    </div>
  );
}
