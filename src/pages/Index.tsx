import { useState, useMemo } from "react";
import { Flame, Clock, Users } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { getUserProfile } from "@/lib/users";
import { useAuth } from "@/hooks/useAuth";

type SortTab = "hot" | "new" | "following";

const tabs: { id: SortTab; label: string; icon: React.ElementType }[] = [
  { id: "hot", label: "Hot", icon: Flame },
  { id: "new", label: "New", icon: Clock },
  { id: "following", label: "Following", icon: Users },
];

const Index = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<SortTab>("hot");
  
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user,
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const displayedPosts = useMemo(() => {
    let filtered = [...posts];

    if (activeTab === "following") {
      const followingList = profile?.followingList || {};
      filtered = filtered.filter((post) => post.author.uid && followingList[post.author.uid]);
    }

    if (activeTab === "hot") {
      filtered.sort((a, b) => {
        const scoreA = (a.score || 0) * 2 + (a.commentCount || 0);
        const scoreB = (b.score || 0) * 2 + (b.commentCount || 0);
        return scoreB - scoreA;
      });
    } else {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    return filtered;
  }, [posts, activeTab, profile]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex gap-6">
          {/* Main Feed */}
          <div className="flex-1 min-w-0">
            {/* Sort Tabs */}
            <div className="mb-5 flex items-center gap-1 rounded-xl border border-border bg-card p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 font-body text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
                  Loading posts...
                </div>
              ) : displayedPosts.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
                  {activeTab === "following" 
                    ? "You aren't following anyone with posts yet." 
                    : "No posts yet. Be the first to share!"}
                </div>
              ) : (
                displayedPosts.map((post, i) => (
                  <PostCard key={post.id} post={post} index={i} />
                ))
              )}
            </div>
          </div>

          {/* Right Sidebar */}
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

export default Index;
