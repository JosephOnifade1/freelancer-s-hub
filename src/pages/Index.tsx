import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { getFollowingIds } from "@/lib/users";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { ComposerBar } from "@/components/ComposerBar";

const TABS = ["For You", "Following"] as const;

const Index = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("For You");

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  const { data: followingIds = [] } = useQuery({
    queryKey: ["followingIds", user?.uid],
    queryFn: () => (user?.uid ? getFollowingIds(user.uid) : []),
    enabled: !!user?.uid && activeTab === "Following",
  });

  const displayedPosts = useMemo(() => {
    if (activeTab === "Following") {
      return posts.filter((p) => p.author?.uid && followingIds.includes(p.author.uid));
    }
    return posts;
  }, [posts, activeTab, followingIds]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1380px] px-4 py-6 md:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            <div className="flex items-center gap-6 border-b border-border">
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-colors ${
                      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div layoutId="activeHomeTab" className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>

            <ComposerBar />

            <div className="space-y-3">
              {!isLoading && displayedPosts.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
                  <p className="font-heading text-base font-bold text-foreground">
                    {activeTab === "Following" ? "No posts from people you follow" : "No posts yet"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeTab === "Following"
                      ? "Follow freelancers from their profile and their posts will show up here."
                      : "Be the first to post a question, resource or poll."}
                  </p>
                </div>
              )}
              {displayedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-20">
              <FeedSidebar posts={posts} currentUserUid={user?.uid} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
