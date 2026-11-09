import { Bookmark, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { QueryErrorState } from "@/components/QueryErrorState";
import { getSavedPostIds } from "@/lib/users";
import { useAuth } from "@/hooks/auth-context";

const Bookmarks = () => {
  const { user } = useAuth();

  const { data: savedPostIds = {}, isLoading: isSavedLoading, isError: savedError, refetch: refetchSaved } = useQuery({
    queryKey: ['savedPosts', user?.uid],
    queryFn: () => user?.uid ? getSavedPostIds(user.uid) : {},
    enabled: !!user?.uid,
  });

  const { data: posts = [], isLoading: isPostsLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
  });

  const bookmarked = posts.filter(p => savedPostIds[p.id] === true);
  const isLoading = isSavedLoading || isPostsLoading;

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          title="Bookmarks"
          subtitle={`${bookmarked.length} saved post${bookmarked.length !== 1 ? 's' : ''}`}
        />
        {postsError || savedError ? (
          <QueryErrorState title="Couldn't load bookmarks" onRetry={() => { refetchPosts(); refetchSaved(); }} />
        ) : isLoading ? (
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
