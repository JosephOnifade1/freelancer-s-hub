import { fetchFollowing } from "@/lib/social-client";
import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/AppLink";
import { loginPath } from "@/lib/return-path";
import { VoteControls } from "@/components/VoteControls";
import { MapPin, Calendar, Camera, Loader2, Edit2, ArrowLeft, Check, Link as LinkIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard, PostData } from "@/components/PostCard";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, toggleFollow, updateUserAvatar, isVeteran } from "@/lib/users";
import { saveOwnProfile, isProfileError } from "@/lib/profile-client";
import { uploadImage } from "@/lib/uploads";
import { fetchPosts } from "@/lib/posts";
import { QueryErrorState } from "@/components/QueryErrorState";
import { fetchAllCommunities, getUserCommunities } from "@/lib/communities";
import { fetchUserBadges } from "@/lib/badges";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Award, Clock } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Tab = "Threads" | "Resources" | "B-Spaces" | "Bookmarks";

export default function Profile() {
  const { uid, username, handle } = useParams();
  const { user: currentUser } = useAuth();
  const pathname = usePathname();
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
      return (await fetchFollowing(currentUser.uid)).find(p => p.uid === profileUid) ?? null;
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
      queryClient.invalidateQueries({ queryKey: ['profile', currentUser?.uid] });
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
      // Phase 2C: the bio lives in Neon. The server refuses to write anything but the
      // caller's own row, so editing is still gated by `isOwnProfile` *and* by identity.
      const result = await saveOwnProfile({ bio: bioInput });
      if (isProfileError(result)) throw new Error("Could not save your bio.");
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

  const profileHue = ((profile.username || "user").charCodeAt(0) * 47) % 360;

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-3 sm:px-6 py-4">

        {/* Top Header bar with back button */}
        <div className="flex items-center gap-3 mb-4 text-ink">
          <Link to="/" className="p-1.5 rounded-md hover:bg-sunken text-ink-3 hover:text-ink transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="eyebrow text-xs tracking-wider uppercase text-ink-3">Freelancer Profile</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Main Content Column (Left - 8 cols) */}
          <div className="lg:col-span-8 space-y-5">

            {/* Header Banner & Profile Card (Agent 2 Ledger style) */}
            <div className="panel rounded-xl overflow-hidden shadow-sm">

              <div
                className="h-28 sm:h-32 w-full hairline-b"
                style={{
                  background: `linear-gradient(135deg, hsl(${profileHue}deg 40% 16%), hsl(${(profileHue + 40) % 360}deg 50% 10%))`
                }}
              />

              {/* Avatar & Action Buttons Bar */}
              <div className="px-5 relative pb-5">
                <div className="flex items-end justify-between -mt-12 sm:-mt-14 mb-3.5">

                  {/* Large Avatar */}
                  <div className="relative group">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl border-2 border-surface bg-surface-raised overflow-hidden shadow-xl relative">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div
                          className="h-full w-full flex items-center justify-center font-heading text-2xl sm:text-3xl font-bold text-white"
                          style={{ background: `hsl(${profileHue}deg 50% 32%)` }}
                        >
                          {profile.initial || profile.displayName?.charAt(0) || "M"}
                        </div>
                      )}

                      {isOwnProfile && (
                        <button type="button" aria-label="Change profile photo" title="Change profile photo"
                          className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                          onClick={() => fileInputRef.current?.click()}>
                          <Camera className="h-5 w-5 text-white" />
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
                  <div className="flex items-center gap-2 pt-2">
                    {isOwnProfile ? (
                      <Link
                        to="/settings"
                        className="btn btn-ghost btn-sm"
                      >
                        Edit profile
                      </Link>
                    ) : !currentUser ? (
                      <AppLink href={loginPath(pathname)} className="btn btn-primary btn-sm">Sign in to follow</AppLink>
                    ) : followingError ? (
                      <button type="button" onClick={() => refetchFollow()} className="text-xs text-danger hover:underline">Follow status unavailable. Retry</button>
                    ) : (
                      <button onClick={() => followMutation.mutate()} disabled={followMutation.isPending}
                        className={isFollowing ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"}>
                        {followMutation.isPending ? "Updating..." : isFollowing ? "Following" : "Follow"}
                      </button>
                    )}
                  </div>
                </div>

                {/* User Name and handle */}
                <div className="space-y-0.5 mb-2.5">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-lg sm:text-xl font-bold text-ink">
                      {profile.displayName || profile.username || "User"}
                    </h2>
                    <VerifiedBadge isVerified={profile.isVerifiedPro ?? false} size={16} />
                  </div>
                  <p className="num text-xs text-ink-3">
                    f/{profile.username || "unknown"}
                  </p>
                </div>

                {/* Bio text */}
                {isEditingBio ? (
                  <div className="my-3 space-y-2">
                    <Textarea
                      value={bioInput}
                      onChange={(e) => setBioInput(e.target.value)}
                      className="bg-sunken border-line text-xs resize-none text-ink"
                      rows={3}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setIsEditingBio(false)}
                        className="btn btn-ghost btn-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveBio}
                        disabled={isSavingBio}
                        className="btn btn-primary btn-sm"
                      >
                        {isSavingBio ? "Saving..." : "Save Bio"}
                      </button>
                    </div>
                  </div>
                ) : (bio || isOwnProfile) ? (
                  <p className="mb-3 text-xs leading-relaxed text-ink-2">
                    {bio || (isOwnProfile ? <span className="text-ink-4">Add a short bio so people know what you do.</span> : null)}
                    {isOwnProfile && <button type="button" onClick={() => { setBioInput(bio); setIsEditingBio(true); }} className="ml-2 inline-flex items-center gap-1 text-xs text-ember hover:underline"><Edit2 className="h-3 w-3" /> Edit bio</button>}
                  </p>
                ) : null}

                {/* Meta details row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3 mb-3.5">
                  {location && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-ink-4" />
                      <span>{location}</span>
                    </div>
                  )}
                  {website && (
                    <div className="flex items-center gap-1">
                      <LinkIcon className="h-3 w-3 text-ink-4" />
                      <a
                        href={website.startsWith('http') ? website : `https://${website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ember hover:underline"
                      >
                        {website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {profile.joined && (
                    <div className="flex items-center gap-1 num">
                      <Calendar className="h-3 w-3 text-ink-4" />
                      <span>Joined {profile.joined}</span>
                    </div>
                  )}
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {skills.map((skill) => (
                      <span key={skill} className="tag text-[10px]">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Stats Summary Bar (5 Stats Columns — Monospace Ledger Grid) */}
                <div className="num grid grid-cols-5 gap-1 py-2 px-3 rounded-lg bg-sunken border border-line text-center">
                  <div>
                    <div className="text-sm sm:text-base font-bold text-ink">{postsCount}</div>
                    <div className="eyebrow text-[8.5px]">Posts</div>
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-ink">{followersCount}</div>
                    <div className="eyebrow text-[8.5px]">Followers</div>
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-ink">{followingCount}</div>
                    <div className="eyebrow text-[8.5px]">Following</div>
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-ink">{resourcesCount}</div>
                    <div className="eyebrow text-[8.5px]">Resources</div>
                  </div>
                  <div>
                    <div className="text-sm sm:text-base font-bold text-ink">{spacesCount}</div>
                    <div className="eyebrow text-[8.5px]">Spaces</div>
                  </div>
                </div>

              </div>

            </div>

            {/* Tabs Row */}
            <div className="flex items-center gap-6 hairline-b pb-1 px-1 text-xs">
              {(["Threads", "Resources", "B-Spaces", ...(isOwnProfile ? ["Bookmarks"] : [])] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 font-medium tracking-wide transition-all relative ${
                    activeTab === tab
                      ? "text-ember after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:w-full after:bg-ember"
                      : "text-ink-4 hover:text-ink"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Main Content Area based on Tab */}
            <div className="space-y-3">
              {activeTab === "Threads" && (
                postsError ? (
                  <QueryErrorState title="Couldn't load posts" onRetry={() => refetchPosts()} />
                ) : loadingPosts ? <p role="status" className="py-8 text-center text-xs text-ink-3">Loading posts…</p> : userPosts.length === 0 ? (
                  <div className="panel rounded-xl p-8 text-center border-dashed space-y-1">
                    <p className="font-heading text-sm font-bold text-ink">No posts yet</p>
                    <p className="text-xs text-ink-3">
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
                ) : loadingPosts ? <p role="status" className="py-8 text-center text-xs text-ink-3">Loading resources…</p> : resourcePosts.length === 0 ? (
                  <div className="panel rounded-xl p-8 text-center text-xs text-ink-3 border-dashed">
                    No resources shared yet.
                  </div>
                ) : (
                  resourcePosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {activeTab === "B-Spaces" && (
                communitiesError || joinedError ? <QueryErrorState title="Couldn't load spaces" onRetry={() => { refetchCommunities(); refetchJoined(); }} /> : joinedSpaces.length === 0 ? (
                  <div className="panel rounded-xl p-8 text-center text-xs text-ink-3 border-dashed">
                    {isOwnProfile ? "You haven't joined any spaces yet." : "Not a member of any spaces yet."}
                  </div>
                ) : (
                  <div className="panel rounded-xl p-4 space-y-2.5">
                    <h3 className="eyebrow text-xs tracking-wider uppercase text-ink-3">
                      Member of {joinedSpaces.length} {joinedSpaces.length === 1 ? "Space" : "Spaces"}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {joinedSpaces.map((sp) => (
                        <Link
                          key={sp.slug}
                          to={`/b/${sp.slug}`}
                          className="p-2.5 rounded-lg border border-line bg-sunken flex items-center gap-2.5 transition-colors hover:border-line-strong"
                        >
                          <div className="h-8 w-8 rounded-md bg-surface text-ink font-bold flex items-center justify-center text-xs shrink-0">
                            {sp.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-ink">{sp.name}</div>
                            <div className="eyebrow text-[9px]">{sp.memberCount.toLocaleString()} members</div>
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
                ) : loadingPosts ? <p role="status" className="py-8 text-center text-xs text-ink-3">Loading bookmarks…</p> : savedPostsList.length === 0 ? (
                  <div className="panel rounded-xl p-8 text-center text-xs text-ink-3 border-dashed">
                    No bookmarks saved yet.
                  </div>
                ) : (
                  savedPostsList.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}
            </div>

          </div>

          {/* Right Sidebar Column (Agent 2 Ledger Widgets) */}
          <div className="lg:col-span-4 space-y-4">

            {/* About widget */}
            {(profile.status || location || website || profile.joined) && (
              <div className="panel rounded-xl p-4 space-y-2.5">
                <h3 className="eyebrow text-[10px] tracking-widest uppercase text-ink-3 hairline-b pb-1.5">About</h3>
                <dl className="space-y-2">
                  {profile.status && (
                    <div className="flex justify-between gap-4">
                      <dt className="eyebrow text-[9.5px]">Work</dt>
                      <dd className="num text-xs font-medium text-ink">{profile.status}</dd>
                    </div>
                  )}
                  {location && (
                    <div className="flex justify-between gap-4">
                      <dt className="eyebrow text-[9.5px]">Location</dt>
                      <dd className="text-xs text-ink">{location}</dd>
                    </div>
                  )}
                  {profile.joined && (
                    <div className="flex justify-between gap-4">
                      <dt className="eyebrow text-[9.5px]">Joined</dt>
                      <dd className="num text-xs text-ink">{profile.joined}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Spaces widget */}
            <div className="panel rounded-xl p-4 space-y-2.5">
              <h3 className="eyebrow text-[10px] tracking-widest uppercase text-ink-3 hairline-b pb-1.5">Spaces</h3>
              {joinedSpaces.length === 0 ? (
                <p className="text-xs text-ink-3">No spaces joined yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {joinedSpaces.slice(0, 5).map((sp) => (
                    <li key={sp.slug}>
                      <Link to={`/b/${sp.slug}`} className="flex items-center justify-between text-xs hover:text-ember transition-colors">
                        <span className="font-medium text-ink truncate mr-2">{sp.name}</span>
                        <span className="num text-[10px] text-ink-4 shrink-0">b/{sp.slug}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/communities" className="inline-block eyebrow text-[9.5px] text-ember hover:underline">
                Browse all spaces →
              </Link>
            </div>

            {/* Badges widget */}
            <div className="panel rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2 hairline-b pb-1.5">
                <Award className="h-3.5 w-3.5 text-gold" />
                <h3 className="eyebrow text-[10px] tracking-widest uppercase text-ink-3">Badges & Trust</h3>
              </div>
              {badgesError ? (
                <p className="text-xs text-danger">Couldn't load badges.</p>
              ) : earnedBadges.length === 0 ? (
                <p className="text-xs text-ink-3">No badges earned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {earnedBadges.map((eb) => (
                    <span
                      key={eb.badgeId}
                      title={eb.badgeId}
                      className="tag tag-gold text-[10px]"
                    >
                      ★ {eb.badgeId}
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
