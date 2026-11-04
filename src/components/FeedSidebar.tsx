import { useMemo } from "react";
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

export function FeedSidebar({ posts = [], currentUserUid }: { posts?: PostData[]; currentUserUid?: string }) {
  const { data: topContributors = [] } = useQuery({
    queryKey: ["top-contributors"],
    queryFn: () => getTopContributors(5),
    refetchInterval: 60000,
  });

  const { data: activeSpaces = [] } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const { data: joinedSlugs = [] } = useQuery({
    queryKey: ["userCommunities", currentUserUid],
    queryFn: () => (currentUserUid ? getUserCommunities(currentUserUid) : []),
    enabled: !!currentUserUid,
  });

  const { data: mostActive = [] } = useQuery({
    queryKey: ["most-active-week"],
    queryFn: () => getMostActiveThisWeek(5),
    refetchInterval: 60000,
  });

  const { data: streak } = useQuery({
    queryKey: ["user-streak", currentUserUid],
    queryFn: () => (currentUserUid ? getUserStreak(currentUserUid) : null),
    enabled: !!currentUserUid,
  });

  const { data: health } = useQuery({
    queryKey: ["community-health"],
    queryFn: getCommunityHealthStats,
    refetchInterval: 120000,
  });

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
        freelancers: Math.max(1, Object.keys(userMap).length),
        totalPosts: posts.length,
      },
    };
  }, [posts]);

  return (
    <div className="space-y-5">
      {/* Trending Tags */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <h3>Trending Tags</h3>
        </div>
        {topTags.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topTags.map((tag) => (
              <Link
                key={tag.name}
                to={`/tag/${tag.name}`}
                className="rounded-md bg-background border border-border px-2 py-1 font-body text-[11px] font-medium text-muted-foreground transition-all hover:text-foreground"
              >
                #{tag.name}
                <span className="ml-1 text-muted-foreground/60">{tag.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top Contributors */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Award className="h-4 w-4 text-muted-foreground" />
          <h3>Top Contributors</h3>
        </div>
        {topContributors.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No contributors yet.</p>
        ) : (
          <div className="space-y-2.5">
            {topContributors.map((user, i) => (
              <Link
                key={user.uid || user.username}
                to={user.uid ? `/f/${user.username || user.uid}` : "#"}
                className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
              >
                <span className="font-heading text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-muted text-foreground group-hover:opacity-90">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="flex-1 font-body text-xs font-medium text-foreground group-hover:underline transition-colors flex items-center gap-1">
                  {user.displayName || user.username}
                  <VerifiedBadge isVerified={user.isVerifiedPro} size={10} showTooltip={false} />
                </span>
                <span className="font-body text-[10px] text-muted-foreground">
                  <LiveReputation uid={user.uid} fallback={user.reputation} />
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Active Spaces */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Compass className="h-4 w-4 text-muted-foreground" />
          <h3>Active Spaces</h3>
        </div>
        {activeSpaces.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No spaces yet.</p>
        ) : (
          <div className="space-y-2.5">
            {activeSpaces.slice(0, 5).map((space) => (
              <Link
                key={space.slug}
                to={`/b/${space.slug}`}
                className="flex items-center justify-between group hover:opacity-90 transition-opacity"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground font-heading text-[11px] font-bold">
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
                {joinedSlugs.includes(space.slug) && (
                  <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground">
                    ✓
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Most Active This Week (real activity count, not fake XP) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3>Most Active This Week</h3>
        </div>
        {mostActive.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No activity yet this week.</p>
        ) : (
          <div className="space-y-2.5">
            {mostActive.map((c, i) => (
              <Link
                key={c.uid}
                to={`/f/${c.username || c.uid}`}
                className="flex items-center justify-between p-1.5 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="tabular-nums text-xs font-bold text-muted-foreground/60 w-3">{i + 1}</span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden bg-muted text-foreground font-heading text-[10px] font-bold">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" />
                    ) : (
                      (c.displayName || c.username || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex items-center gap-1 font-body text-xs font-semibold text-foreground">
                    <span>{c.displayName || c.username}</span>
                    <VerifiedBadge isVerified={c.isVerifiedPro} size={10} showTooltip={false} />
                  </div>
                </div>
                <span className="tabular-nums text-xs font-bold text-foreground">
                  {c.contributions} {c.contributions === 1 ? "post" : "posts"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Your Streak — personal, only shown when logged in */}
      {currentUserUid && streak && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <h3 className="font-heading text-sm font-bold text-foreground">Your Streak</h3>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/10 text-warning border border-warning/20">
              <Flame className="h-6 w-6 fill-warning" />
            </div>
            <div>
              <div className="font-heading text-lg font-black text-foreground">{streak.streakDays} days</div>
              <div className="font-body text-[11px] text-muted-foreground">
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
                  className={`flex h-7 w-7 items-center justify-center rounded-full tabular-nums text-[11px] font-bold ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Community Live Stats */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-2 [&>h3]:font-heading [&>h3]:text-sm [&>h3]:font-bold [&>h3]:text-foreground">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3>Community Live Stats</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{stats.freelancers}</p>
            <p className="font-body text-[11px] text-muted-foreground">Active Members</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{stats.totalPosts}</p>
            <p className="font-body text-[11px] text-muted-foreground">Total Posts</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{health?.helpfulRate ?? 0}%</p>
            <p className="font-body text-[11px] text-muted-foreground">Helpful rate</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{health?.avgResponseLabel ?? "—"}</p>
            <p className="font-body text-[11px] text-muted-foreground">Avg Response</p>
          </div>
        </div>
      </div>
    </div>
  );
}
