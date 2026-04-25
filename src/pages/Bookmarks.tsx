import { Bookmark, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { getUserProfile } from "@/lib/users";
import { useAuth } from "@/hooks/useAuth";

const Bookmarks = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user?.uid ? getUserProfile(user.uid) : null,
    enabled: !!user?.uid,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  const savedPostIds = profile?.savedPosts || {};
  const bookmarked = posts.filter(p => savedPostIds[p.id] === true);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          title="Bookmarks"
          subtitle={`${bookmarked.length} saved post${bookmarked.length !== 1 ? 's' : ''}`}
        />
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bookmarked.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="No bookmarks yet"
            description="Tap the bookmark icon on any post to save it here for later."
          />
        ) : (
          <div className="space-y-3">
            {bookmarked.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Bookmarks;
