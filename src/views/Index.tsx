import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link, useSearchParams } from "react-router-dom";
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
  const router = useRouter();
  const [searchParams, setSearchParams] = useSearchParams();

  const goCreate = () => router.push("/submit");
  const activeTab = searchParams.get("feed") === "following" ? "Following" : "For You";
  const setActiveTab = (tab: (typeof TABS)[number]) =>
    setSearchParams(tab === "Following" ? { feed: "following" } : {}, { replace: true });
  const [bannerDismissed, setBannerDismissed] = useState(
    () => sessionStorage.getItem("borynx_profile_banner_dismissed") === "1"
  );
  const [focusedIndex, setFocusedIndex] = useState(-1);

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

  // Feed keyboard navigation: J = next post, K = prev post, Enter = open post, Esc = clear focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, displayedPosts.length - 1);
          const el = document.getElementById(`feed-post-${next}`);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return next;
        });
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          const el = document.getElementById(`feed-post-${next}`);
          el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          return next;
        });
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        const post = displayedPosts[focusedIndex];
        if (post) {
          router.push(post.communitySlug ? `/b/${post.communitySlug}/p/${post.id}` : `/p/${post.id}`);
        }
      } else if (e.key === "Escape") {
        setFocusedIndex(-1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayedPosts, focusedIndex, router]);

  return (
    <AppLayout>
      <div className="px-2 py-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-9">
            {profileIncomplete && !bannerDismissed && (
              <div className="panel flex flex-wrap items-center gap-3 rounded-xl border border-ember/30 bg-ember-soft p-4">
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-2">
                  <span className="font-semibold text-ink">Your profile is incomplete.</span>{" "}
                  Add your skills and a short bio so clients can find and trust you.
                </p>
                <Link
                  to="/onboarding"
                  className="btn btn-primary btn-sm"
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
                  className="text-xs text-ink-4 hover:text-ink transition-colors"
                >
                  Dismiss
                </button>
              </div>
            )}
            <div className="flex items-center gap-6 hairline-b pb-1">
              {TABS.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      isActive ? "text-ember" : "text-ink-4 hover:text-ink"
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div layoutId="activeHomeTab" className="absolute inset-x-0 bottom-0 h-0.5 w-full bg-ember" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-ink-4">
              <p>{activeTab === "For You" ? "Ranked by votes, replies and recency." : "Recent posts from people you follow."} <Link to="/new" className="text-ember hover:underline ml-1">Newest</Link></p>
              <span className="eyebrow text-[9.5px] hidden sm:inline text-ink-4">
                <kbd className="px-1 py-0.5 rounded bg-sunken border border-line text-[9px]">J</kbd>/<kbd className="px-1 py-0.5 rounded bg-sunken border border-line text-[9px]">K</kbd> navigate
              </span>
            </div>

            <ComposerBar />

            <div className="space-y-2.5">
              {postsError || followingError ? (
                <QueryErrorState
                  title="Couldn't load the feed"
                  onRetry={() => { refetchPosts(); refetchFollowing(); }}
                />
              ) : isLoading || followingLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-ink-4" /></div>
              ) : displayedPosts.length === 0 ? (
                <div className="panel rounded-xl p-10 text-center border-dashed">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <PenTool className="h-5 w-5 text-ink-4" />
                    <span className="eyebrow text-ink-4">Be the first to post</span>
                  </div>
                  <p className="font-heading text-base font-bold text-ink mb-1">
                    {activeTab === "Following" ? "No posts from people you follow" : "No posts yet"}
                  </p>
                  <p className="text-xs text-ink-3 mb-6 max-w-xs mx-auto">
                    {activeTab === "Following"
                      ? "Follow freelancers from their profile and their posts will show up here."
                      : "Share a question, resource, or discussion to start the conversation."}
                  </p>
                  <button
                    onClick={() => goCreate()}
                    className="btn btn-primary"
                  >
                    <PenTool className="h-4 w-4 mr-1.5" /> Create post
                  </button>
                </div>
              ) : displayedPosts.map((post, i) => (
                <div key={post.id} id={`feed-post-${i}`}>
                  <PostCard post={post} index={i} isFocused={i === focusedIndex} />
                </div>
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
