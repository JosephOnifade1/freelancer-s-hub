import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/auth-context";
import { saveOwnProfile, isProfileError } from "@/lib/profile-client";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/QueryErrorState";
import { getUserProfile } from "@/lib/users";
import { toast } from "sonner";
import { Loader2, Sparkles, X } from "lucide-react";

const DEFAULT_BIOS = ["", "New to Borynx!", "New freelancer on Borynx!", "New freelancer on Borynx"];

export default function Onboarding() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: existingProfile, isLoading: loading, isError: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => getUserProfile(user!.uid),
    enabled: !!user?.uid,
  });
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    const p = existingProfile;
    if (!p) return;
    setDisplayName(p.displayName || "");
    setBio(DEFAULT_BIOS.includes((p.bio || "").trim()) ? "" : p.bio || "");
    setLocation(p.location === "Earth" ? "" : p.location || "");
    setWebsite(p.website || "");
    setSkillsInput((p.skills || []).join(", "));
    setAvailable(p.status === "Available");
  }, [existingProfile]);

  const skills = skillsInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);

  const handleSave = async () => {
    if (!user?.uid) return;
    if (!displayName.trim()) {
      toast.error("Please add the name clients should see.");
      return;
    }
    setSaving(true);
    try {
      // Phase 2C: the profile lives in Neon. `initial` is no longer sent — it is a
      // single capital derived from the display name, and the old code duplicated that
      // derivation into the database. The server keeps the column updated from
      // `displayName` so the two cannot disagree.
      const result = await saveOwnProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        location: location.trim(),
        website: website.trim(),
        skills,
        status: available ? "Available" : "Busy",
      });
      if (isProfileError(result)) throw new Error("Could not save your profile.");
      queryClient.invalidateQueries({ queryKey: ["profile", user.uid] });
      toast.success("Profile saved. Welcome to Borynx!");
      router.replace("/");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (profileError || !existingProfile) return <AppLayout><div className="mx-auto max-w-xl px-4 py-16"><QueryErrorState title="Couldn't load your profile setup" onRetry={() => refetchProfile()} /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Set up your freelancer profile
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Clients and other freelancers can read this public profile. Add a bio and skills to help
              them understand your work. Setup is optional; you can update it later in Settings.
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              placeholder="Jane Freelancer"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={3}
              placeholder="What do you build, who do you help, and what results do you get? e.g. 'React dashboards for fintech startups — 6 years, 40+ launches.'"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="skills">Skills (comma-separated, up to 10)</Label>
            <Input
              id="skills"
              placeholder="React, TypeScript, UI Design"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
            />
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="Lagos, Nigeria"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="website">Portfolio URL</Label>
              <Input
                id="website"
                placeholder="https://yourname.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Open to work</p>
              <p className="text-xs text-muted-foreground">
                Show an availability badge on your profile so clients know you're taking projects.
              </p>
            </div>
            <Switch checked={available} onCheckedChange={setAvailable} aria-label="Open to work" />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.replace("/")} disabled={saving}>
            <X className="mr-1 h-4 w-4" /> Skip for now
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save and explore Borynx
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
