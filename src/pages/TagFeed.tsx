import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { Loader2, Hash } from "lucide-react";

const TagFeed = () => {
  const { tagName } = useParams();
  
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const filteredPosts = posts.filter(post => 
    post.tags && post.tags.includes(tagName || "")
  );
  
  const sorted = [...filteredPosts].sort((a, b) => {
    // Sort by hotness
    const scoreA = (a.score || 0) * 2 + (a.commentCount || 0);
    const scoreB = (b.score || 0) * 2 + (b.commentCount || 0);
    return scoreB - scoreA;
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <PageHeader
              title={`#${tagName}`}
              subtitle={`All discussions, questions, and resources tagged with ${tagName}.`}
            />
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={Hash}
                title={`No posts found for #${tagName}`}
                description="Be the first to start a conversation about this topic!"
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
              <FeedSidebar posts={posts} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TagFeed;
