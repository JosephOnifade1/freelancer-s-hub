import { Bookmark } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { mockPosts } from "@/data/mockPosts";

const Bookmarks = () => {
  // Mock: pretend the user bookmarked these
  const bookmarked = mockPosts.filter((p) => ["3", "5"].includes(p.id));

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <PageHeader
          title="Bookmarks"
          subtitle="Posts you've saved for later."
        />
        {bookmarked.length === 0 ? (
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
