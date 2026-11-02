import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { Loader2, Hash, ArrowLeft } from "lucide-react";

const TagFeed = () => {
  const { tagName } = useParams<{ tagName: string }>();
  const navigate = useNavigate();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const normalizedTag = (tagName || "").toLowerCase().trim();

  const filteredPosts = posts.filter(post =>
    post.tags && post.tags.some(t => t.toLowerCase().trim() === normalizedTag)
  );
  
  const sorted = [...filteredPosts].sort((a, b) => {
    const scoreA = (a.score || 0) * 2 + (a.commentCount || 0);
    const scoreB = (b.score || 0) * 2 + (b.commentCount || 0);
    return scoreB - scoreA;
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* SPA-safe back navigation */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 mb-5 font-body text-sm text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Hash className="h-4 w-4" />
                </span>
                <h1 className="font-heading text-2xl font-bold text-foreground">#{tagName}</h1>
              </div>
              <p className="font-body text-sm text-muted-foreground ml-10">
                {isLoading ? "Loading…" : `${sorted.length} post${sorted.length !== 1 ? "s" : ""} tagged with #${tagName}`}
              </p>
            </div>

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
