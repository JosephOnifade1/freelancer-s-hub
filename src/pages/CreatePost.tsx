import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { X, BarChart2, HelpCircle, BookOpen, ChevronDown, ImageIcon, Video, Code2, FileUp, Search, CheckCircle2, Plus, Send, Globe, Users, ShieldAlert, Layout, User } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";
import { createPost } from "@/lib/posts";
import { uploadImage } from "@/lib/uploads";
import { fetchAllCommunities, getCommunityStyle } from "@/lib/communities";
import { ResourceBodyEditor } from "@/components/editor/ResourceBodyEditor";
import { ResourceMarkdownHelp } from "@/components/editor/ResourceMarkdownHelp";
import { QueryErrorState } from "@/components/QueryErrorState";

type PostType = "discussion" | "question" | "resource" | "poll";

interface PendingBodyImage {
  alt: string;
  src: string;
}

type PostTargetKind = "loading" | "profile" | "space";

interface BSpaceOption {
  id: string;
  kind: PostTargetKind;
  name: string;
  slug: string;
  communitySlug: string | null;
  icon: React.ElementType;
  color: string;
  popularTags: string[];
  ownerId?: string;
}

// Real spaces are loaded from the database inside the component (see
// realSpaces useQuery below) — this used to be a hardcoded fake list
// (frontend-hub, indie-builders, etc.) with slugs that don't exist in the
// real `communities` table, which is what was causing every post submit
// to fail with a foreign key violation (23503).
const LOADING_SPACE: BSpaceOption = {
  id: "loading",
  kind: "loading",
  name: "Loading spaces…",
  slug: "",
  communitySlug: null,
  icon: Globe,
  color: "text-muted-foreground bg-muted",
  popularTags: [],
};

