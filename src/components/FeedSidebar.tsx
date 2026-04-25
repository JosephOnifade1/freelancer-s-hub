import { useMemo } from "react";
import { TrendingUp, Sparkles, Users } from "lucide-react";
import { PostData } from "@/components/PostCard";
import { Link } from "react-router-dom";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useQuery } from "@tanstack/react-query";
import { getTopContributors } from "@/lib/users";

export function FeedSidebar({ posts = [] }: { posts?: PostData[] }) {
  const { data: topContributors = [] } = useQuery({
    queryKey: ['top-contributors'],
    queryFn: () => getTopContributors(5),
    refetchInterval: 60000 // Refresh every minute
  });

  const { topTags, stats } = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    const userMap: Record<string, boolean> = {};

    posts.forEach((post) => {
      // Tags
      post.tags?.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Users for stats
      if (post.author?.uid) {
        userMap[post.author.uid] = true;
      }
    });

    const calculatedTags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return {
      topTags: calculatedTags,
      stats: {
        freelancers: Math.max(1, Object.keys(userMap).length),
        totalPosts: posts.length
      }
    };
  }, [posts]);

  return (
    <div className="space-y-5">
      {/* Trending Tags */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Trending Tags
          </h3>
        </div>
        {topTags.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {topTags.map((tag) => (
              <Link
                key={tag.name}
                to={`/tag/${tag.name}`}
                className="rounded-md bg-secondary px-2 py-1 font-body text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-primary"
              >
                #{tag.name}
                <span className="ml-1 text-muted-foreground">{tag.count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Top Contributors */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
          <Sparkles className="h-4 w-4 text-badge-question" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Top Contributors
          </h3>
        </div>
        {topContributors.length === 0 ? (
          <p className="font-body text-xs text-muted-foreground">No contributors yet.</p>
        ) : (
          <div className="space-y-2.5">
            {topContributors.map((user, i) => (
              <Link 
                key={user.uid || user.username} 
                to={user.uid ? `/profile/${user.uid}` : "#"} 
                className="flex items-center gap-2 group hover:opacity-80 transition-opacity"
              >
                <span className="font-heading text-xs font-bold text-muted-foreground w-4">
                  {i + 1}
                </span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-primary/20 text-primary group-hover:opacity-90">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.displayName} className="h-full w-full object-cover" />
                  ) : (
                    user.displayName?.charAt(0).toUpperCase() || user.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="flex-1 font-body text-xs font-medium text-foreground group-hover:text-primary transition-colors flex items-center gap-1">
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

      {/* Community Stats */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-badge-resource" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Community Live Stats
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{stats.freelancers}</p>
            <p className="font-body text-[11px] text-[#9CA3AF]">Active Members</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">{stats.totalPosts}</p>
            <p className="font-body text-[11px] text-[#9CA3AF]">Total Posts</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">98%</p>
            <p className="font-body text-[11px] text-[#9CA3AF]">Helpful rate</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">&lt; 1h</p>
            <p className="font-body text-[11px] text-[#9CA3AF]">Avg Response</p>
          </div>
        </div>
      </div>
    </div>
  );
}
