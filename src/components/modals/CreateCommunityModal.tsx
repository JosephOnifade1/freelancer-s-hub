import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Code, Megaphone, Palette, Briefcase, Network, Plus, Check } from "lucide-react";
import { createCommunity } from "@/lib/communities";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const NICHE_TOPICS = [
  { id: 'logistics', label: 'Logistics', icon: Truck },
  { id: 'development', label: 'Development', icon: Code },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'workflow', label: 'Workflow', icon: Network },
];

export function CreateCommunityModal({ children }: { children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric and underscores, lowercase
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setSlug(val);
  };

  const toggleTopic = (id: string) => {
    if (topics.includes(id)) {
      setTopics(topics.filter((t) => t !== id));
    } else {
      if (topics.length >= 3) {
        toast.error("You can select up to 3 topics only.");
        return;
      }
      setTopics([...topics, id]);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setSlug("");
    setDescription("");
    setTopics([]);
    setError("");
    setLoading(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setTimeout(resetForm, 300); // reset after closing animation
    }
  };

  const handleNext = () => {
    if (!name.trim()) return setError("Name is required.");
    if (!slug.trim()) return setError("Slug is required.");
    if (slug.length < 3) return setError("Slug must be at least 3 characters.");
    setError("");
    setStep(2);
  };

  const handleSubmit = async () => {
    if (topics.length === 0) {
      return setError("Please select at least 1 topic.");
    }
    if (!user) return toast.error("You must be logged in.");

    try {
      setLoading(true);
      setError("");
      await createCommunity(slug, {
        name: name.trim(),
        description: description.trim(),
        topics,
        ownerId: user.uid,
      });

      toast.success(`Welcome to ${name}!`);
      setOpen(false);
      navigate(`/b/${slug}`);
    } catch (err: any) {
      setError(err.message || "Failed to create community.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" className="w-full flex gap-2">
            <Plus className="h-4 w-4" /> Start a B-Space
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === 1 ? "Start a B-Space" : "What will your B-Space be about?"}
          </DialogTitle>
        </DialogHeader>

        {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

        <div className="py-4">
          {step === 1 && (
            <div className="space-y-4 font-body">
              <div className="space-y-2">
                <Label htmlFor="name">B-Space Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Frontend Masters"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex items-center">
                  <span className="text-muted-foreground bg-muted border border-r-0 border-input px-3 py-2 rounded-l-md text-sm">
                    /b/
                  </span>
                  <Input
                    id="slug"
                    className="rounded-l-none"
                    placeholder="frontend_masters"
                    value={slug}
                    onChange={handleSlugChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Only letters, numbers, and underscores.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description (Optional)</Label>
                <Textarea
                  id="desc"
                  placeholder="Tell people what this B-Space is about."
                  className="resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Select up to 3 topics to help people find your B-Space.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {NICHE_TOPICS.map((topic) => {
                  const isSelected = topics.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      onClick={() => toggleTopic(topic.id)}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-xl border transition-all duration-200 text-sm font-medium",
                        isSelected
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"
                      )}
                    >
                      <topic.icon className="h-4 w-4 shrink-0" />
                      {topic.label}
                      {isSelected && <Check className="h-3 w-3 ml-auto opacity-70" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-border">
          {step === 1 ? (
            <Button className="w-full font-semibold" onClick={handleNext}>
              Continue
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
              <Button className="flex-1 font-semibold" onClick={handleSubmit} disabled={loading}>
                {loading ? "Creating..." : "Create B-Space"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
