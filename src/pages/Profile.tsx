import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Link as LinkIcon, MapPin, Calendar, Zap, ArrowUp, UserPlus, UserMinus, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, toggleFollow } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor } from "@/lib/comments";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";

const tabs = ["Posts", "Comments"] as const;
type Tab = (typeof tabs)[number];


const Profile = () => {
  const { uid } = useParams();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  
  // If no uid is provided in the URL, default to the currently logged in user
  const profileUid = uid || currentUser?.uid;
  const isOwnProfile = profileUid === currentUser?.uid;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', profileUid],
    queryFn: () => profileUid ? getUserProfile(profileUid) : null,
    enabled: !!profileUid,
  });

  const { data: allPosts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const { data: userComments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['userComments', profile?.username],
    queryFn: () => profile?.username ? fetchCommentsByAuthor(profile.username) : [],
    enabled: !!profile?.username
  });

  const [active, setActive] = useState<Tab>("Posts");
  
  // Filter all posts by this author's username
  const userPosts = profile ? allPosts.filter((p) => p.author?.name === profile.username) : [];

  const tabCounts: Record<Tab, string> = {
    Posts: String(userPosts.length),
    Comments: String(userComments.length)
  };

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !profileUid) throw new Error("Not logged in");
      return toggleFollow(currentUser.uid, profileUid);
    },
    onSuccess: (isFollowing) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
      toast.success(isFollowing ? `Followed ${profile?.username}` : `Unfollowed ${profile?.username}`);
    },
    onError: () => {
      toast.error("Failed to follow user");
    }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Profile not found.</h2>
          <Link to="/" className="text-primary hover:underline">Return to feed</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-2xl font-bold text-primary">
              {profile.initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  {profile.username}
                </h1>
                <span className="rounded-full bg-badge-resource/15 px-2 py-0.5 font-body text-[10px] font-semibold text-badge-resource">
                  {profile.status}
                </span>
              </div>
              <p className="font-body text-sm text-muted-foreground mb-3">
                {profile.bio || "This user hasn't added a bio yet."}
              </p>
              <div className="flex flex-wrap gap-3 font-body text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {profile.location}
                </span>
                {profile.website && (
                  <a href="#" className="flex items-center gap-1 hover:text-primary transition-colors">
                    <LinkIcon className="h-3.5 w-3.5" /> {profile.website}
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Joined {profile.joined}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(profile.skills || []).map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Action Button */}
            {isOwnProfile ? (
              <button className="rounded-lg border border-border px-4 py-2 font-body text-sm font-semibold hover:bg-secondary transition-colors">
                Edit Profile
              </button>
            ) : (
              <button 
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {followMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                Follow
              </button>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 pt-5 border-t border-border/50">
            <div>
              <p className="font-heading text-xl font-bold text-foreground flex items-center gap-1">
                <Zap className="h-4 w-4 text-primary" /> {(profile.reputation || 0).toLocaleString()}
              </p>
              <p className="font-body text-[11px] text-muted-foreground">Reputation</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold text-foreground">{profile.followers || 0}</p>
              <p className="font-body text-[11px] text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold text-foreground">{profile.following || 0}</p>
              <p className="font-body text-[11px] text-muted-foreground">Following</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`flex-1 rounded-lg px-4 py-2 font-body text-sm font-medium transition-all ${
                active === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t} <span className="opacity-70">({tabCounts[t]})</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {active === "Posts" && (
          <div className="space-y-3">
            {userPosts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center font-body text-sm text-muted-foreground shadow-sm">
                No posts yet.
              </div>
            ) : (
              userPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
            )}
          </div>
        )}

        {active === "Comments" && (
          <div className="space-y-3">
            {loadingComments ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : userComments.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center font-body text-sm text-muted-foreground shadow-sm">
                No comments yet.
              </div>
            ) : (
              userComments.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-border bg-card p-4 hover:border-primary/40 transition-colors shadow-sm"
                >
                  <Link
                    to={`/post/${c.postId}`}
                    className="font-heading text-sm font-semibold text-foreground hover:text-primary line-clamp-1 transition-colors"
                  >
                    View Post →
                  </Link>
                  <p className="mt-2 font-body text-sm text-foreground/90 leading-relaxed">
                    {c.body}
                  </p>
                  <div className="mt-3 flex items-center gap-4 font-body text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <ArrowUp className="h-3.5 w-3.5" /> {c.score || 0}
                    </span>
                    <span>{formatTimeAgo(c.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Profile;
