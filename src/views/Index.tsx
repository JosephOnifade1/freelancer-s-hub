import { useState, useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, PenTool } from "lucide-react";
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const goCreate = () => navigate("/submit");
  const activeTab = searchParams.get("feed") === "following" ? "Following" : "For You";
  const setActiveTab = (tab: (typeof TABS)[number]) =>
    setSearchParams(tab === "Following" ? { feed: "following" } : {}, { replace: true });
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
    enabled: !!user?.uid,
  });

  const displayedPosts = useMemo(() => {
    if (activeTab === "Following") {
      return posts.filter((p) => p.author?.uid && followingIds.includes(p.author.uid));
    }
    // Engagement with a recency decay, plus a modest boost for followed
    // authors. Unlike the former chronological list this is a real ranking.
    const now = Date.now();
    const score = (post: (typeof posts)[number]) => {
      const ageDays = Math.max(0, (now - (post.createdAt || now)) / 86_400_000);
      const followed = post.author?.uid && followingIds.includes(post.author.uid) ? 5 : 0;
      return (1 + Math.max(0, post.score || 0) + (post.commentCount || 0) * 0.5 + followed) / (1 + ageDays / 7);
    };
    return [...posts].sort((a, b) => score(b) - score(a) || (b.createdAt || 0) - (a.createdAt || 0));
  }, [posts, activeTab, followingIds]);

  return (
    <AppLayout>
      <div className="px-2 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-9">
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
            <div className="flex items-center gap-6 border-b border-border pb-2">
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-2 text-sm font-semibold transition-colors ${
                      isActive ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div layoutId="activeHomeTab" className="absolute inset-x-0 bottom-0 h-1 w-full bg-brand rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">{activeTab === "For You" ? "Active posts ranked by votes, replies and recency, with people you follow boosted." : "Recent posts from people you follow."} <Link to="/new" className="font-semibold text-brand hover:underline">See newest posts</Link></p>
            <ComposerBar />

            <div className="space-y-3">
              {postsError || followingError ? (
                <QueryErrorState
                  title="Couldn't load the feed"
                  onRetry={() => { refetchPosts(); refetchFollowing(); }}
                />
              ) : isLoading || followingLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : displayedPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <PenTool className="h-5 w-5 text-muted-foreground/40" />
                    <span className="font-body text-sm text-muted-foreground/40">Be the first to post</span>
                  </div>
                  <p className="font-display text-lg font-semibold text-foreground mb-1">
                    {activeTab === "Following" ? "No posts from people you follow" : "No posts yet"}
                  </p>
                  <p className="font-body text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                    {activeTab === "Following"
                      ? "Follow freelancers from their profile and their posts will show up here."
                      : "Share a question, resource, or poll to start the conversation."}
                  </p>
                  <button
                    onClick={() => goCreate()}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <PenTool className="h-4 w-4" /> Create post
                  </button>
                </div>
              ) : displayedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="sticky top-20">
              <FeedSidebar posts={posts} feedState={postsError ? "error" : isLoading ? "loading" : "ready"} currentUserUid={user?.uid} />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
