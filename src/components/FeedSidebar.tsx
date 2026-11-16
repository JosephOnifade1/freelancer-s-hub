import { useMemo, type ReactNode } from "react";
import { Flame, Award, Users, Compass, TrendingUp } from "lucide-react";
import { PostData } from "@/components/PostCard";
import { AppLink as Link } from "@/components/AppLink";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useQuery } from "@tanstack/react-query";
import { getTopContributors } from "@/lib/users";
import { fetchAllCommunities, getUserCommunities } from "@/lib/communities";
import { getMostActiveThisWeek, getUserStreak, getCommunityHealthStats } from "@/lib/stats";

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Returns a deterministic hue (0-360) from a string's first char code. */
function nameHue(name?: string): number {
  if (!name) return 200;
  return (name.charCodeAt(0) * 47) % 360;
}

function SidebarQuery({ label, isError, isLoading, onRetry, children }: {
  label: string;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (isError) return (
    <p role="alert" className="text-xs text-ink-3">
      Couldn't load {label}.{" "}
      <button type="button" onClick={onRetry} className="font-semibold text-ember hover:underline">
        Try again
      </button>
    </p>
  );
  if (isLoading) return (
    <div className="space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-7 w-full rounded bg-sunken skeleton-bx" />
      ))}
    </div>
  );
  return <>{children}</>;
}

