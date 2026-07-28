import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Feather, 
  X, 
  BarChart2, 
  HelpCircle, 
  BookOpen, 
  ChevronDown, 
  ImageIcon, 
  Video, 
  Code2, 
  FileUp, 
  Sparkles, 
  Target, 
  Hash, 
  Search, 
  Paperclip, 
  CheckCircle2, 
  Zap, 
  Plus, 
  Send, 
  Globe, 
  Users, 
  ShieldAlert, 
  Rocket, 
  TrendingUp, 
  Cpu, 
  Layout 
} from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";
import { createPost } from "@/lib/posts";
import { fetchAllCommunities, getCommunityStyle } from "@/lib/communities";
import { ResourceBodyEditor } from "@/components/editor/ResourceBodyEditor";
import { ResourceMarkdownHelp } from "@/components/editor/ResourceMarkdownHelp";

type PostType = "discussion" | "question" | "resource" | "poll";

interface PendingBodyImage {
  alt: string;
  src: string;
}

interface BSpaceOption {
  id: string;
  name: string;
  slug: string;
  icon: React.ElementType;
  color: string;
  popularTags: string[];
}

// Real spaces are loaded from the database inside the component (see
// realSpaces useQuery below) — this used to be a hardcoded fake list
// (frontend-hub, indie-builders, etc.) with slugs that don't exist in the
// real `communities` table, which is what was causing every post submit
// to fail with a foreign key violation (23503).

