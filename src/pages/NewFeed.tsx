import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { PageHeader } from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { Loader2 } from "lucide-react";

const NewFeed = () => {
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const sorted = [...posts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <PageHeader
              title="New Posts"
              subtitle="The freshest posts from freelancers, sorted by time."
            />
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sorted.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
                  No posts yet. Be the first to share!
                </div>
              ) : (
                sorted.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} />
                ))
              )}
            </div>
          </div>
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

export default NewFeed;