/** Reusable widget shell using Agent 2 `.panel` pattern. */
function Widget({ icon: Icon, title, iconClass = "text-ember", children }: {
  icon: React.ElementType;
  title: string;
  iconClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="panel rounded-xl p-3">
      <div className="mb-2.5 flex items-center gap-2 hairline-b pb-2">
        <Icon className={`h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden />
        <h3 className="eyebrow text-[10px] tracking-widest uppercase text-ink-3">{title}</h3>
      </div>
      {children}
    </div>
  );
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
    <div className="space-y-3">
      {/* Trending Tags */}
      <Widget icon={Flame} title="Trending Tags" iconClass="text-ember">
        {feedState !== "ready" ? (
          <p role="status" className="text-xs text-ink-3">
            {feedState === "error" ? "Feed tags unavailable." : "Loading feed tags…"}
          </p>
        ) : topTags.length === 0 ? (
          <p className="text-xs text-ink-3">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {topTags.map((tag) => (
              <Link
                key={tag.name}
                href={`/tag/${tag.name}`}
                className="tag text-[10px] hover:bg-ember/10 hover:text-ember transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
      </Widget>

      {/* Top Contributors */}
      <Widget icon={Award} title="Top Contributors" iconClass="text-gold">
        <SidebarQuery label="contributors" {...contributorsQuery} onRetry={() => void contributorsQuery.refetch()}>
          {topContributors.length === 0 ? (
            <p className="text-xs text-ink-3">No contributors yet.</p>
          ) : (
            <div className="space-y-1.5">
              {topContributors.map((user, i) => {
                const hue = nameHue(user.displayName || user.username);
                return (
                  <Link
                    key={user.uid || user.username}
                    href={user.uid ? `/f/${user.username || user.uid}` : "#"}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sunken transition-colors group"
                  >
                    <span className="num text-[10px] font-bold text-ink-4 w-3 shrink-0">{i + 1}</span>
                    <div
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white overflow-hidden"
                      style={{ background: `hsl(${hue}deg 55% 38%)` }}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                      ) : (
                        (user.displayName?.charAt(0) || user.username?.charAt(0) || "?").toUpperCase()
                      )}
                    </div>
                    <span className="flex-1 text-xs font-medium text-ink group-hover:text-ink truncate flex items-center gap-1">
                      {user.displayName || user.username}
                      <VerifiedBadge isVerified={user.isVerifiedPro} size={9} showTooltip={false} />
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </SidebarQuery>
      </Widget>

      {/* Active Spaces */}
      <Widget icon={Compass} title="Active Spaces" iconClass="text-verdigris">
        <SidebarQuery label="spaces" {...spacesQuery} onRetry={() => void spacesQuery.refetch()}>
          {currentUserUid && membershipsQuery.isLoading && (
            <p role="status" className="mb-1 text-xs text-ink-3">Loading your memberships…</p>
          )}
          {currentUserUid && membershipsQuery.isError && (
            <p role="alert" className="mb-1 text-xs text-ink-3">
              Memberships unavailable.{" "}
              <button type="button" onClick={() => void membershipsQuery.refetch()} className="font-semibold text-ember hover:underline">
                Try again
              </button>
            </p>
          )}
          {activeSpaces.length === 0 ? (
            <p className="text-xs text-ink-3">No spaces yet.</p>
          ) : (
            <div className="space-y-1">
              {activeSpaces.slice(0, 5).map((space) => {
                const hue = nameHue(space.name);
                return (
                  <Link
                    key={space.slug}
                    href={`/b/${space.slug}`}
                    className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-sunken transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                        style={{ background: `hsl(${hue}deg 50% 35%)` }}
                      >
                        {space.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink group-hover:underline truncate">
                          {space.name}
                        </p>
                        <p className="eyebrow text-[9px]">
                          {space.memberCount.toLocaleString()} members
                        </p>
                      </div>
                    </div>
                    {!membershipsQuery.isError && joinedSlugs.includes(space.slug) && (
                      <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-verdigris text-[9px] font-bold text-white">
                        ✓
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </SidebarQuery>
      </Widget>

      {/* Most Active This Week */}
      <Widget icon={TrendingUp} title="Most Active This Week" iconClass="text-ember">
        <SidebarQuery label="weekly activity" {...activityQuery} onRetry={() => void activityQuery.refetch()}>
          {mostActive.length === 0 ? (
            <p className="text-xs text-ink-3">No activity yet this week.</p>
          ) : (
            <div className="space-y-1">
              {mostActive.map((c, i) => {
                const hue = nameHue(c.displayName || c.username);
                return (
                  <Link
                    key={c.uid}
                    href={`/f/${c.username || c.uid}`}
                    className="flex items-center justify-between rounded-md px-1.5 py-1 hover:bg-sunken transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="num text-[10px] font-bold text-ink-4 w-3">{i + 1}</span>
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold text-white overflow-hidden"
                        style={{ background: `hsl(${hue}deg 50% 35%)` }}
                      >
                        {c.avatarUrl ? (
                          <img src={c.avatarUrl} alt={c.displayName} className="h-full w-full object-cover" />
                        ) : (
                          (c.displayName || c.username || "?").charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-ink">
                        <span>{c.displayName || c.username}</span>
                        <VerifiedBadge isVerified={c.isVerifiedPro} size={9} showTooltip={false} />
                      </div>
                    </div>
                    <span className="num text-[10px] font-bold text-ink-3 shrink-0">
                      {c.contributions}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </SidebarQuery>
      </Widget>

      {/* Your Streak — personal, only shown when logged in */}
      {currentUserUid && (
        <Widget icon={Flame} title="Your Streak" iconClass="text-ember">
          <SidebarQuery label="your streak" {...streakQuery} onRetry={() => void streakQuery.refetch()}>
            {streak && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ember/10 border border-ember/25 text-ember">
                    <Flame className="h-5 w-5 fill-ember/60" />
                  </div>
                  <div>
                    <div className="num font-heading text-base font-black text-ink">{streak.streakDays} days</div>
                    <div className="eyebrow text-[9.5px]">
                      {streak.streakDays > 0 ? "Keep it going" : "Post or comment to start a streak"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {WEEKDAY_LABELS.map((day, idx) => {
                    const isActive = streak.activeWeekdays.includes(idx);
                    return (
                      <div
                        key={idx}
                        className={`flex h-6 w-6 items-center justify-center rounded-full num text-[10px] font-bold ${
                          isActive
                            ? "bg-ember text-white"
                            : "bg-sunken text-ink-3"
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
        </Widget>
      )}

      {/* Feed Activity */}
      <Widget icon={Users} title="Feed Activity" iconClass="text-ink-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="num font-heading text-base font-bold text-ink">
              {feedState === "ready" ? stats.authorsInFeed : "—"}
            </p>
            <p className="eyebrow text-[9.5px]">Authors in feed</p>
          </div>
          <div>
            <p className="num font-heading text-base font-bold text-ink">
              {feedState === "ready" ? stats.totalPosts : "—"}
            </p>
            <p className="eyebrow text-[9.5px]">Posts in feed</p>
          </div>
          <div>
            <p className="num font-heading text-base font-bold text-ink">
              {!healthQuery.isError && health ? `${health.helpfulRate}%` : "—"}
            </p>
            <p className="eyebrow text-[9.5px]">Posts with replies</p>
          </div>
          <div>
            <p className="num font-heading text-base font-bold text-ink">
              {!healthQuery.isError ? health?.avgResponseLabel ?? "—" : "—"}
            </p>
            <p className="eyebrow text-[9.5px]">Avg response</p>
          </div>
        </div>
        {healthQuery.isError && (
          <p role="alert" className="mt-2 text-xs text-ink-3">
            Activity unavailable.{" "}
            <button type="button" onClick={() => void healthQuery.refetch()} className="font-semibold text-ember hover:underline">
              Try again
            </button>
          </p>
        )}
      </Widget>
    </div>
  );
}
