import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile } from "@/lib/users";
import { createLead, LeadType } from "@/lib/leads";
import { X, DollarSign, MapPin, Briefcase } from "lucide-react";

const CreateLead = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [location, setLocation] = useState("Remote");
  const [type, setType] = useState<LeadType>("Bounty");
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [posted, setPosted] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState(false);
  const draftKey = user?.uid ? `borynx_lead_draft:${user.uid}` : "";

  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.title === "string") setTitle(draft.title);
        if (typeof draft.description === "string") setDescription(draft.description);
        if (typeof draft.budget === "string") setBudget(draft.budget);
        if (typeof draft.location === "string") setLocation(draft.location);
        if (["Bounty", "Project", "Retainer", "Full-time"].includes(draft.type)) setType(draft.type);
        if (Array.isArray(draft.skills)) setSkills(draft.skills.filter((v: unknown) => typeof v === "string"));
      }
    } catch { /* invalid old draft: keep form usable */ }
    setDraftReady(true);
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftReady || posted) return;
    try {
      if (title.trim() || description.trim() || budget.trim() || skills.length) {
        localStorage.setItem(draftKey, JSON.stringify({ title, description, budget, location, type, skills }));
      } else {
        localStorage.removeItem(draftKey);
      }
      setDraftSaveError(false);
    } catch { setDraftSaveError(true); }
  }, [draftKey, draftReady, posted, title, description, budget, location, type, skills]);
  const hasUnsavedWork = !posted && (title.trim() || description.trim() || budget.trim() || skills.length > 0);

  useEffect(() => {
    if (!hasUnsavedWork) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedWork]);

  const addSkill = () => {
    const s = skillInput.trim().toLowerCase();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      setSkillInput("");
    }
  };

  const removeSkill = (s: string) => {
    setSkills(skills.filter(skill => skill !== s));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !budget.trim() || !user) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const id = await createLead({
        title,
        description,
        budget,
        currency: "USD",
        location,
        type,
        skills,
        postedBy: {
          uid: user.uid,
          name: profile?.displayName || profile?.username || "Anonymous",
          avatar: profile?.avatarUrl,
          isVerified: profile?.isVerifiedPro
        }
      });
      setPosted(true);
      if (draftKey) {
        try { localStorage.removeItem(draftKey); } catch { /* posted successfully even if storage is unavailable */ }
      }
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Opportunity posted successfully!");
      router.push(`/l/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post opportunity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <PageHeader
          title="Post an Opportunity"
          subtitle="Publish a real project to Borynx. Members can apply with a proposal; no bidding credits."
        />

        {draftSaveError && <p role="alert" className="mt-4 rounded-radius-md border border-destructive p-3 text-sm text-destructive">Couldn't save your draft locally. Copy your text before leaving this page.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Unpublished details are saved on this device for your account as you write. Nothing appears in the marketplace until you publish.</p>
        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          <div className="space-y-2">
            <Label htmlFor="title">Opportunity Title</Label>
            <Input
              id="title"
              placeholder="e.g. React developer for a three-month project"
              maxLength={180}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as LeadType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bounty">Bounty (Fixed Price)</SelectItem>
                  <SelectItem value="Project">Project (Milestone Based)</SelectItem>
                  <SelectItem value="Retainer">Retainer (Monthly)</SelectItem>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget Range</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="budget"
                  className="pl-9"
                  placeholder="e.g. $500–$1,000"
                  maxLength={80}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="location"
                className="pl-9"
                placeholder="e.g. Remote, NYC, Hybrid"
                maxLength={120}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Detailed Scope</Label>
            <Textarea
              id="description"
              placeholder="Describe the project goals, requirements, and deliverables..."
              maxLength={10000}
              className="min-h-[150px] resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="space-y-3">
            <Label>Required Skills</Label>
            <div className="flex gap-2">
              <Input
                placeholder="React, TypeScript, UI Design..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              />
              <Button type="button" onClick={addSkill} variant="secondary">Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <span key={skill} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-radius-md bg-muted text-foreground text-xs font-medium">
                  {skill}
                  <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`} className="flex h-7 w-7 items-center justify-center hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-border flex items-center justify-end gap-3">
             <Button type="button" variant="ghost" onClick={() => {
               if (!hasUnsavedWork || window.confirm("Discard this opportunity? Your changes have not been saved.")) router.push("/l");
             }}>Cancel</Button>
             <Button type="submit" disabled={isSubmitting} className="px-8">
               {isSubmitting ? "Posting..." : "Publish Opportunity"}
             </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default CreateLead;
