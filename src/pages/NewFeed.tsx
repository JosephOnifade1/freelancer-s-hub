import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { PageHeader } from "@/components/PageHeader";
import { mockPosts } from "@/data/mockPosts";

const parseHours = (t: string) => {
  const num = parseInt(t);
  if (t.includes("d")) return num * 24;
  return num;
};

const NewFeed = () => {
  const sorted = [...mockPosts].sort(
    (a, b) => parseHours(a.timeAgo) - parseHours(b.timeAgo)
  );

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
              {sorted.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
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

export default NewFeed;
