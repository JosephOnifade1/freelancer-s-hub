import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { VoteControls } from "@/components/VoteControls";
import { 
  Link as LinkIcon, 
  MapPin, 
  Calendar, 
  Zap, 
  MessageSquare, 
  Camera, 
  Loader2, 
  MoreHorizontal, 
  Trash2, 
  Edit2, 
  Repeat, 
  Bookmark, 
  ArrowLeft,
  Mail,
  MoreVertical,
  Plus,
  PenSquare,
  Check
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard, PostData } from "@/components/PostCard";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, toggleFollow, updateUserAvatar, isVeteran } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor, updateComment, softDeleteComment } from "@/lib/comments";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Tab = "Threads" | "Resources" | "B-Spaces" | "Bookmarks";

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
      <div className="rounded-xl border border-dashed border-border/40 bg-card/60 p-4 opacity-60 flex gap-3 text-sm">
        <MessageSquare className="h-4 w-4 text-muted-foreground/60 mt-1" />
        <div>Comment removed • {formatTimeAgo(comment.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-5 hover:border-border transition-colors shadow-sm flex gap-4">
      <MessageSquare className="h-5 w-5 text-muted-foreground/60 shrink-0 mt-1" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-muted-foreground">
            Commented on{" "}
            <Link to={`/p/${comment.postId}`} className="font-medium text-foreground hover:text-primary transition-colors">
              a post
            </Link>{" "}
            • {formatTimeAgo(comment.createdAt)}
            {comment.isEdited && <span className="italic ml-1">(edited)</span>}
          </div>
          
          {isOwnProfile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 text-xs">
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Edit2 className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => deleteMutation.mutate()} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isEditing ? (
          <div className="mt-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full resize-none rounded-md bg-background border border-border p-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button 
                onClick={() => updateMutation.mutate()} 
                disabled={updateMutation.isPending || !editBody.trim()}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line mt-1">
            {comment.body}
          </p>
        )}
      </div>
    </div>
  );
};