const CreatePost = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bodyImageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Real spaces (communities) from the database
  const { data: realSpaces = [], isLoading: spacesLoading, isError: spacesError, refetch: refetchSpaces } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user,
  });

  const spaceHandle = (sp: BSpaceOption) => {
    if (sp.kind === "profile") return `f/${profile?.username || "you"}`;
    if (sp.kind === "loading") return sp.id === "loading" ? "Loading…" : "Choose another target";
    return `b/${sp.slug}`;
  };

  const B_SPACES: BSpaceOption[] = useMemo(() => {
    const spaces: BSpaceOption[] = [];

    // Profile posts do not require a space slug or a successful profile
    // lookup: the authenticated uid is their actual author identity.
    if (user?.uid) {
      spaces.push({
        id: `profile:${user.uid}`,
        kind: "profile",
        name: "Your profile",
        slug: "",
        communitySlug: null, // profile posts have no community slug
        icon: User,
        color: "text-foreground bg-muted",
        popularTags: [],
      });
    }

    // Then all communities
    return [
      ...spaces,
      ...realSpaces.map((c) => {
        const style = getCommunityStyle(c.category);
        return {
          id: c.slug,
          kind: "space" as const,
          name: c.name,
          slug: c.slug,
          communitySlug: c.slug,
          icon: style.icon,
          color: style.iconBg,
          popularTags: c.topics?.length ? c.topics : ["general"],
          ownerId: c.ownerId,
        };
      }),
    ];
  }, [realSpaces, user?.uid]);

  // Form State
  const VALID_TYPES: PostType[] = ["discussion", "question", "resource", "poll"];
  const typeParam = searchParams.get("type") as PostType | null;
  const [postType, setPostType] = useState<PostType>(
    typeParam && VALID_TYPES.includes(typeParam) ? typeParam : "discussion"
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["Option 1", "Option 2"]);
  const [selectedSpace, setSelectedSpace] = useState<BSpaceOption>(LOADING_SPACE);

  // A post to your own profile has no space: no space-only visibility, no pinning.
  // The target kind is explicit — an empty slug means "profile", not "loading".
  const isProfileTarget = selectedSpace.kind === "profile";
  const requestedSpaceSlug = searchParams.get("space");
  const targetsReady = !profileLoading && (!requestedSpaceSlug || (!spacesLoading && !spacesError));

  useEffect(() => {
    if (!targetsReady || selectedSpace.kind !== "loading" || B_SPACES.length === 0) return;
    if (requestedSpaceSlug) {
      const preselected = B_SPACES.find((s) => s.kind === "space" && s.slug === requestedSpaceSlug);
      setSelectedSpace(preselected || {
        ...LOADING_SPACE,
        id: `unavailable:${requestedSpaceSlug}`,
        name: "Space unavailable — choose a target",
      });
    } else {
      setSelectedSpace(B_SPACES[0]);
    }
  }, [targetsReady, B_SPACES, requestedSpaceSlug, selectedSpace.kind]);

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [bodyImages, setBodyImages] = useState<PendingBodyImage[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  
  // Pinning is restricted to the space owner and platform staff — the
  // database rejects pinned posts from anyone else, so the toggle is
  // only offered when it will actually work.
  const canPin =
    !!user?.uid &&
    (profile?.role === "admin" ||
      profile?.role === "moderator" ||
      (!!selectedSpace.ownerId && selectedSpace.ownerId === user.uid));

  // Post Settings State
  const [visibility, setVisibility] = useState<"public" | "members" | "admins">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [pinToSpace, setPinToSpace] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isProfileTarget) {
      setVisibility("public");
      setPinToSpace(false);
    }
  }, [isProfileTarget]);

  useEffect(() => {
    if (!canPin) setPinToSpace(false);
  }, [canPin]);

  const bodyImagePreviews = useMemo(() => bodyImages, [bodyImages]);

  // Tag Helpers
  const addTag = (tagToAdd?: string) => {
    const t = (tagToAdd || tagInput).trim().toLowerCase().replace(/^#/, "");
    if (!t) return;
    if (tags.includes(t)) {
      toast({ title: "Tag exists", description: "This tag is already added." });
      return;
    }
    if (tags.length >= 5) {
      toast({ title: "Tag limit reached", description: "You can add up to 5 tags maximum." });
      return;
    }
    setTags([...tags, t]);
    setTagInput("");
    setIsAddingTag(false);
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  // Media Handlers — images are uploaded to Storage when picked, so the
  // post body stores a URL instead of a multi-megabyte base64 blob.
  const [uploadingImages, setUploadingImages] = useState(false);
  const handleBodyImageFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;

    setUploadingImages(true);
    try {
      for (const file of images) {
        const url = await uploadImage(file, "post-images");
        setBodyImages((current) => [...current, { alt: file.name, src: url }]);
      }
    } catch (error) {
      toast({
        title: "Image upload failed",
        description: error instanceof Error ? error.message : "Could not upload that image.",
        variant: "destructive",
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const removeBodyImage = (src: string) => {
    setBodyImages((current) => current.filter((image) => image.src !== src));
  };

  const handleDocumentFiles = (files: FileList | null) => {
    if (!files?.length) return;
    Array.from(files).forEach((f) => {
      setAttachedFiles((prev) => [...prev, f.name]);
    });
    toast({ title: "File attached", description: `${files.length} file(s) attached successfully.` });
  };

  const handleInsertCodeSnippet = () => {
    const snippet = "\n\n```typescript\n// Write your code snippet here\nfunction example() {\n  console.log('Hello Borynx');\n}\n```\n\n";
    setBody((prev) => prev + snippet);
    toast({ title: "Code block added", description: "Markdown code snippet inserted into body." });
  };

  const [hasDraft, setHasDraft] = useState<boolean>(() => !!localStorage.getItem("borynx_post_draft"));

  const handleSaveDraft = () => {
    const draft = { title, body, postType, selectedTargetId: selectedSpace.id, tags };
    localStorage.setItem("borynx_post_draft", JSON.stringify(draft));
    setHasDraft(true);
    toast({ title: "Draft saved", description: "Your post draft has been saved locally." });
  };

  const handleLoadDraft = () => {
    const saved = localStorage.getItem("borynx_post_draft");
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        if (draft.title) setTitle(draft.title);
        if (draft.body) setBody(draft.body);
        if (draft.postType) setPostType(draft.postType);
        if (draft.tags) setTags(draft.tags);
        const savedTarget = B_SPACES.find((target) => target.id === draft.selectedTargetId);
        if (savedTarget) setSelectedSpace(savedTarget);
        toast({ title: "Draft loaded", description: "Restored your saved draft." });
      } catch {
        toast({ title: "No saved draft", description: "No valid draft found." });
      }
    } else {
      toast({ title: "No saved draft", description: "You don't have any saved drafts." });
    }
  };

  // Submit Logic
  const submit = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    const shouldIncludePendingImages = postType !== "resource" && bodyImages.length > 0;
    const imageMarkdown = shouldIncludePendingImages
      ? bodyImages.map((image) => `![${image.alt}](${image.src})`).join("\n\n")
      : "";
    
    let finalBody = imageMarkdown
      ? [trimmedBody, imageMarkdown].filter(Boolean).join("\n\n")
      : body;

    if (videoUrl.trim()) {
      finalBody += `\n\n[Video Link](${videoUrl.trim()})`;
    }

    if (!trimmedTitle || !finalBody.trim()) {
      toast({ title: "Missing fields", description: "Please enter a title and post description.", variant: "destructive" });
      return;
    }

    const cleanPollOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (postType === "poll" && cleanPollOptions.length < 2) {
      toast({ title: "Poll needs options", description: "Add at least 2 poll options before publishing.", variant: "destructive" });
      return;
    }

    if (!user?.uid) {
      toast({ title: "Not signed in", description: "Please sign in before posting.", variant: "destructive" });
      return;
    }

    if (selectedSpace.kind === "loading") {
      toast({
        title: "Choose a post target",
        description: spacesError ? "Spaces couldn't be loaded. Retry or select your profile." : "Wait for spaces to load, or select a valid target.",
        variant: "destructive",
      });
      return;
    }

    if (selectedSpace.kind === "space" && !selectedSpace.communitySlug) {
      toast({ title: "Choose a space", description: "That space could not be loaded. Pick another target and try again.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const postPayload = {
        title: trimmedTitle,
        body: finalBody,
        type: postType,
        tags,
        communitySlug: selectedSpace.kind === "space" ? selectedSpace.communitySlug : null,
        author: { 
          uid: user.uid,
          name: profile?.displayName || profile?.username || "Anonymous",
          reputation: profile?.reputation ?? 0,
          avatar: profile?.avatarUrl,
          isVerifiedPro: profile?.isVerifiedPro ?? false,
        },
        score: 0,
        commentCount: 0,
        timeAgo: "just now",
        isPinned: selectedSpace.kind === "space" && pinToSpace,
        allowComments,
        visibility: isProfileTarget ? "public" as const : visibility,
        ...(postType === "poll" ? { pollOptions: cleanPollOptions } : {}),
      };

      await createPost({
        ...postPayload,
        ...(postType === "resource" && externalLink.trim()
          ? { externalLink: externalLink.trim() }
          : {}),
      });

      // Clear draft
      localStorage.removeItem("borynx_post_draft");
      setHasDraft(false);

      toast({ title: "Post published!", description: `Your post is live in ${selectedSpace.name}.` });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      if (selectedSpace.kind === "space" && selectedSpace.communitySlug) {
        queryClient.invalidateQueries({ queryKey: ['communityPosts', selectedSpace.communitySlug] });
        navigate(`/b/${selectedSpace.communitySlug}`);
      } else {
        // Profile post — navigate to the user's own profile
        navigate(`/f/${profile?.username || user.uid}`);
      }
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : "Failed to create post.";
      toast({ title: "Error", description, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const SpaceIcon = selectedSpace.icon;

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <div className="flex items-center gap-3.5">
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Create New Post
              </h1>
              <p className="font-body text-xs sm:text-sm text-muted-foreground mt-0.5">
                Post to a space, or to your own profile.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {hasDraft && (
              <button 
                onClick={handleLoadDraft}
                className="text-xs font-semibold text-info hover:opacity-80 transition-colors flex items-center gap-1.5"
              >
                <span>Drafts (1)</span>
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Hidden inputs */}
        <input
          ref={bodyImageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            handleBodyImageFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            handleDocumentFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Main Form Column */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Section 1: What do you want to share? */}
            <div className="space-y-2">
              <h2 className="font-heading text-sm font-bold text-foreground">
                1. What do you want to share?
              </h2>

              <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 space-y-4 shadow-sm relative">
                
                {/* Title Input */}
                <div className="space-y-1">
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Post title (e.g. How to optimize React render performance?)"
                    maxLength={140}
                    className="border-none bg-transparent px-0 font-heading text-base font-bold text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="h-px w-full bg-border/40" />
                </div>

                {/* Body Textarea / Editor */}
                {postType === "resource" ? (
                  <div className="space-y-3">
                    <ResourceBodyEditor
                      value={body}
                      onChange={setBody}
                      placeholder="Describe the resource. What's the high-signal takeaway?"
                    />
                    <ResourceMarkdownHelp />
                  </div>
                ) : (
                  <div className="relative">
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Share your thoughts, ask a question, or start a discussion..."
                      maxLength={1500}
                      className="min-h-[160px] resize-y border-none bg-transparent px-0 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed"
                    />
                    <div className="text-[11px] tabular-nums text-muted-foreground text-right pt-2">
                      {(title.length + body.length)}/1500
                    </div>
                  </div>
                )}

                {/* Resource External Link input */}
                {postType === "resource" && (
                  <div className="pt-2 animate-in fade-in duration-300">
                    <Input
                      value={externalLink}
                      onChange={(e) => setExternalLink(e.target.value)}
                      placeholder="External link (e.g. https://github.com/repository)"
                      className="bg-muted/40 border-border/60 text-xs"
                    />
                  </div>
                )}

                {/* Poll Options Input (if Poll selected) */}
                {postType === "poll" && (
                  <div className="p-3 rounded-xl bg-brand/5 border border-brand/20 space-y-2.5 animate-in fade-in duration-300">
                    <span className="text-xs font-semibold text-brand flex items-center gap-1.5">
                      <BarChart2 className="h-3.5 w-3.5" /> Poll Options
                    </span>
                    {pollOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...pollOptions];
                            newOpts[idx] = e.target.value;
                            setPollOptions(newOpts);
                          }}
                          placeholder={`Option ${idx + 1}`}
                          className="bg-card text-xs h-9"
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                            className="p-2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 5 && (
                      <button
                        onClick={() => setPollOptions([...pollOptions, ""])}
                        className="text-xs font-medium text-brand hover:underline flex items-center gap-1 pt-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Poll Option
                      </button>
                    )}
                  </div>
                )}

                {/* Sub-type / Tool Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                  <button
                    type="button"
                    onClick={() => setPostType(postType === "poll" ? "discussion" : "poll")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                      postType === "poll"
                        ? "bg-brand/20 border-brand/40 text-brand shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <BarChart2 className="h-3.5 w-3.5" />
                    <span>Add Poll</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostType(postType === "question" ? "discussion" : "question")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                      postType === "question"
                        ? "bg-brand/20 border-brand/40 text-brand shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>Add Question</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPostType(postType === "resource" ? "discussion" : "resource")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                      postType === "resource"
                        ? "bg-brand/20 border-brand/40 text-brand shadow-sm"
                        : "bg-muted/40 border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>Add Resource</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: Choose a B-Space */}
            <div className="space-y-1.5">
              <h2 className="font-heading text-sm font-bold text-foreground">
                2. Choose a B-Space
              </h2>
              <p className="text-xs text-muted-foreground">
                Select the most relevant space for your post.
              </p>

              {spacesError && (
                <QueryErrorState
                  title="Couldn't load spaces"
                  message="Your profile is still available. Retry to load the space list."
                  onRetry={() => refetchSpaces()}
                />
              )}

              <div className="pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full rounded-2xl border border-border/50 bg-card p-3.5 flex items-center justify-between hover:border-brand/40 transition-colors shadow-sm group">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl ${selectedSpace.color} flex items-center justify-center font-bold shrink-0`}>
                          <SpaceIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="text-left">
                          <p className="font-heading text-sm font-bold text-foreground">
                            {selectedSpace.name}
                          </p>
                          <p className="text-[11px] tabular-nums text-muted-foreground">
                            {spaceHandle(selectedSpace)}
                          </p>
                        </div>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent align="start" className="w-[320px] p-1.5 space-y-1">
                    {B_SPACES.map((sp) => {
                      const IconComp = sp.icon;
                      const isSelected = sp.id === selectedSpace.id;
                      return (
                        <DropdownMenuItem
                          key={sp.id}
                          onClick={() => setSelectedSpace(sp)}
                          className={`p-2.5 rounded-xl cursor-pointer flex items-center gap-3 ${
                            isSelected ? "bg-muted text-foreground font-semibold" : ""
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-lg ${sp.color} flex items-center justify-center font-bold shrink-0`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{sp.name}</p>
                            <p className="text-[10px] tabular-nums text-muted-foreground">{spaceHandle(sp)}</p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Section 3: Add Tags (up to 5) */}
            <div className="space-y-1.5">
              <h2 className="font-heading text-sm font-bold text-foreground">
                3. Add Tags (up to 5)
              </h2>
              <p className="text-xs text-muted-foreground">
                Tags help others discover your post.
              </p>

              <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand/10 border border-brand/20 text-xs font-semibold text-brand"
                    >
                      #{t}
                      <button
                        onClick={() => removeTag(t)}
                        className="text-brand/70 hover:text-brand transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {tags.length < 5 && (
                    isAddingTag ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          autoFocus
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTag();
                            } else if (e.key === "Escape") {
                              setIsAddingTag(false);
                            }
                          }}
                          placeholder="tag name..."
                          className="h-8 w-28 text-xs bg-muted/60"
                        />
                        <button
                          onClick={() => addTag()}
                          className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary text-xs font-bold"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingTag(true)}
                        className="h-8 w-8 rounded-xl border border-dashed border-border/80 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                        title="Add Tag"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Add Media (optional) */}
            <div className="space-y-1.5">
              <h2 className="font-heading text-sm font-bold text-foreground">
                4. Add Media (optional)
              </h2>
              <p className="text-xs text-muted-foreground">
                Images, videos, code snippets or files.
              </p>

              <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 space-y-4 shadow-sm">
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Image Tile */}
                  <button
                    type="button"
                    onClick={() => bodyImageInputRef.current?.click()}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-brand/10 hover:border-brand/30 text-center space-y-2 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted text-foreground mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                      <ImageIcon className="h-5 w-5" />
                    </div>
                    <span className="block text-xs font-bold text-foreground">Image</span>
                  </button>

                  {/* Video Tile */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowVideoInput(!showVideoInput);
                    }}
                    className={`p-4 rounded-xl border text-center space-y-2 transition-all group ${
                      showVideoInput 
                        ? "bg-brand/15 border-brand/40" 
                        : "border-border/50 bg-muted/20 hover:bg-brand/10 hover:border-brand/30"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted text-foreground mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Video className="h-5 w-5" />
                    </div>
                    <span className="block text-xs font-bold text-foreground">Video</span>
                  </button>

                  {/* Code Tile */}
                  <button
                    type="button"
                    onClick={handleInsertCodeSnippet}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-brand/10 hover:border-brand/30 text-center space-y-2 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted text-foreground mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <span className="block text-xs font-bold text-foreground">Code</span>
                  </button>

                  {/* File Tile */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-brand/10 hover:border-brand/30 text-center space-y-2 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted text-foreground mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                      <FileUp className="h-5 w-5" />
                    </div>
                    <span className="block text-xs font-bold text-foreground">File</span>
                  </button>
                </div>

                {/* Video URL Prompt */}
                {showVideoInput && (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2 animate-in fade-in duration-300">
                    <span className="text-xs font-semibold text-foreground">Embed Video Link</span>
                    <Input
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=... or Loom URL"
                      className="text-xs h-9"
                    />
                  </div>
                )}

                {/* Uploaded Images Previews */}
                {bodyImagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-3 pt-2">
                    {bodyImagePreviews.map((image, index) => (
                      <div key={`${image.src}-${index}`} className="relative group w-24 h-24 rounded-xl border border-border/60 overflow-hidden bg-muted">
                        <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeBodyImage(image.src)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attached Files List */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {attachedFiles.map((fn, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 border border-border/40">
                        <span className="tabular-nums truncate">{fn}</span>
                        <button onClick={() => setAttachedFiles(attachedFiles.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>

            {/* Section 5: Post Settings */}
            <div className="space-y-1.5">
              <h2 className="font-heading text-sm font-bold text-foreground">
                5. Post Settings
              </h2>
              <p className="text-xs text-muted-foreground">
                Control who can see and interact with your post.
              </p>

              <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 space-y-5 shadow-sm">
                
                {/* Visibility Options */}
                <div className="space-y-2">
                  
                  {/* Option 1: Public */}
                  <button
                    type="button"
                    onClick={() => setVisibility("public")}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      visibility === "public"
                        ? "border-brand/50 bg-brand/10"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">Public</p>
                        <p className="text-[11px] text-muted-foreground">Anyone on Borynx can view and interact</p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      visibility === "public" ? "border-brand bg-brand" : "border-border"
                    }`}>
                      {visibility === "public" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </button>

                  {!isProfileTarget && (
                    <>
                  {/* Option 2: Space Members Only */}
                  <button
                    type="button"
                    onClick={() => setVisibility("members")}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      visibility === "members"
                        ? "border-brand/50 bg-brand/10"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">Space Members Only</p>
                        <p className="text-[11px] text-muted-foreground">Only members of {selectedSpace.name} can see this — hidden from feeds and search for everyone else</p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      visibility === "members" ? "border-brand bg-brand" : "border-border"
                    }`}>
                      {visibility === "members" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </button>

                  {/* Option 3: Admins & Moderators Only */}
                  <button
                    type="button"
                    onClick={() => setVisibility("admins")}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      visibility === "admins"
                        ? "border-brand/50 bg-brand/10"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-4.5 w-4.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">Admins & Moderators Only</p>
                        <p className="text-[11px] text-muted-foreground">Only you, the space owner, and platform moderators can see this</p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      visibility === "admins" ? "border-brand bg-brand" : "border-border"
                    }`}>
                      {visibility === "admins" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                    </>
                  )}

                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2 border-t border-border/40">
                  
                  <div className="flex items-center justify-between p-2 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="font-heading text-xs font-bold text-foreground">Allow comments</p>
                      <p className="text-[11px] text-muted-foreground">When off, nobody can add new comments — existing comments stay visible</p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>

                  {!isProfileTarget && canPin && (
                  <div className="flex items-center justify-between p-2 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="font-heading text-xs font-bold text-foreground">Pin to B-Space</p>
                      <p className="text-[11px] text-muted-foreground">Pinned posts appear at the top of the space</p>
                    </div>
                    <Switch checked={pinToSpace} onCheckedChange={setPinToSpace} />
                  </div>
                  )}

                </div>

              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-5 py-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-sm"
              >
                Save Draft
              </button>

              <button
                type="button"
                onClick={submit}
                disabled={isSubmitting || uploadingImages || selectedSpace.kind === "loading"}
                className="px-6 py-2.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-heading text-sm font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Publishing..." : uploadingImages ? "Uploading images..." : selectedSpace.kind === "loading" ? "Choose a target" : selectedSpace.kind === "space" ? `Post to ${selectedSpace.name}` : "Post to Profile"}</span>
              </button>
            </div>

          </div>

          {/* Right Sidebar Column */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Posting tips */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold text-foreground">Before you post</h3>
              <ul className="space-y-3 text-xs leading-relaxed">
                <li><span className="font-semibold text-foreground">Say what you need.</span> <span className="text-muted-foreground">A specific title gets better answers than a broad one.</span></li>
                <li><span className="font-semibold text-foreground">Tag it.</span> <span className="text-muted-foreground">Tags are how people in the right space find your post.</span></li>
                <li><span className="font-semibold text-foreground">Search first.</span> <span className="text-muted-foreground">Your question may already have an answer in the space.</span></li>
                <li><span className="font-semibold text-foreground">Show your work.</span> <span className="text-muted-foreground">Links, code and files make a post easier to help with.</span></li>
              </ul>
            </div>

            {/* Card 2: Popular Tags in Selected Space */}
            {selectedSpace.popularTags.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3.5">
              <h3 className="font-heading text-sm font-bold text-foreground">
                Popular tags in {selectedSpace.name}
              </h3>

              <div className="flex flex-wrap gap-2">
                {selectedSpace.popularTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-brand/15 border border-border/40 hover:border-brand/30 text-xs tabular-nums text-muted-foreground hover:text-brand transition-colors"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Card 3: Posting as */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <span className="tabular-nums text-[10px] font-bold text-muted-foreground">
                Posting as
              </span>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border border-brand/30 overflow-hidden shrink-0 bg-muted">
                  {profile?.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-heading text-sm font-bold text-foreground">
                      {(profile?.displayName || profile?.username || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-heading text-sm font-bold text-foreground">
                    <span>{profile?.username || "you"}</span>
                    {profile?.isVerifiedPro && (
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground fill-brand/20" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums ">
                    {(profile?.reputation ?? 0).toLocaleString()} reputation
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>
    </AppLayout>
  );
};


export default CreatePost;
