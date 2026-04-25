import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Link as LinkIcon, MapPin, Calendar, Zap, ArrowUp, UserPlus, MessageSquare, Edit2, Check, X, Camera, BadgeCheck, CheckCircle2, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, toggleFollow, getUidByUsername, updateUserAvatar } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor, updateComment, softDeleteComment } from "@/lib/comments";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { set, ref } from "firebase/database";
import { database } from "@/lib/firebase";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Tab = "Overview" | "Posts" | "Comments" | "Resources" | "Saved";

const ProfileCommentCard = ({ comment, isOwnProfile }: { comment: any, isOwnProfile: boolean }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async () => updateComment(comment.postId, comment.id, editBody),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['userComments'] });
      toast.success("Comment updated");
    },
    onError: () => toast.error("Failed to update comment")
  });

  const deleteMutation = useMutation({
    mutationFn: async () => softDeleteComment(comment.postId, comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userComments'] });
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment")
  });

  if (comment.isDeleted) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-card p-5 opacity-60 flex gap-4">
        <div className="mt-1"><MessageSquare className="h-5 w-5 text-muted-foreground/50" /></div>
        <div className="flex-1 min-w-0">
          <div className="font-body text-xs text-muted-foreground mb-1">
             Comment removed <span className="mx-2">•</span> {formatTimeAgo(comment.createdAt)}
          </div>
          <p className="font-body text-sm text-muted-foreground/70 italic leading-relaxed">
             This insight was removed by the author.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-colors shadow-sm flex gap-4">
      <div className="mt-1">
        <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="font-body text-xs text-muted-foreground">
            Commented on <Link to={`/post/${comment.postId}`} className="font-medium text-foreground hover:text-primary transition-colors">a post</Link>
            <span className="mx-2">•</span>
            {formatTimeAgo(comment.createdAt)}
            {comment.isEdited && <span className="italic ml-1">(edited)</span>}
          </div>
          
          {isOwnProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 font-body">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                  <Edit2 className="h-4 w-4 mr-2" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteMutation.mutate()} className="cursor-pointer text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2 mb-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full resize-none rounded-md bg-background border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <button 
                onClick={() => updateMutation.mutate()} 
                disabled={updateMutation.isPending || !editBody.trim()}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="font-body text-sm text-foreground/90 leading-relaxed whitespace-pre-line mt-1">
            {comment.body}
          </p>
        )}
      </div>
    </div>
  );
};