export default function Profile() {
  const { uid, username, handle } = useParams();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const rawParam = uid || username || handle;
  const targetIdentifier = (rawParam === "me" ? currentUser?.uid : rawParam) || currentUser?.uid;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', targetIdentifier],
    queryFn: () => targetIdentifier ? getUserProfile(targetIdentifier) : null,
    enabled: !!targetIdentifier,
  });

  const profileUid = profile?.uid || targetIdentifier;
  const isOwnProfile = !!currentUser?.uid && (profileUid === currentUser.uid || profile?.uid === currentUser.uid);

  const [activeTab, setActiveTab] = useState<Tab>("Threads");
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  const { data: allPosts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts
  });

  const { data: userComments = [] } = useQuery({
    queryKey: ['userComments', profile?.uid],
    queryFn: () => profile ? fetchCommentsByAuthor(profile) : [],
    enabled: !!profile
  });

  // Filter posts created by this user
  const userPosts = profile ? allPosts.filter((p) => 
    !p.isDeleted && (
      p.author?.uid === profile.uid || 
      p.author?.name === profile.username || 
      p.author?.name === profile.displayName
    )
  ) : [];
  
  const resourcePosts = userPosts.filter(p => p.type === 'resource');
  const savedPostsList = profile ? allPosts.filter(p => profile.savedPosts?.[p.id]) : [];

  // Check if currentUser follows this user
  const { data: followData } = useQuery({
    queryKey: ['isFollowing', currentUser?.uid, profileUid],
    queryFn: async () => {
      if (!currentUser?.uid || !profileUid) return null;
      const { data } = await supabase
        .from("follows")
        .select("followingId")
        .eq("followerId", currentUser.uid)
        .eq("followingId", profileUid)
        .maybeSingle();
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
        toast.success("Avatar updated!");
      } catch (err) {
        toast.error("Failed to update avatar.");
      }
    };
    reader.readAsDataURL(file);
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
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Profile not found.</h2>
          <Link to="/" className="text-primary hover:underline font-medium text-sm">Return to feed</Link>
        </div>
      </AppLayout>
    );
  }

  // Format stats
  const postsCount = userPosts.length > 0 ? userPosts.length : (profile.postsCount || 164);
  const followersCount = profile.followers ? (profile.followers > 999 ? `${(profile.followers / 1000).toFixed(1)}K` : profile.followers) : "3.2K";
  const followingCount = profile.following ? profile.following : 312;
  const resourcesCount = resourcePosts.length > 0 ? resourcePosts.length : 28;
  const spacesCount = profile.spacesCount || 12;

  // Skills with percent
  const defaultSkills = [
    { name: "React", percent: 90 },
    { name: "Next.js", percent: 85 },
    { name: "TypeScript", percent: 80 },
    { name: "UI/UX", percent: 75 },
    { name: "Tailwind CSS", percent: 70 },
  ];

  const userSkillList = Array.isArray(profile.skills) && profile.skills.length > 0 
    ? profile.skills.map((s, idx) => ({
        name: typeof s === 'string' ? s : String(s),
        percent: Math.max(60, 95 - idx * 6)
      }))
    : defaultSkills;

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
              
              {/* Cosmic Cosmic Banner */}
              <div className="relative h-44 sm:h-52 w-full bg-slate-900 overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80" 
                  alt="Profile Banner"
                  className="h-full w-full object-cover object-center opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent opacity-80" />
              </div>

              {/* Avatar & Action Buttons Bar */}
              <div className="px-6 relative pb-6">
                <div className="flex items-end justify-between -mt-16 sm:-mt-20 mb-4">
                  
                  {/* Large Avatar */}
                  <div className="relative group">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-card bg-muted overflow-hidden shadow-xl relative">
                      {profile.avatarUrl ? (
                        <img src={profile.avatarUrl} alt={profile.displayName} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center font-heading text-3xl font-bold text-white bg-indigo-600">
                          {profile.initial || profile.displayName?.charAt(0) || "M"}
                        </div>
                      )}

                      {isOwnProfile && (
                        <div 
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Camera className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Online status indicator dot */}
                    <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-card" />

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
                    <button 
                      className="p-2.5 rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      title="More options"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {!isOwnProfile && (
                      <button 
                        className="p-2.5 rounded-lg border border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        onClick={() => toast.success(`Message sent to @${profile.username}`)}
                        title="Send message"
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                    )}

                    {isOwnProfile ? (
                      <Link 
                        to="/settings"
                        className="px-5 py-2 rounded-lg font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground transition-all shadow"
                      >
                        Edit Profile
                      </Link>
                    ) : (
                      <button 
                        onClick={() => followMutation.mutate()}
                        disabled={followMutation.isPending}
                        className={`px-5 py-2 rounded-lg font-medium text-sm transition-all shadow ${
                          isFollowing 
                            ? 'bg-secondary text-foreground hover:bg-secondary/80 border border-border/60'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {followMutation.isPending ? "Updating..." : (isFollowing ? "Following" : "Follow")}
                      </button>
                    )}
                  </div>
                </div>

                {/* User Name, Handle, Online Status */}
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                      {profile.displayName || profile.username || "MarceloDev"}
                    </h2>
                    <VerifiedBadge isVerified={profile.isVerifiedPro ?? true} size={18} />
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    @{profile.username || "MarceloDev"}
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
                ) : (
                  <p 
                    className={`text-sm text-foreground/90 leading-relaxed mb-4 ${isOwnProfile ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                    onClick={() => isOwnProfile && setIsEditingBio(true)}
                  >
                    {profile.bio || "Helping startups ship faster with modern frontend and AI tools. I share lessons on dev, freelancing, and building in public."}
                    {isOwnProfile && <Edit2 className="h-3 w-3 inline ml-2 text-muted-foreground opacity-60" />}
                  </p>
                )}

                {/* Meta details row (location, website, joined) */}
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{profile.location || "Sao Paulo, Brazil"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <LinkIcon className="h-3.5 w-3.5" />
                    <a 
                      href={profile.website ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`) : "https://marcelo.dev"} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="hover:text-primary transition-colors"
                    >
                      {profile.website || "marcelo.dev"}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Joined {profile.joined || "Jan 2024"}</span>
                  </div>
                </div>

                {/* Hashtags list */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {["#webdev", "#react", "#freelancing", "#buildinpublic"].map((tag) => (
                    <span 
                      key={tag} 
                      className="px-2.5 py-1 rounded-md bg-secondary/50 text-muted-foreground text-xs font-mono hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

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
            <div className="border-b border-border/50 flex items-center gap-8 font-medium text-sm px-2">
              {(["Threads", "Resources", "B-Spaces", "Bookmarks"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-3 font-semibold transition-all relative ${
                    activeTab === tab
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-500"
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
                userPosts.length === 0 ? (
                  // Sample profile threads matching screenshot if empty
                  <div className="space-y-4">
                    
                    {/* Thread Item 1 */}
                    <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <img 
                            src={profile.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} 
                            alt="Avatar" 
                            className="h-7 w-7 rounded-full object-cover" 
                          />
                          <span className="font-bold text-foreground flex items-center gap-1">
                            {profile.displayName || "MarceloDev"}
                            <VerifiedBadge isVerified={true} size={14} />
                          </span>
                          <span>• 2h ago</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            RESOURCE
                          </span>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex gap-4 items-start justify-between">
                        <div className="space-y-2 flex-1 min-w-0">
                          <h3 className="font-heading font-bold text-base text-foreground">
                            The freelance pricing calculator I built (free)
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Simple Notion template to help you price projects with confidence. It's saved me from undercharging for years.
                          </p>
                          <div className="flex gap-2 text-xs font-mono text-muted-foreground pt-1">
                            <span>#pricing</span>
                            <span>#freelancing</span>
                            <span>#tools</span>
                          </div>
                        </div>

                        {/* Thumbnail image */}
                        <div className="h-20 w-32 rounded-lg bg-slate-800 border border-border/40 overflow-hidden shrink-0 hidden sm:block">
                          <img 
                            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=300&q=80" 
                            alt="Template" 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                        <VoteControls score={187} entityId="mock-profile-p1" type="post" orientation="horizontal" />
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <MessageSquare className="h-4 w-4" /> 42
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                          <Repeat className="h-4 w-4" /> 12
                        </button>
                        <button className="hover:text-amber-400 transition-colors">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Thread Item 2 */}
                    <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <img 
                            src={profile.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} 
                            alt="Avatar" 
                            className="h-7 w-7 rounded-full object-cover" 
                          />
                          <span className="font-bold text-foreground flex items-center gap-1">
                            {profile.displayName || "MarceloDev"}
                            <VerifiedBadge isVerified={true} size={14} />
                          </span>
                          <span>• 1d ago</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            QUESTION
                          </span>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-heading font-bold text-base text-foreground">
                          What's your biggest challenge right now?
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          Curious to hear what you're all struggling with this month. Drop your biggest challenge below 👇
                        </p>
                        <div className="flex gap-2 text-xs font-mono text-muted-foreground pt-1">
                          <span>#discussion</span>
                          <span>#freelancing</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                        <VoteControls score={94} entityId="mock-profile-p2" type="post" orientation="horizontal" />
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <MessageSquare className="h-4 w-4" /> 156
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                          <Repeat className="h-4 w-4" /> 3
                        </button>
                        <button className="hover:text-amber-400 transition-colors">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Thread Item 3 */}
                    <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <img 
                            src={profile.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} 
                            alt="Avatar" 
                            className="h-7 w-7 rounded-full object-cover" 
                          />
                          <span className="font-bold text-foreground flex items-center gap-1">
                            {profile.displayName || "MarceloDev"}
                            <VerifiedBadge isVerified={true} size={14} />
                          </span>
                          <span>• 3d ago</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            RESOURCE
                          </span>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="flex gap-4 items-start justify-between">
                        <div className="space-y-2 flex-1 min-w-0">
                          <h3 className="font-heading font-bold text-base text-foreground">
                            My ultimate VS Code setup for productivity
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Extensions, settings, and tweaks that make coding 10x faster. I use this every day.
                          </p>
                          <div className="flex gap-2 text-xs font-mono text-muted-foreground pt-1">
                            <span>#vscode</span>
                            <span>#productivity</span>
                            <span>#tools</span>
                          </div>
                        </div>

                        <div className="h-20 w-32 rounded-lg bg-muted border border-border/40 overflow-hidden shrink-0 hidden sm:block">
                          <img 
                            src="https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=300&q=80" 
                            alt="VS Code Setup" 
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                        <VoteControls score={231} entityId="mock-profile-p3" type="post" orientation="horizontal" />
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <MessageSquare className="h-4 w-4" /> 64
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                          <Repeat className="h-4 w-4" /> 18
                        </button>
                        <button className="hover:text-amber-400 transition-colors">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Thread Item 4 */}
                    <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                          <img 
                            src={profile.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} 
                            alt="Avatar" 
                            className="h-7 w-7 rounded-full object-cover" 
                          />
                          <span className="font-bold text-foreground flex items-center gap-1">
                            {profile.displayName || "MarceloDev"}
                            <VerifiedBadge isVerified={true} size={14} />
                          </span>
                          <span>• 5d ago</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            WEEKLY
                          </span>
                        </div>
                        <button className="text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-heading font-bold text-base text-foreground">
                          🏆 Weekly Win: Landed a SaaS client 🎉
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          After weeks of outreach, finally closed a long-term SaaS project. Persistence pays off!
                        </p>
                        <div className="flex gap-2 text-xs font-mono text-muted-foreground pt-1">
                          <span>#wins</span>
                          <span>#clients</span>
                          <span>#freelancing</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
                        <VoteControls score={278} entityId="mock-profile-p4" type="post" orientation="horizontal" />
                        <button className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <MessageSquare className="h-4 w-4" /> 89
                        </button>
                        <button className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors">
                          <Repeat className="h-4 w-4" /> 6
                        </button>
                        <button className="hover:text-amber-400 transition-colors">
                          <Bookmark className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="py-6 text-center text-xs text-muted-foreground font-mono">
                      No more posts
                    </div>

                  </div>
                ) : (
                  userPosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {activeTab === "Resources" && (
                resourcePosts.length === 0 ? (
                  <div className="rounded-xl border border-border/40 bg-card p-10 text-center text-sm text-muted-foreground shadow-sm">
                    No resources shared yet.
                  </div>
                ) : (
                  resourcePosts.map((post, i) => <PostCard key={post.id} post={post} index={i} />)
                )
              )}

              {activeTab === "B-Spaces" && (
                <div className="rounded-xl border border-border/40 bg-card p-8 space-y-4 shadow-sm">
                  <h3 className="font-heading text-sm font-bold text-foreground">Member of 3 B-Spaces</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { name: "SaaS Founders", members: "1.2K members", tag: "b/saas-founders" },
                      { name: "AI Builders", members: "842 members", tag: "b/ai-builders" },
                      { name: "Frontend Hub", members: "2.6K members", tag: "b/frontend-hub" },
                    ].map((sp) => (
                      <div key={sp.name} className="p-3 rounded-lg border border-border/40 bg-muted/50 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center text-sm">
                          {sp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-foreground">{sp.name}</div>
                          <div className="text-xs text-muted-foreground">{sp.members}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "Bookmarks" && (
                savedPostsList.length === 0 ? (
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
            
            {/* Card 1: About */}
            <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-heading text-base font-bold text-foreground">About</h3>
              
              <div className="space-y-1.5 text-sm text-foreground/90">
                <p>Frontend Developer & Freelancer</p>
                <p className="text-muted-foreground">Next.js • React • TypeScript</p>
                <p className="text-muted-foreground">Lover of clean UI and good UX.</p>
              </div>

              <div className="space-y-3 pt-2 border-t border-border/30 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Work</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Available for projects</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-medium text-foreground">$75 / hr</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium text-foreground">{profile.location || "Sao Paulo, Brazil"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Languages</span>
                  <span className="font-medium text-foreground">English, Portuguese</span>
                </div>
              </div>
            </div>

            {/* Card 2: Top Skills */}
            <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-heading text-base font-bold text-foreground">Top Skills</h3>
              
              <div className="space-y-3.5">
                {userSkillList.map((sk) => (
                  <div key={sk.name} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{sk.name}</span>
                      <span className="text-muted-foreground font-mono">{sk.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                        style={{ width: `${sk.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: ⚡ Top Contributor */}
            <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-heading font-bold text-base">
                <Zap className="h-4 w-4 fill-emerald-500" />
                <span>Top Contributor</span>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { rank: 1, name: "Borynx Team", initial: "B", points: "9,999", color: "bg-indigo-600" },
                  { rank: 2, name: "Design Kara", initial: "D", points: "4,210", color: "bg-purple-600" },
                  { rank: 3, name: "Marcelo Dev", initial: "M", points: "2,340", color: "bg-slate-700", isOnline: true },
                  { rank: 4, name: "Freelance Mike", initial: "F", points: "1,560", color: "bg-blue-600" },
                  { rank: 5, name: "Sarah Writes", initial: "S", points: "890", color: "bg-pink-600" },
                ].map((c) => (
                  <div key={c.rank} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-3 font-mono">{c.rank}</span>
                      <div className={`h-7 w-7 rounded-full ${c.color || 'bg-primary'} flex items-center justify-center font-bold text-xs text-white relative border border-border/40`}>
                        {c.initial}
                        {c.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                        )}
                      </div>
                      <span className="font-medium text-foreground text-xs">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                      <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                      <span>{c.points}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link to="/achievements" className="text-xs text-indigo-500 hover:underline font-medium">
                  View leaderboard
                </Link>
              </div>
            </div>

            {/* Card 4: Recently Joined Spaces */}
            <div className="rounded-2xl border border-border/40 bg-card p-5 space-y-4 shadow-sm">
              <h3 className="font-heading text-base font-bold text-foreground">Recently Joined Spaces</h3>

              <div className="space-y-3">
                {[
                  { name: "SaaS Founders", members: "1.2K members", img: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=100&q=80" },
                  { name: "AI Builders", members: "842 members", img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&q=80" },
                  { name: "Frontend Hub", members: "2.6K members", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center gap-3">
                    <img src={s.img} alt={s.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-foreground">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground">{s.members}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2">
                <Link to="/communities" className="text-xs text-indigo-400 hover:underline font-medium">
                  View all spaces
                </Link>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Floating Action Button (FAB) Bottom Right */}
      <Link 
        to="/submit"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-105 z-50 border border-indigo-400/30"
        title="Create new post"
      >
        <PenSquare className="h-6 w-6" />
      </Link>
    </AppLayout>
  );
}
