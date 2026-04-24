import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, UserProfile, checkUsernameAvailability, claimUsername } from "@/lib/users";
import { set, ref } from "firebase/database";
import { database } from "@/lib/firebase";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-6">
    <h2 className="font-heading text-lg font-semibold text-foreground mb-1">{title}</h2>
    {description && (
      <p className="font-body text-sm text-muted-foreground mb-4">{description}</p>
    )}
    <div className="space-y-4">{children}</div>
  </div>
);

const Settings = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  
  const [available, setAvailable] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [mentions, setMentions] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(p => {
        if (p) {
          setProfile(p);
          setDisplayName(p.displayName || p.username || "");
          setUsername(p.username || "");
          setOriginalUsername(p.username || "");
          setBio(p.bio || "");
          setWebsite(p.website || "");
          setAvailable(p.status === "Available");
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (!username || username === originalUsername) {
      setUsernameStatus("idle");
      return;
    }

    const isValidFormat = /^[a-zA-Z0-9_]{3,15}$/.test(username);
    if (!isValidFormat) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    const timeoutId = setTimeout(async () => {
      const isAvailable = await checkUsernameAvailability(username);
      setUsernameStatus(isAvailable ? "available" : "taken");
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, originalUsername]);

  const handleSave = async () => {
    if (!user?.uid) return;
    
    if (username !== originalUsername && usernameStatus !== "available") {
      toast({ title: "Error", description: "Please choose a valid and available username.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      if (username !== originalUsername) {
        await claimUsername(user.uid, username, originalUsername);
        setOriginalUsername(username);
      }

      const updates: Partial<UserProfile> = {
        displayName,
        bio,
        website,
        status: available ? "Available" : "Busy"
      };

      await set(ref(database, `users/${user.uid}/displayName`), displayName);
      await set(ref(database, `users/${user.uid}/bio`), bio);
      await set(ref(database, `users/${user.uid}/website`), website);
      await set(ref(database, `users/${user.uid}/status`), updates.status);

      toast({ title: "Saved", description: "Your settings have been updated." });
    } catch (error: any) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your account, profile, and notification preferences."
        />

        <div className="space-y-5">
          <Section title="Account" description="Update your login email and password.">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user?.email || ""} disabled />
              <p className="text-xs text-muted-foreground">Email changing is disabled in demo mode.</p>
            </div>
          </Section>

          <Section title="Profile" description="How you appear to other freelancers.">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            
            <div className="grid gap-2 relative">
              <Label htmlFor="username">Username (@handle)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">@</span>
                <Input 
                  id="username" 
                  className="pl-7" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {usernameStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {usernameStatus === "available" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {usernameStatus === "taken" && <XCircle className="h-4 w-4 text-red-500" />}
                  {usernameStatus === "invalid" && <XCircle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
              {usernameStatus === "available" && <p className="text-xs text-green-500">Username is available!</p>}
              {usernameStatus === "taken" && <p className="text-xs text-red-500">Username is already taken.</p>}
              {usernameStatus === "invalid" && <p className="text-xs text-red-500">Must be 3-15 lowercase letters, numbers, or underscores.</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio">Portfolio URL</Label>
              <Input id="portfolio" placeholder="https://yourname.com" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>
          </Section>

          <Section title="Availability" description="Show clients whether you're open to new projects.">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-foreground">Open to work</p>
                <p className="font-body text-xs text-muted-foreground">A green badge will appear on your profile.</p>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} />
            </div>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || (username !== originalUsername && usernameStatus !== "available")}
              className="rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
