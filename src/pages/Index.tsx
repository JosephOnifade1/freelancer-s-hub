import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/auth-context";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { QueryErrorState } from "@/components/QueryErrorState";
import { getFollowingIds, getUserProfile } from "@/lib/users";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import { ComposerBar } from "@/components/ComposerBar";

const TABS = ["For You", "Following"] as const;

const Index = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("For You");
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem("borynx_profile_banner_dismissed") === "1"
  );

  const { data: myProfile } = useQuery({
    queryKey: ["myProfile", user?.uid],
    queryFn: () => (user?.uid ? getUserProfile(user.uid) : null),
    enabled: !!user?.uid,
  });

  // Onboarding prompt: shown until the profile has a real bio and skills.
  const profileIncomplete =
    !!myProfile &&
    ((myProfile.skills || []).length === 0 ||
      ["", "New to Borynx!", "New freelancer on Borynx!"].includes((myProfile.bio || "").trim()));

  const { data: posts = [], isLoading, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  const { data: followingIds = [], isLoading: followingLoading, isError: followingError, refetch: refetchFollowing } = useQuery({
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
            {profileIncomplete && !bannerDismissed && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Your profile is incomplete.</span>{" "}
                  Add your skills and a short bio so clients can find and trust you.
                </p>
                <Link
                  to="/onboarding"
                  className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Complete profile
                </Link>
                <button
                  type="button"
                  aria-label="Dismiss"
                  onClick={() => {
                    sessionStorage.setItem("borynx_profile_banner_dismissed", "1");
                    setBannerDismissed(true);
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Dismiss
                </button>
              </div>
            )}
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
                      <motion.div layoutId="activeHomeTab" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />
                    )}
                  </button>
                );
              })}
            </div>

            <ComposerBar />

            <div className="space-y-3">
              {postsError || (activeTab === "Following" && followingError) ? (
                <QueryErrorState
                  title="Couldn't load the feed"
                  onRetry={() => { refetchPosts(); if (activeTab === "Following") refetchFollowing(); }}
                />
              ) : isLoading || (activeTab === "Following" && followingLoading) ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : displayedPosts.length === 0 ? (
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
              ) : displayedPosts.map((post, i) => (
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
