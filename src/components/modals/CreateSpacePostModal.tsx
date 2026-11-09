import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PenTool, HelpCircle, FileText, BarChart2, Hash, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth-context";
import { createPost } from "@/lib/posts";
import { getErrorMessage } from "@/lib/utils";

export interface CreatedSpacePost {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  type: "discussion" | "question" | "resource";
  title: string;
  body: string;
  tags: string[];
}

interface CreateSpacePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceSlug: string;
  spaceName: string;
  initialType?: "post" | "question" | "resource" | "poll";
  onPostCreated?: (newPost: CreatedSpacePost) => void;
}

export const CreateSpacePostModal: React.FC<CreateSpacePostModalProps> = ({
  open,
  onOpenChange,
  spaceSlug,
  spaceName,
  initialType = "post",
  onPostCreated,
}) => {
  const { user } = useAuth();
  const [type, setType] = useState<"post" | "question" | "resource" | "poll">(initialType);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      setType(initialType);
    }
  }, [open, initialType]);

  const handleAddPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handlePollOptionChange = (idx: number, val: string) => {
    const next = [...pollOptions];
    next[idx] = val;
    setPollOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    if (!content.trim() && type !== "poll") {
      toast.error("Please add content to your post");
      return;
    }
    if (!user?.uid) {
      toast.error("Please sign in before posting");
      return;
    }

    setSubmitting(true);

    const tags = tagsInput
      .split(" ")
      .map((t) => t.replace("#", "").trim())
      .filter(Boolean);

    // "home" is the generic home-feed composer, not a real community —
    // post it as a general (community-less) post instead of faking a slug.
    const communitySlug = spaceSlug && spaceSlug !== "home" ? spaceSlug : undefined;

    try {
      const newId = await createPost({
        title: title.trim(),
        body: content.trim(),
        type: type === "post" || type === "poll" ? "discussion" : type,
        tags: tags.length ? tags : [spaceSlug],
        communitySlug,
        author: {
          uid: user.uid,
          name: user.displayName || "You",
          reputation: 0,
        },
        score: 0,
        commentCount: 0,
        timeAgo: "Just now",
      });

      toast.success("Post created successfully!");
      if (onPostCreated) {
        onPostCreated({
          id: newId,
          authorName: user.displayName || "You",
          authorAvatar: user.photoURL,
          type: type === "post" || type === "poll" ? "discussion" : type,
          title: title.trim(),
          body: content.trim(),
          tags: tags.length ? tags : [spaceSlug],
        });
      }
      onOpenChange(false);
      setTitle("");
      setContent("");
      setTagsInput("");
      setPollOptions(["", ""]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to publish post"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl bg-[#0e0f14] border-border/60 text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle className="font-heading text-lg font-bold">
              Create in <span className="text-primary">b/{spaceSlug}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Type Selector Tabs */}
        <div className="grid grid-cols-4 gap-2 bg-secondary/50 p-1.5 rounded-xl border border-border/40">
          <button
            type="button"
            onClick={() => setType("post")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              type === "post"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            }`}
          >
            <PenTool className="h-3.5 w-3.5" />
            Post
          </button>
          <button
            type="button"
            onClick={() => setType("question")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              type === "question"
                ? "bg-brand text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            }`}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Question
          </button>
          <button
            type="button"
            onClick={() => setType("resource")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              type === "resource"
                ? "bg-brand text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Resource
          </button>
          <button
            type="button"
            onClick={() => setType("poll")}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              type === "poll"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/40"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Poll
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "question"
                  ? "What would you like to ask the space?"
                  : type === "resource"
                  ? "e.g. A complete guide to React sticky navigation"
                  : type === "poll"
                  ? "Ask a multiple choice question..."
                  : "Title of your post..."
              }
              className="mt-1 bg-card/60 border-border/60 text-sm focus-visible:ring-primary"
            />
          </div>

          {type !== "poll" && (
            <div>
              <Label className="text-xs text-muted-foreground">Content / Description</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share your thoughts, code snippets, or explanation..."
                rows={4}
                className="mt-1 bg-card/60 border-border/60 text-sm focus-visible:ring-primary resize-none"
              />
            </div>
          )}

          {type === "poll" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Poll Options</Label>
              {pollOptions.map((option, idx) => (
                <Input
                  key={idx}
                  value={option}
                  onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="bg-card/60 border-border/60 text-sm"
                />
              ))}
              {pollOptions.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddPollOption}
                  className="w-full text-xs border-dashed text-muted-foreground hover:text-foreground"
                >
                  + Add option
                </Button>
              )}
            </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground">Hashtags (space separated)</Label>
            <div className="relative mt-1">
              <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="react frontend tutorial"
                className="pl-9 bg-card/60 border-border/60 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary text-primary-foreground font-semibold text-xs px-5 hover:opacity-90"
            >
              {submitting ? "Publishing..." : "Publish to Space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
