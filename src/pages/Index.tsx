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

type Scope = "all" | "following";
type Sort = "best" | "new" | "hot";

const Index = () => {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("all");
  const [sort, setSort] = useState<Sort>("hot");
  
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

    if (sort === "hot" || sort === "best") {
      filtered.sort((a, b) => {
        const scoreA = (a.score || 0) * 2 + (a.commentCount || 0);
        const scoreB = (b.score || 0) * 2 + (b.commentCount || 0);
        return scoreB - scoreA;
      });
    } else if (sort === "new") {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    return filtered;
  }, [posts, scope, sort, profile]);

  const SortIcon = sort === "hot" ? Flame : sort === "new" ? Clock : TrendingUp;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-10"> {/* 40px gap */}
          {/* Main Feed */}
          <div className="flex-1 min-w-0">
            {/* Scope & Sort Header */}
            <div className="mb-6 flex items-center justify-between border-b border-white/5 pb-4">
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
                    <div className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-primary rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
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
                    <div className="absolute -bottom-[17px] left-0 right-0 h-[2px] bg-primary rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  )}
                </button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full bg-transparent border border-[#94A3B8]/30 px-4 py-1.5 font-body text-xs font-medium text-[#94A3B8] hover:text-foreground hover:border-foreground transition-all">
                    <SortIcon className="h-3.5 w-3.5" />
                    <span className="capitalize">{sort}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 bg-[#111118] border-white/10 font-body">
                  <DropdownMenuItem 
                    onClick={() => setSort("best")}
                    className={cn("cursor-pointer flex items-center gap-2", sort === "best" && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary")}
                  >
                    <TrendingUp className="h-4 w-4" />
                    <span>Best</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSort("hot")}
                    className={cn("cursor-pointer flex items-center gap-2", sort === "hot" && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary")}
                  >
                    <Flame className="h-4 w-4" />
                    <span>Hot</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSort("new")}
                    className={cn("cursor-pointer flex items-center gap-2", sort === "new" && "bg-primary/10 text-primary focus:bg-primary/10 focus:text-primary")}
                  >
                    <Clock className="h-4 w-4" />
                    <span>New</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