const Profile = () => {
  const { uid, username, handle } = useParams();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [resolving, setResolving] = useState(!!username || !!handle);

  useEffect(() => {
    if (uid) {
      setResolvedUid(uid);
      setResolving(false);
    } else if (username) {
      setResolving(true);
      getUidByUsername(username).then(id => {
        setResolvedUid(id);
        setResolving(false);
      });
    } else if (handle && handle.startsWith("@")) {
      setResolving(true);
      const actualUsername = handle.substring(1);
      getUidByUsername(actualUsername).then(id => {
        setResolvedUid(id);
        setResolving(false);
      });
    } else if (currentUser?.uid && !handle) {
      setResolvedUid(currentUser.uid);
      setResolving(false);
    } else {
      setResolving(false);
    }
  }, [uid, username, handle, currentUser?.uid]);

  const profileUid = resolvedUid;
  const isOwnProfile = profileUid === currentUser?.uid;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', profileUid],
    queryFn: () => profileUid ? getUserProfile(profileUid) : null,
    enabled: !!profileUid && !resolving,
  });

  const { data: allPosts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const { data: userComments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['userComments', profile?.uid],
    queryFn: () => profile ? fetchCommentsByAuthor(profile) : [],
    enabled: !!profile
  });

  const tabs: Tab[] = isOwnProfile ? ["Overview", "Posts", "Comments", "Resources", "Saved"] : ["Overview", "Posts", "Comments", "Resources"];
  const [active, setActive] = useState<Tab>("Overview");
  
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  // Availability Toggle State
  const [isOpenToGigs, setIsOpenToGigs] = useState(true);

  useEffect(() => {
    if (profile?.bio) {
      setBioInput(profile.bio);
    }
  }, [profile?.bio]);

  const handleSaveBio = async () => {
    if (!profileUid) return;
    setIsSavingBio(true);
    try {
      await set(ref(database, `users/${profileUid}/bio`), bioInput);
      queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
      setIsEditingBio(false);
      toast.success("Bio updated");
    } catch (e) {
      toast.error("Failed to update bio");
    } finally {
      setIsSavingBio(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profileUid) return;
    
    // Validate size (< 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be smaller than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        await updateUserAvatar(profileUid, base64String);
        queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
        toast.success("Avatar updated successfully!");
      } catch (err) {
        toast.error("Failed to update avatar.");
      }
    };
    reader.readAsDataURL(file);
  };
    // Derived Data (Filter out deleted content)
  const userPosts = profile ? allPosts.filter((p) => 
    !p.isDeleted && (
      p.author?.uid === profile.uid || 
      p.author?.name === profile.username || 
      p.author?.name === profile.displayName
    )
  ) : [];
  
  const resourcePosts = userPosts.filter(p => p.category === "Resources" || p.tags?.includes("resource"));
  const savedPostsList = profile ? allPosts.filter(p => profile.savedPosts?.[p.id]) : [];
  
  // Mixed Feed for Overview: Top 3 Posts + Top 3 Comments
  const recentPosts = userPosts.slice(0, 3);
  const recentComments = userComments.filter(c => !c.isDeleted).slice(0, 3);
  const mixedOverview = [...recentPosts, ...recentComments].sort((a, b) => b.createdAt - a.createdAt);

  const totalContributions = userPosts.length + userComments.filter(c => !c.isDeleted).length;

  const tabCounts: Record<Tab, string> = {
    Overview: String(mixedOverview.length),
    Posts: String(userPosts.length),
    Comments: String(userComments.filter(c => !c.isDeleted).length),
    Resources: String(resourcePosts.length),
    Saved: String(savedPostsList.length)
  };
  
  const isFollowing = currentUser && profile?.followersList?.[currentUser.uid] === true;

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser || !profileUid) throw new Error("Not logged in");
      return toggleFollow(currentUser.uid, profileUid);
    },
    onSuccess: (isFollowing) => {
      queryClient.invalidateQueries({ queryKey: ['profile', profileUid] });
      toast.success(isFollowing ? `Followed @${profile?.username}` : `Unfollowed @${profile?.username}`);
    },
    onError: () => {
      toast.error("Failed to follow user");
    }
  });

  if (isLoading || resolving) {
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
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Column (Header + Feed) */}
          <div className="lg:col-span-2">
            
            {/* Header Redesign */}
            <div className="mb-8">
              <div className="flex items-start justify-between">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  
                  {/* Avatar Wrapper */}
                  <div className="relative group">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-3xl font-bold text-primary overflow-hidden border-2 border-border relative">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        profile.initial
                      )}
                      
                      {isOwnProfile && (
                        <div 
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Camera className="h-6 w-6 text-white" />
                        </div>
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

                  {/* Profile Info */}
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h1 className="font-heading text-2xl font-bold text-foreground">
                        {profile.displayName || profile.username}
                      </h1>
                      <div className="flex items-center text-lime-500 bg-lime-500/10 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase font-heading">
                        <BadgeCheck className="h-3 w-3 mr-1" />
                        Verified Pro
                      </div>
                    </div>
                    
                    <span className="text-muted-foreground font-body text-sm font-medium mr-2 block mb-3">
                      @{profile.username}
                    </span>
                    
                    {isOwnProfile && isEditingBio ? (
                      <div className="mb-4 mt-2">
                        <Textarea 
                          value={bioInput} 
                          onChange={(e) => setBioInput(e.target.value)}
                          className="font-body text-sm mb-2 resize-none"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={handleSaveBio}
                            disabled={isSavingBio}
                            className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                          >
                            {isSavingBio ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
                          </button>
                          <button 
                            onClick={() => setIsEditingBio(false)}
                            className="flex items-center gap-1 rounded border border-border px-3 py-1 text-xs font-semibold hover:bg-secondary transition-colors"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className={`group relative mb-4 font-body text-sm text-foreground/90 leading-relaxed ${isOwnProfile ? "cursor-pointer hover:text-foreground transition-colors" : ""}`}
                        onClick={() => isOwnProfile && setIsEditingBio(true)}
                      >
                        {profile.bio || (isOwnProfile ? "Click to add a professional bio..." : "This user hasn't added a bio yet.")}
                        {isOwnProfile && <Edit2 className="h-3 w-3 inline ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </div>
                    )}
                  </div>
                </div>

                {/* CTAs */}
                <div className="shrink-0 flex items-center gap-2">
                  {isOwnProfile ? (
                    <Link to="/settings" className="rounded-full border border-border px-4 py-2 font-body text-sm font-semibold hover:bg-secondary transition-colors shadow-sm">
                      Edit Profile
                    </Link>
                  ) : (
                    <>
                      <button 
                        className="flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card hover:bg-secondary transition-colors shadow-sm"
                        onClick={() => toast.success(`Message sent to @${profile.username}`)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      {!isOwnProfile && (
                        <button 
                          onClick={() => followMutation.mutate()}
                          disabled={followMutation.isPending}
                          className={`flex items-center gap-2 rounded-full px-5 py-2 font-body text-sm font-semibold transition-all shadow-sm ${
                            isFollowing 
                              ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border'
                              : 'bg-primary text-primary-foreground hover:opacity-90'
                          }`}
                        >
                          {followMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>{isFollowing ? "Following" : <> <UserPlus className="h-4 w-4" /> Follow</>}</>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Horizontal Tabs */}
            <div className="mb-6 flex items-center gap-6 border-b border-border font-body text-sm overflow-x-auto no-scrollbar">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setActive(t)}
                  className={`pb-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
                    active === t
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  {t} <span className="ml-1 opacity-50 font-normal">({tabCounts[t]})</span>
                </button>
              ))}
            </div>

            {/* Main Feed Content */}
            <div className="space-y-4">
              {active === "Overview" && (
                mixedOverview.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center mb-2">
                      <Zap className="h-8 w-8 text-primary/30" />
                    </div>
                    <div>
                      <h3 className="font-heading text-lg font-bold text-foreground">No active history</h3>
                      <p className="font-body text-sm text-muted-foreground max-w-[280px] mx-auto mt-1">
                        {isOwnProfile 
                          ? "You haven't shared any insights or resources yet. Start building your professional presence today."
                          : "This user hasn't shared any insights yet."}
                      </p>
                    </div>
                    {isOwnProfile && (
                      <Link 
                        to="/" 
                        className="mt-2 rounded-full bg-primary px-6 py-2.5 font-heading text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-105"
                      >
                        Create your first post
                      </Link>
                    )}
                  </div>
                ) : (
                  mixedOverview.map((item: any, i) => {
                    // Type guard for posts vs comments
                    if (item.title) {
                      // It's a post
                      return <PostCard key={item.id} post={item} index={i} />;
                    } else {
                      // It's a comment
                      return <ProfileCommentCard key={item.id} comment={item} isOwnProfile={isOwnProfile} />;
                    }
                  })
                )
              )}

              {active === "Posts" && (
                userPosts.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center font-body text-sm text-muted-foreground shadow-sm">
                    No posts yet.
                  </div>
                ) : (
                  userPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {active === "Comments" && (
                userComments.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center font-body text-sm text-muted-foreground shadow-sm">
                    No comments yet.
                  </div>
                ) : (
                  userComments.map((comment) => (
                    <ProfileCommentCard key={comment.id} comment={comment} isOwnProfile={isOwnProfile} />
                  ))
                )
              )}

              {active === "Resources" && (
                resourcePosts.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center font-body text-sm text-muted-foreground shadow-sm">
                    No resources shared yet.
                  </div>
                ) : (
                  resourcePosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {active === "Saved" && isOwnProfile && (
                savedPostsList.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center font-body text-sm text-muted-foreground shadow-sm flex flex-col items-center gap-3">
                     <Zap className="h-8 w-8 text-muted-foreground/30" />
                     <p className="max-w-xs">Your private saved posts will appear here. Only you can see this tab.</p>
                  </div>
                ) : (
                  savedPostsList.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}
            </div>

          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 space-y-5">
            
            {/* Availability Card */}
            {isOwnProfile && (
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-sm font-bold text-foreground">Availability</h3>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">Let clients know your status.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-body text-xs font-semibold ${isOpenToGigs ? "text-lime-500" : "text-muted-foreground"}`}>
                    {isOpenToGigs ? "Open to Gigs" : "Unavailable"}
                  </span>
                  <Switch 
                    checked={isOpenToGigs}
                    onCheckedChange={setIsOpenToGigs}
                    className={isOpenToGigs ? "data-[state=checked]:bg-lime-500" : ""}
                  />
                </div>
              </div>
            )}
            
            {/* Stats Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground mb-4 pb-2 border-b border-border/50">
                Community Stats
              </h3>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm text-muted-foreground">Contributions</span>
                  <span className="font-heading text-sm font-bold text-foreground">{totalContributions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm text-muted-foreground">Reputation</span>
                  <span className="font-heading text-sm font-bold text-foreground flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    {(profile.reputation || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm text-muted-foreground">Followers</span>
                  <span className="font-heading text-sm font-bold text-foreground">{profile.followers || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-body text-sm text-muted-foreground">Joined</span>
                  <span className="font-heading text-sm font-bold text-foreground">{profile.joined || "Recently"}</span>
                </div>
              </div>
            </div>

            {/* Skills Card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground mb-4 pb-2 border-b border-border/50">
                Top Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(profile.skills) && profile.skills.length > 0 ? (
                  profile.skills.map(skill => (
                    <span 
                      key={skill} 
                      className="px-2.5 py-1 rounded bg-[#1e1b4b] text-white font-body text-xs font-medium tracking-wide shadow-sm"
                    >
                      #{typeof skill === 'string' ? skill.toLowerCase().replace(/\s+/g, '') : skill}
                    </span>
                  ))
                ) : (
                  <span className="font-body text-xs text-muted-foreground">No skills added yet.</span>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
