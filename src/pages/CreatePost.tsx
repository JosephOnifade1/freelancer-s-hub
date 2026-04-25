import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, MessageCircle, HelpCircle, BookOpen } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";
import { createPost } from "@/lib/posts";

type PostType = "discussion" | "question" | "resource";

const types: { id: PostType; label: string; icon: React.ElementType; description: string }[] = [
  { id: "discussion", label: "Discussion", icon: MessageCircle, description: "Share an idea or experience." },
  { id: "question", label: "Question", icon: HelpCircle, description: "Ask the community for help." },
  { id: "resource", label: "Resource", icon: BookOpen, description: "Share something useful." },
];

const CreatePost = () => {
  const navigate = useNavigate();
  const [type, setType] = useState<PostType>("discussion");
  const [title, setTitle] = useState("");
  const [externalLink, setExternalLink] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user,
  });

  const getPlaceholders = () => {
    switch (type) {
      case "resource":
        return {
          title: "A clear, specific title...",
          body: "Describe the resource. What's the 'High-Signal' takeaway?"
        };
      case "question":
        return {
          title: "Ask a specific question...",
          body: "What have you tried so far? Give the community context."
        };
      default:
        return {
          title: "A clear, specific title...",
          body: "Share the details. Markdown supported soon."
        };
    }
  };

  const placeholders = getPlaceholders();

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!t || tags.includes(t) || tags.length >= 3) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t));

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Missing fields", description: "Title and body are required.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await createPost({
        title,
        body,
        type,
        tags,
        externalLink: type === "resource" ? externalLink : undefined,
        author: { 
          uid: user?.uid,
          name: profile?.username || "Unknown", 
          reputation: profile?.reputation || 0,
          avatar: profile?.avatarUrl || undefined,
          isVerifiedPro: profile?.isVerifiedPro || false,
        },
        score: 0,
        commentCount: 0,
        timeAgo: "just now"
      });
      toast({ title: "Post created", description: "Your post has been published." });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate("/");
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create post.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader title="New Post" subtitle="Share knowledge, ask a question, or drop a resource." />

        <div className="space-y-5">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-3">
            {types.map((t) => {
              const isActive = type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? t.id === 'resource' 
                        ? "border-[#D1FF4A] bg-[#D1FF4A]/5 shadow-[0_0_15px_rgba(209,255,74,0.1)]"
                        : "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <t.icon className={`h-5 w-5 mb-2 ${isActive ? t.id === 'resource' ? "text-[#D1FF4A]" : "text-primary" : "text-muted-foreground"}`} />
                  <p className="font-heading text-sm font-semibold text-foreground">{t.label}</p>
                  <p className="font-body text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                </button>
              );
            })}
          </div>

          <div className={`rounded-xl border bg-card p-6 space-y-4 transition-all duration-300 ${
            type === 'resource' 
              ? 'border-[#D1FF4A]/40 ring-1 ring-[#D1FF4A]/10 shadow-[0_4px_20px_rgba(209,255,74,0.05)]' 
              : 'border-border shadow-sm'
          }`}>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholders.title}
                maxLength={140}
                className="focus-visible:ring-offset-0 focus-visible:ring-primary/20"
              />
              <p className="font-body text-[11px] text-muted-foreground text-right">{title.length}/140</p>
            </div>

            {type === "resource" && (
              <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="externalLink">External Link (Optional)</Label>
                <Input
                  id="externalLink"
                  value={externalLink}
                  onChange={(e) => setExternalLink(e.target.value)}
                  placeholder="https://example.com/useful-resource"
                  className="focus-visible:ring-[#D1FF4A]/30 border-border/60"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder={placeholders.body}
                className={`focus-visible:ring-offset-0 ${
                  type === 'resource' ? 'focus-visible:ring-[#D1FF4A]/30' : 'focus-visible:ring-primary/20'
                }`}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tags">Tags (max 3)</Label>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="pricing, design, dev..."
                  disabled={tags.length >= 3}
                />
                <button
                  onClick={addTag}
                  disabled={tags.length >= 3 || !tagInput.trim()}
                  className="rounded-lg bg-secondary px-4 font-body text-sm font-medium text-foreground hover:bg-secondary/70 disabled:opacity-40"
                >
                  Add
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 font-body text-[11px] font-medium text-primary"
                    >
                      #{t}
                      <button onClick={() => removeTag(t)} className="hover:text-primary-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg border border-border bg-card px-5 py-2.5 font-body text-sm font-medium text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={isSubmitting}
              className="rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground hover:opacity-90 glow-primary disabled:opacity-50"
            >
              {isSubmitting ? "Publishing..." : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CreatePost;
