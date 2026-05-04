import { useState, useMemo } from "react";
import { Flame, Clock, TrendingUp, ChevronDown } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { getUserProfile } from "@/lib/users";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortType, sortPosts } from "@/lib/sorting";
import { FeedFilter } from "@/components/FeedFilter";

type Scope = "all" | "following";

const Index = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<SortType>("hot");
  
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const displayedPosts = useMemo(() => {
    let filtered = [...posts];

    if (scope === "following") {
      const followingList = profile?.followingList || {};
      filtered = filtered.filter((post) => post.author.uid && followingList[post.author.uid]);
    }

    return sortPosts(filtered, sort, profile?.favoriteTopics);
  }, [posts, scope, sort, profile]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-10"> {/* 40px gap */}
          {/* Main Feed */}
          <div className="flex-1 min-w-0">
            {/* Scope & Sort Header */}
            <div className="mb-6 flex items-center justify-between border-b border-[var(--border-main)] pb-4">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setScope("all")}
                  className={cn(
                    "font-body text-sm font-semibold transition-all relative py-1",
                    scope === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Feed
                  {scope === "all" && (
                    <div className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-[var(--brand-primary)] rounded-full shadow-[0_0_8px_var(--brand-primary)]" />
                  )}
                </button>
                <button
                  onClick={() => setScope("following")}
                  className={cn(
                    "font-body text-sm font-semibold transition-all relative py-1",
                    scope === "following" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Following
                  {scope === "following" && (
                    <div className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-[var(--brand-primary)] rounded-full shadow-[0_0_8px_var(--brand-primary)]" />
                  )}
                </button>
              </div>

              <FeedFilter value={sort} onChange={setSort} />
            </div>

            {/* Posts */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
                  Loading posts...
                </div>
              ) : displayedPosts.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
                  {scope === "following" 
                    ? "You aren't following anyone with posts yet." 
                    : "No posts yet. Be the first to share!"}
                </div>
              ) : (
                displayedPosts.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} />
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-20">
              <FeedSidebar posts={posts} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
