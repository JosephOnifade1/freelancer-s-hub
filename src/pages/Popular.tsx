import { TrendingUp, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { useAuth } from "@/hooks/auth-context";

const Popular = () => {
  const { user } = useAuth();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  // Real popularity ranking — by score (upvotes minus downvotes), not a
  // fake/hardcoded list. Ties broken by most recent.
  const sorted = [...posts].sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <PageHeader
              title="Popular"
              subtitle="The highest-scoring posts across Borynx."
            />
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Nothing here yet"
                description="Once posts start getting votes, the highest-scoring ones will show up here."
              />
            ) : (
              <div className="space-y-3">
                {sorted.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} />
                ))}
              </div>
            )}
          </div>
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-20">
              <FeedSidebar posts={posts} currentUserUid={user?.uid} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Popular;