const CreatePost = () => {
  const navigate = useNavigate();
  const bodyImageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Real spaces (communities) from the database — replaces the old
  // hardcoded fake list. slug: "" is a loading placeholder that the
  // submit button below refuses to post with, so there's no race
  // condition where a post could go out before real data has loaded.
  const LOADING_SPACE: BSpaceOption = {
    id: "loading",
    name: "Loading spaces…",
    slug: "",
    icon: Globe,
    color: "text-muted-foreground bg-muted",
    popularTags: [],
  };

  const { data: realSpaces = [] } = useQuery({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const B_SPACES: BSpaceOption[] = useMemo(() => {
    return realSpaces.map((c) => {
      const style = getCommunityStyle(c.category);
      return {
        id: c.slug,
        name: c.name,
        slug: c.slug,
        icon: style.icon,
        color: style.iconBg,
        popularTags: c.topics?.length ? c.topics : ["general"],
      };
    });
  }, [realSpaces]);

  // Form State
  const [postType, setPostType] = useState<PostType>("discussion");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["Option 1", "Option 2"]);
  const [selectedSpace, setSelectedSpace] = useState<BSpaceOption>(LOADING_SPACE);

  useEffect(() => {
    if (B_SPACES.length > 0 && selectedSpace.slug === "") {
      setSelectedSpace(B_SPACES[0]);
    }
  }, [B_SPACES]);

  const [tags, setTags] = useState<string[]>(["react", "frontend", "performance"]);
  const [tagInput, setTagInput] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [bodyImages, setBodyImages] = useState<PendingBodyImage[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  
  // Post Settings State
  const [visibility, setVisibility] = useState<"public" | "members" | "admins">("public");
  const [allowComments, setAllowComments] = useState(true);
  const [pinToSpace, setPinToSpace] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user,
  });

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

  // Media Handlers
  const handleBodyImageFiles = (files: FileList | null) => {
    if (!files?.length) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") return;

        setBodyImages((current) => [
          ...current,
          {
            alt: file.name,
            src: dataUrl,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
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

  const handleSaveDraft = () => {
    const draft = { title, body, postType, selectedSpaceSlug: selectedSpace.slug, tags };
    localStorage.setItem("borynx_post_draft", JSON.stringify(draft));
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

    if (!user?.uid) {
      toast({ title: "Not signed in", description: "Please sign in before posting.", variant: "destructive" });
      return;
    }

    if (!selectedSpace.slug) {
      toast({ title: "Spaces still loading", description: "Give it a second and try again.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const postPayload = {
        title: trimmedTitle,
        body: finalBody,
        type: postType === "poll" ? "discussion" : postType,
        tags,
        communitySlug: selectedSpace.slug,
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
        isPinned: pinToSpace,
        allowComments,
        visibility,
      };

      await createPost({
        ...postPayload,
        ...(postType === "resource" && externalLink.trim()
          ? { externalLink: externalLink.trim() }
          : {}),
      });

      // Clear draft
      localStorage.removeItem("borynx_post_draft");

      toast({ title: "Post published!", description: `Your post is live in ${selectedSpace.name}.` });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate(`/b/${selectedSpace.slug}`);
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
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
              <Feather className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground tracking-tight">
                Create New Post
              </h1>
              <p className="font-body text-xs sm:text-sm text-muted-foreground mt-0.5">
                Share knowledge. Start a conversation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleLoadDraft}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5"
            >
              <span>Drafts (1)</span>
            </button>
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
                    <div className="text-[11px] font-mono text-muted-foreground text-right pt-2">
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
                  <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2.5 animate-in fade-in duration-300">
                    <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
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
                        className="text-xs font-medium text-purple-400 hover:underline flex items-center gap-1 pt-1"
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
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm"
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
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm"
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
                        ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-sm"
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

              <div className="pt-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full rounded-2xl border border-border/50 bg-card p-3.5 flex items-center justify-between hover:border-purple-500/40 transition-colors shadow-sm group">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl ${selectedSpace.color} flex items-center justify-center font-bold shrink-0`}>
                          <SpaceIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="text-left">
                          <p className="font-heading text-sm font-bold text-foreground">
                            {selectedSpace.name}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            b/{selectedSpace.slug}
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
                            isSelected ? "bg-purple-500/15 text-purple-300 font-semibold" : ""
                          }`}
                        >
                          <div className={`h-8 w-8 rounded-lg ${sp.color} flex items-center justify-center font-bold shrink-0`}>
                            <IconComp className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{sp.name}</p>
                            <p className="text-[10px] font-mono text-muted-foreground">b/{sp.slug}</p>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300"
                    >
                      #{t}
                      <button
                        onClick={() => removeTag(t)}
                        className="text-purple-300/70 hover:text-purple-200 transition-colors"
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
                          className="p-1 rounded bg-purple-600 text-white hover:bg-purple-500 text-xs font-bold"
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
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-purple-500/10 hover:border-purple-500/30 text-center space-y-2 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
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
                        ? "bg-purple-500/15 border-purple-500/40" 
                        : "border-border/50 bg-muted/20 hover:bg-purple-500/10 hover:border-purple-500/30"
                    }`}
                  >
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Video className="h-5 w-5" />
                    </div>
                    <span className="block text-xs font-bold text-foreground">Video</span>
                  </button>

                  {/* Code Tile */}
                  <button
                    type="button"
                    onClick={handleInsertCodeSnippet}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-purple-500/10 hover:border-purple-500/30 text-center space-y-2 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Code2 className="h-5 w-5" />
                    </div>
                    <span className="block text-xs font-bold text-foreground">Code</span>
                  </button>

                  {/* File Tile */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-purple-500/10 hover:border-purple-500/30 text-center space-y-2 transition-all group"
                  >
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
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
                        <span className="font-mono truncate">{fn}</span>
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
                        ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="h-4.5 w-4.5 text-purple-400 shrink-0" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">Public</p>
                        <p className="text-[11px] text-muted-foreground">Anyone in the B-Space can view and interact</p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      visibility === "public" ? "border-purple-400 bg-purple-500" : "border-border"
                    }`}>
                      {visibility === "public" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </button>

                  {/* Option 2: Space Members Only */}
                  <button
                    type="button"
                    onClick={() => setVisibility("members")}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      visibility === "members"
                        ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="h-4.5 w-4.5 text-purple-400 shrink-0" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">Space Members Only</p>
                        <p className="text-[11px] text-muted-foreground">Only members of {selectedSpace.name} can see this</p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      visibility === "members" ? "border-purple-400 bg-purple-500" : "border-border"
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
                        ? "border-purple-500/50 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                        : "border-border/50 bg-muted/20 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-4.5 w-4.5 text-purple-400 shrink-0" />
                      <div>
                        <p className="font-heading text-xs font-bold text-foreground">Admins & Moderators Only</p>
                        <p className="text-[11px] text-muted-foreground">Only admins and moderators can see this</p>
                      </div>
                    </div>
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      visibility === "admins" ? "border-purple-400 bg-purple-500" : "border-border"
                    }`}>
                      {visibility === "admins" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </div>
                  </button>

                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2 border-t border-border/40">
                  
                  <div className="flex items-center justify-between p-2 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="font-heading text-xs font-bold text-foreground">Allow comments</p>
                      <p className="text-[11px] text-muted-foreground">Others can reply to your post</p>
                    </div>
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl">
                    <div className="space-y-0.5">
                      <p className="font-heading text-xs font-bold text-foreground">Pin to B-Space</p>
                      <p className="text-[11px] text-muted-foreground">Make this post visible at the top</p>
                    </div>
                    <Switch checked={pinToSpace} onCheckedChange={setPinToSpace} />
                  </div>

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
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-heading text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/25 transition-all disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Publishing..." : `Post to ${selectedSpace.name}`}</span>
              </button>
            </div>

          </div>

          {/* Right Sidebar Column */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Card 1: Posting Tips */}
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 font-heading font-bold text-sm text-foreground">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>Posting Tips</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Be clear and specific</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Provide context to get better answers.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Use relevant tags</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Helps the right people discover your post.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                    <Search className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Search before posting</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Your question might have already been answered!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                    <Paperclip className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-bold text-foreground">Share resources</p>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">
                      Add links, code, or files to provide more value.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2: Popular Tags in Selected Space */}
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3.5 shadow-sm">
              <h3 className="font-heading text-sm font-bold text-foreground">
                Popular Tags in {selectedSpace.name}
              </h3>

              <div className="flex flex-wrap gap-2">
                {selectedSpace.popularTags.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => addTag(t)}
                    className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-purple-500/15 border border-border/40 hover:border-purple-500/30 text-xs font-mono text-muted-foreground hover:text-purple-300 transition-colors"
                  >
                    #{t}
                  </button>
                ))}
              </div>
            </div>

            {/* Card 3: Posting as */}
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 shadow-sm">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Posting as
              </span>

              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full border border-purple-500/30 overflow-hidden shrink-0 bg-slate-800">
                  <img
                    src={profile?.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"}
                    alt={profile?.username || "User"}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-heading text-sm font-bold text-foreground">
                    <span>{profile?.username || "you"}</span>
                    <CheckCircle2 className="h-4 w-4 text-purple-400 fill-purple-400/20" />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Level 14 • Top 6%
                  </p>
                </div>
              </div>

              {/* XP Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-purple-400 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 fill-purple-400" />
                    4,820 XP
                  </span>
                  <span className="text-[11px] text-muted-foreground">to next level</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full w-[68%]" />
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
