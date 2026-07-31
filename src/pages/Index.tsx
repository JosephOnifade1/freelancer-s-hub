import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { fetchPosts } from "@/lib/posts";
import { getUserProfile, getFollowingIds } from "@/lib/users";
import { PostCard } from "@/components/PostCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import {
  PenTool,
  HelpCircle,
  FileText,
  BarChart2,
} from "lucide-react";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"For You" | "Following">("For You");

  const { data: posts = [] } = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user ? getUserProfile(user.uid) : null),
    enabled: !!user,
  });

  const handleOpenComposer = (type: "post" | "question" | "resource" | "poll") => {
    navigate(`/submit?type=${type === "post" ? "discussion" : type}`);
  };

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
        {/* Main 2-Column Grid: Left Feed (8 cols), Right Sidebar (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Feed Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Top Tab Bar: For You / Following */}
            <div className="flex items-center gap-6 border-b border-border/60 pb-1">
              {(["For You", "Following"] as const).map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative pb-3 text-sm font-semibold transition-all whitespace-nowrap ${
                      isActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab}
                    {isActive && (
                      <motion.div
                        layoutId="activeHomeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Composer Bar */}
            <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3 shadow-sm">
              <div
                onClick={() => handleOpenComposer("post")}
                className="flex items-center gap-3 cursor-pointer"
              >
                <img
                  src={
                    user?.photoURL ||
                    profile?.avatarUrl ||
                    "https://api.dicebear.com/7.x/identicon/svg?seed=" + (user?.uid || "guest")
                  }
                  alt="User"
                  className="h-9 w-9 rounded-xl object-cover ring-1 ring-border/40 shrink-0"
                />
                <div className="flex-1 bg-muted/50 hover:bg-muted border border-border/40 rounded-xl px-4 py-2.5 text-xs text-muted-foreground transition-colors font-mono tracking-wide">
                  &gt; new_transmission...
                </div>
              </div>

              {/* Quick Action triggers */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-border/30">
                <button
                  onClick={() => handleOpenComposer("post")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <PenTool className="h-3.5 w-3.5 text-primary" />
                  <span>Post</span>
                </button>
                <button
                  onClick={() => handleOpenComposer("question")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Question</span>
                </button>
                <button
                  onClick={() => handleOpenComposer("resource")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-purple-500" />
                  <span>Resource</span>
                </button>
                <button
                  onClick={() => handleOpenComposer("poll")}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <BarChart2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Poll</span>
                </button>
              </div>
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
              {activeTab === "Following" && displayedPosts.length === 0 && (
                <div className="rounded-2xl border border-border/40 bg-card p-10 text-center space-y-2">
                  <p className="font-heading font-bold text-foreground uppercase tracking-wide">Nothing here yet</p>
                  <p className="text-sm text-muted-foreground">
                    Follow people to see their posts here, or check back once they post.
                  </p>
                </div>
              )}
              {displayedPosts.length === 0 && activeTab === "For You" && (
                <div className="rounded-2xl border border-border/40 bg-card p-10 text-center space-y-2">
                  <p className="font-heading font-bold text-foreground uppercase tracking-wide">No posts yet</p>
                  <p className="text-sm text-muted-foreground">
                    Be the first to post something.
                  </p>
                </div>
              )}
              {displayedPosts.map((post, i) => (
                <PostCard key={post.id} post={post} index={i} />
              ))}
            </div>
          </div>

          {/* Right Sidebar Column (4 cols) */}
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
