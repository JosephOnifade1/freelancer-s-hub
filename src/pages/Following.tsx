import { Users, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { QueryErrorState } from "@/components/QueryErrorState";
import { getFollowingIds } from "@/lib/users";
import { useAuth } from "@/hooks/auth-context";

const Following = () => {
  const { user } = useAuth();
  
  const { data: posts = [], isLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const { data: followingIds = [], isLoading: followingLoading, isError: followingError, refetch: refetchFollowing } = useQuery({
    queryKey: ['followingIds', user?.uid],
    queryFn: () => (user?.uid ? getFollowingIds(user.uid) : []),
    enabled: !!user?.uid,
  });

  const followingPosts = posts.filter(post => post.author?.uid && followingIds.includes(post.author.uid));
  const sorted = [...followingPosts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <PageHeader
              title="Following"
              subtitle="Posts from freelancers you follow."
            />
            {postsError || followingError ? (
              <QueryErrorState title="Couldn't load your following feed" onRetry={() => { refetchPosts(); refetchFollowing(); }} />
            ) : isLoading || followingLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={Users}
                title="You're not following anyone yet"
                description="Follow other freelancers to see their posts here. Start by exploring the Hot feed."
              />
            ) : (
              <div className="space-y-3">
                {sorted.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} />
                ))}
              </div>
            )}
          </div>
          <aside className="hidden lg:block w-72 shrink-0 self-start sticky top-6">
            <div className="max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
              <FeedSidebar posts={posts} />
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default Following;
