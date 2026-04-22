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
        author: { 
          uid: user?.uid,
          name: profile?.username || "Unknown", 
          reputation: profile?.reputation || 0 
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
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <t.icon className={`h-5 w-5 mb-2 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="font-heading text-sm font-semibold text-foreground">{t.label}</p>
                  <p className="font-body text-[11px] text-muted-foreground mt-0.5">{t.description}</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A clear, specific title..."
                maxLength={140}
              />
              <p className="font-body text-[11px] text-muted-foreground text-right">{title.length}/140</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="body">Body</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Share the details. Markdown supported soon."
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
