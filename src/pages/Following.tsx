import { Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { mockPosts } from "@/data/mockPosts";

// Mock: pretend the user follows two authors
const followedAuthors = ["designkara", "marcelo_dev"];

const Following = () => {
  const posts = mockPosts.filter((p) => followedAuthors.includes(p.author.name));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <PageHeader
              title="Following"
              subtitle="Posts from freelancers you follow."
            />
            {posts.length === 0 ? (
              <EmptyState
                icon={Users}
                title="You're not following anyone yet"
                description="Follow other freelancers to see their posts here. Start by exploring the Hot feed."
              />
            ) : (
              <div className="space-y-3">
                {posts.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} />
                ))}
              </div>
            )}
          </div>
          <div className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-20">
              <FeedSidebar />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Following;
