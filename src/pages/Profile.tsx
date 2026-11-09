import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { VoteControls } from "@/components/VoteControls";
import { MapPin, Calendar, Camera, Loader2, Edit2, ArrowLeft, Check, Link as LinkIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard, PostData } from "@/components/PostCard";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, toggleFollow, updateUserAvatar, isVeteran } from "@/lib/users";
import { uploadImage } from "@/lib/uploads";
import { fetchPosts } from "@/lib/posts";
import { QueryErrorState } from "@/components/QueryErrorState";
import { fetchAllCommunities, getUserCommunities } from "@/lib/communities";
import { fetchUserBadges } from "@/lib/badges";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Tab = "Threads" | "Resources" | "B-Spaces" | "Bookmarks";

export default function Profile() {
  const { uid, username, handle } = useParams();
  const { user: currentUser } = useAuth();
  const pageLocation = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawParam = uid || username || handle;
  const targetIdentifier = (rawParam === "me" ? currentUser?.uid : rawParam) || currentUser?.uid;

  const { data: profile, isLoading, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', targetIdentifier],
    queryFn: () => targetIdentifier ? getUserProfile(targetIdentifier) : null,
    enabled: !!targetIdentifier,
  });

  const profileUid = profile?.uid || targetIdentifier;
  const isOwnProfile = !!currentUser?.uid && (profileUid === currentUser.uid || profile?.uid === currentUser.uid);

  const [activeTab, setActiveTab] = useState<Tab>("Threads");
  useEffect(() => setActiveTab("Threads"), [targetIdentifier]);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  const { data: allPosts = [], isLoading: loadingPosts, isError: postsError, refetch: refetchPosts } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const { data: allCommunities = [], isError: communitiesError, refetch: refetchCommunities } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const { data: joinedCommunities = [], isError: joinedError, refetch: refetchJoined } = useQuery({
    queryKey: ["userCommunities", profile?.uid],
    queryFn: () => (profile?.uid ? getUserCommunities(profile.uid) : []),
    enabled: !!profile?.uid,
  });

  const { data: earnedBadges = [], isError: badgesError, refetch: refetchBadges } = useQuery({
    queryKey: ["user-badges", profile?.uid],
    queryFn: () => (profile?.uid ? fetchUserBadges(profile.uid) : []),
    enabled: !!profile?.uid,
  });

  // Filter posts created by this user
  const userPosts = profile ? allPosts.filter((p) =>
    !p.isDeleted && p.author?.uid === profile.uid
  ) : [];

  const resourcePosts = userPosts.filter(p => p.type === 'resource');
  const savedPostsList = isOwnProfile && profile ? allPosts.filter(p => profile.savedPosts?.[p.id]) : [];

  // Check if currentUser follows this user
  const { data: followData, isError: followingError, refetch: refetchFollow } = useQuery({
    queryKey: ['isFollowing', currentUser?.uid, profileUid],
    queryFn: async () => {
      if (!currentUser?.uid || !profileUid) return null;
      const { data, error } = await supabase
        .from("follows")
        .select("followingId")
        .eq("followerId", currentUser.uid)
        .eq("followingId", profileUid)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!currentUser?.uid && !!profileUid && currentUser?.uid !== profileUid,
  });
  const isFollowing = !!followData;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !profileUid) throw new Error("Not logged in");
      return toggleFollow(currentUser.uid, profileUid);
    },
    onSuccess: (nowFollowing) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
      queryClient.invalidateQueries({ queryKey: ['isFollowing', currentUser?.uid, profileUid] });
      toast.success(nowFollowing ? `Followed @${profile?.username}` : `Unfollowed @${profile?.username}`);
    },
    onError: () => toast.error("Failed to follow user")
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileUid) return;
    try {
      // Upload to Storage (avatars bucket) and store the URL — avatars used
      // to be saved as base64 blobs in the profiles table.
      const url = await uploadImage(file, "avatars");
      await updateUserAvatar(profileUid, url);
      queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
      toast.success("Avatar updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update avatar.");
    }
  };

  const handleSaveBio = async () => {
    if (!profileUid) return;
    setIsSavingBio(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bio: bioInput })
        .eq("uid", profileUid);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
      setIsEditingBio(false);
      toast.success("Bio updated");
    } catch (e) {
      toast.error("Failed to update bio");
    } finally {
      setIsSavingBio(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (profileError) return <AppLayout><div className="mx-auto max-w-xl px-4 py-16"><QueryErrorState title="Couldn't load this profile" onRetry={() => refetchProfile()} /></div></AppLayout>;

  if (!profile) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Profile not found.</h2>
          <Link to="/" className="text-brand hover:underline font-medium text-sm">Return to feed</Link>
        </div>
      </AppLayout>
    );
  }

  // Format stats
  const postsCount = userPosts.length;
  const followersCount = profile.followers ? (profile.followers > 999 ? `${(profile.followers / 1000).toFixed(1)}K` : profile.followers) : 0;
  const followingCount = profile.following || 0;
  const resourcesCount = resourcePosts.length;
  const spacesCount = joinedCommunities.length;

  const skills = Array.isArray(profile.skills) ? profile.skills.map((x) => String(x)).filter(Boolean) : [];
  const bio = profile.bio && profile.bio.trim() && profile.bio.trim() !== "New to Borynx!" ? profile.bio : "";
  const location = profile.location && profile.location.trim() && profile.location.trim() !== "Earth" ? profile.location : "";
  const website = profile.website?.trim() || "";
  const joinedSpaces = allCommunities.filter((c) => joinedCommunities.includes(c.slug));

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4">

        {/* Top Header bar with back button & Profile title */}
        <div className="flex items-center gap-3 mb-4 text-foreground">
          <Link to="/" className="p-1.5 rounded-full hover:bg-secondary transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-heading text-xl font-bold">Profile</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Main Content Column (Left - 8 cols) */}
          <div className="lg:col-span-8 space-y-6">

            {/* Header Banner & Profile Card */}
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-md">

              <div className="h-28 sm:h-36 w-full bg-muted" />

              {/* Avatar & Action Buttons Bar */}
              <div className="px-6 relative pb-6">
                <div className="flex items-end justify-between -mt-16 sm:-mt-20 mb-4">

                  {/* Large Avatar */}
                  <div className="relative group">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-card bg-muted overflow-hidden shadow-xl relative">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center font-heading text-3xl font-bold text-foreground bg-muted">
                          {profile.initial || profile.displayName?.charAt(0) || "M"}
                        </div>
                      )}

                      {isOwnProfile && (
                        <button type="button" aria-label="Change profile photo" title="Change profile photo"
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => fileInputRef.current?.click()}>
                          <Camera className="h-6 w-6 text-white" />
                        </button>
                      )}
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2.5 pt-4">
                    {isOwnProfile ? (
                      <Link
                        to="/settings"
                        className="px-4 py-2 rounded-md font-medium text-sm border border-border text-foreground hover:bg-muted transition-colors"
                      >
                        Edit profile
                      </Link>
                    ) : !currentUser ? (
                      <Link to="/login" state={{ from: pageLocation }} className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Sign in to follow</Link>
                    ) : followingError ? (
                      <button type="button" onClick={() => refetchFollow()} className="text-xs text-destructive hover:underline">Follow status unavailable. Retry</button>
                    ) : (
                      <button onClick={() => followMutation.mutate()} disabled={followMutation.isPending}
                        className={`min-h-10 rounded-md px-4 py-2 text-sm font-medium transition-colors ${isFollowing ? 'border border-border text-foreground hover:bg-muted' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                        {followMutation.isPending ? "Updating..." : isFollowing ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                </div>

                {/* User Name and handle */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                      {profile.displayName || profile.username || "User"}
                    </h2>
                    <VerifiedBadge isVerified={profile.isVerifiedPro ?? false} size={18} />
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums ">
                    @{profile.username || "unknown"}
                  </p>
                </div>

                {/* Bio text */}
                {isEditingBio ? (
                  <div className="my-3 space-y-2">
                    <Textarea
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      className="bg-background border-border/60 text-sm resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsEditingBio(false)}
                        className="px-3 py-1 rounded text-xs border border-border text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveBio}
                        disabled={isSavingBio}
                        className="px-3 py-1 rounded text-xs bg-primary text-primary-foreground font-medium"
                      >
                        {isSavingBio ? "Saving..." : "Save Bio"}
                      </button>
                    </div>
                  </div>
                ) : (bio || isOwnProfile) ? (
                  <p className="mb-4 text-sm leading-relaxed text-foreground/90">
                    {bio || (isOwnProfile ? <span className="text-muted-foreground">Add a short bio so people know what you do.</span> : null)}
                    {isOwnProfile && <button type="button" onClick={() => { setBioInput(bio); setIsEditingBio(true); }} className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Edit2 className="h-3 w-3" /> Edit bio</button>}
                  </p>
                ) : null}

                {/* Meta details row (only what the user actually filled in) */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground mb-4">
                  {location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{location}</span>
                    </div>
                  )}
                  {website && (
                    <div className="flex items-center gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" />
                      <a
                        href={website.startsWith('http') ? website : `https://${website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground transition-colors"
                      >
                        {website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {profile.joined && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Joined {profile.joined}</span>
                    </div>
                  )}
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2.5 py-1 rounded-md border border-border bg-background text-muted-foreground text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats Summary Bar (5 Stats Columns) */}
                <div className="grid grid-cols-5 gap-2 py-4 px-2 sm:px-6 rounded-xl border border-border/40 bg-secondary/30 text-center">
                  <div>
                    <div className="font-heading text-lg sm:text-xl font-bold text-foreground">{postsCount}</div>
                    <div className="text-[11px] text-muted-foreground">Posts</div>
                  </div>
                  <div>
                    <div className="font-heading text-lg sm:text-xl font-bold text-foreground">{followersCount}</div>
                    <div className="text-[11px] text-muted-foreground">Followers</div>
                  </div>
                  <div>
                    <div className="font-heading text-lg sm:text-xl font-bold text-foreground">{followingCount}</div>
                    <div className="text-[11px] text-muted-foreground">Following</div>
                  </div>
                  <div>
                    <div className="font-heading text-lg sm:text-xl font-bold text-foreground">{resourcesCount}</div>
                    <div className="text-[11px] text-muted-foreground">Resources</div>
                  </div>
                  <div>
                    <div className="font-heading text-lg sm:text-xl font-bold text-foreground">{spacesCount}</div>
                    <div className="text-[11px] text-muted-foreground">B-Spaces</div>
                  </div>
                </div>

              </div>

            </div>

            {/* Tabs Row */}
            <div className="flex items-center gap-6 overflow-x-auto border-b border-border/50 px-2 text-sm font-medium sm:gap-8">
              {(["Threads", "Resources", "B-Spaces", ...(isOwnProfile ? ["Bookmarks"] : [])] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 font-semibold transition-all relative ${
                    activeTab === tab
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Main Content Area based on Tab */}
            <div className="space-y-4">
              {activeTab === "Threads" && (
                postsError ? (
                  <QueryErrorState title="Couldn't load posts" onRetry={() => refetchPosts()} />
                ) : loadingPosts ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading posts…</p> : userPosts.length === 0 ? (
                  <div className="rounded-2xl border border-border/40 bg-card p-10 text-center space-y-2">
                    <p className="font-heading font-bold text-foreground ">No posts yet</p>
                    <p className="text-sm text-muted-foreground">
                      Posts this user publishes will show up here.
                    </p>
                  </div>
                ) : (
                  userPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {activeTab === "Resources" && (
                postsError ? (
                  <QueryErrorState title="Couldn't load resources" onRetry={() => refetchPosts()} />
                ) : loadingPosts ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading resources…</p> : resourcePosts.length === 0 ? (
                  <div className="rounded-xl border border-border/40 bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
                    No resources shared yet.
                  </div>
                ) : (
                  resourcePosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {activeTab === "B-Spaces" && (
                communitiesError || joinedError ? <QueryErrorState title="Couldn't load spaces" onRetry={() => { refetchCommunities(); refetchJoined(); }} /> : joinedSpaces.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    {isOwnProfile ? "You haven't joined any spaces yet." : "Not a member of any spaces yet."}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <h3 className="font-heading text-sm font-bold text-foreground">
                      Member of {joinedSpaces.length} {joinedSpaces.length === 1 ? "B-Space" : "B-Spaces"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {joinedSpaces.map((sp) => (
                        <Link
                          key={sp.slug}
                          to={`/b/${sp.slug}`}
                          className="p-3 rounded-lg border border-border bg-background flex items-center gap-3 transition-colors hover:border-foreground/30"
                        >
                          <div className="h-10 w-10 rounded-lg bg-muted text-foreground font-bold flex items-center justify-center text-sm">
                            {sp.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">{sp.name}</div>
                            <div className="text-xs text-muted-foreground">{sp.memberCount.toLocaleString()} {sp.memberCount === 1 ? "member" : "members"}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              )}

              {isOwnProfile && activeTab === "Bookmarks" && (
                postsError ? (
                  <QueryErrorState title="Couldn't load bookmarked posts" onRetry={() => refetchPosts()} />
                ) : loadingPosts ? <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading bookmarks…</p> : savedPostsList.length === 0 ? (
                  <div className="rounded-xl border border-border/40 bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
                    No bookmarks saved yet.
                  </div>
                ) : (
                  savedPostsList.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}
            </div>

          </div>

          {/* Right Sidebar Column (4 Cards) */}
          <div className="lg:col-span-4 space-y-5">

            {/* About: only fields that exist on the profile */}
            {(profile.status || location || website || profile.joined) && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="font-heading text-sm font-bold text-foreground">About</h3>
                <dl className="space-y-2.5 text-sm">
                  {profile.status && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Work</dt>
                      <dd className="font-medium text-foreground">{profile.status}</dd>
                    </div>
                  )}
                  {location && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Location</dt>
                      <dd className="font-medium text-foreground">{location}</dd>
                    </div>
                  )}
                  {profile.joined && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Joined</dt>
                      <dd className="font-medium text-foreground">{profile.joined}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Spaces */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold text-foreground">Spaces</h3>
              {joinedSpaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">No spaces joined yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {joinedSpaces.slice(0, 5).map((sp) => (
                    <li key={sp.slug}>
                      <Link to={`/b/${sp.slug}`} className="flex items-center justify-between text-sm hover:opacity-80">
                        <span className="font-medium text-foreground">{sp.name}</span>
                        <span className="tabular-nums text-xs text-muted-foreground">b/{sp.slug}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/communities" className="inline-block text-xs text-muted-foreground hover:text-foreground">
                Browse all spaces
              </Link>
            </div>

            {/* Badges */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-heading text-sm font-bold text-foreground">Badges</h3>
              </div>
              {badgesError ? (
                <p className="text-xs text-destructive">Couldn't load badges.</p>
              ) : earnedBadges.length === 0 ? (
                <p className="text-xs text-muted-foreground">No badges earned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {earnedBadges.map((eb) => (
                    <span
                      key={eb.badgeId}
                      title={eb.badgeId}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground truncate"
                    >
                      {eb.badgeId.charAt(0).toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    </AppLayout>
  );
}
