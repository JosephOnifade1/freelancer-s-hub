import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, UserProfile, checkUsernameAvailability, claimUsername } from "@/lib/users";
import { supabase, isDemoMode } from "@/lib/supabase";
import { requestPasswordReset, resendConfirmationEmail } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");

  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "unavailable">("idle");

  const [sendingReset, setSendingReset] = useState(false);
  const [resendingConfirm, setResendingConfirm] = useState(false);
  const [available, setAvailable] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (user?.uid) {
      setProfileLoading(true);
      setProfileLoadError(false);
      getUserProfile(user.uid).then((p) => {
        if (!active) return;
        if (!p) { setProfileLoadError(true); return; }
        setProfile(p);
        setDisplayName(p.displayName || p.username || "");
        setUsername(p.username || "");
        setOriginalUsername(p.username || "");
        setBio(p.bio || "");
        setWebsite(p.website || "");
        setAvailable(p.status === "Available");
      }).catch(() => { if (active) setProfileLoadError(true); })
        .finally(() => { if (active) setProfileLoading(false); });
    }
    return () => { active = false; };
  }, [user?.uid, retry]);

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
    let active = true;
    const timeoutId = setTimeout(async () => {
      try {
        const isAvailable = await checkUsernameAvailability(username);
        if (active) setUsernameStatus(isAvailable ? "available" : "taken");
      } catch { if (active) setUsernameStatus("unavailable"); }
    }, 500);

    return () => { active = false; clearTimeout(timeoutId); };
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

      const { data, error } = await supabase
        .from("profiles")
        .update({ displayName, bio, website, status: updates.status })
        .eq("uid", user.uid)
        .select("uid");

      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error("Profile not found or not editable.");

      queryClient.invalidateQueries({ queryKey: ["profile", user.uid] });
      toast({ title: "Saved", description: "Your profile has been updated." });
    } catch (error) {
      toast({ title: "Error saving profile", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoadError) return <AppLayout><div className="mx-auto max-w-xl px-4 py-16"><QueryErrorState title="Couldn't load settings" onRetry={() => setRetry((count) => count + 1)} /></div></AppLayout>;

  if (profileLoading || !profile) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <PageHeader
          title="Settings"
          subtitle="Manage your account and public profile."
        />

        <div className="space-y-5">
          <Section title="Account" description="Your login email and password.">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue={user?.email || ""} disabled />
              {user?.email_confirmed_at || isDemoMode ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Email verified
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-1 text-xs text-amber-600">
                    <XCircle className="h-3.5 w-3.5" /> Email not verified yet
                  </p>
                  <button
                    type="button"
                    disabled={resendingConfirm || !user?.email}
                    onClick={async () => {
                      if (!user?.email) return;
                      setResendingConfirm(true);
                      try {
                        await resendConfirmationEmail(user.email);
                        toast({ title: "Confirmation email sent", description: "Check your inbox and click the link to verify." });
                      } catch (error) {
                        toast({ title: "Could not resend", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
                      } finally {
                        setResendingConfirm(false);
                      }
                    }}
                    className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
                  >
                    {resendingConfirm ? "Sending..." : "Resend confirmation email"}
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                To change your password, request a reset link. Email changes are not available here.
              </p>
              <div>
                <button
                  type="button"
                  disabled={sendingReset || !user?.email}
                  onClick={async () => {
                    if (!user?.email) return;
                    setSendingReset(true);
                    try {
                      await requestPasswordReset(user.email);
                      toast({ title: "Reset link sent", description: `If an account exists for ${user.email}, a password reset link is on its way.` });
                    } catch (error) {
                      toast({ title: "Could not send reset link", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
                    } finally {
                      setSendingReset(false);
                    }
                  }}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {sendingReset ? "Sending..." : "Send password reset email"}
                </button>
              </div>
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
                  {usernameStatus === "available" && <CheckCircle2 className="h-4 w-4 text-success" />}
                  {usernameStatus === "taken" && <XCircle className="h-4 w-4 text-destructive" />}
                  {usernameStatus === "invalid" && <XCircle className="h-4 w-4 text-destructive" />}
                </div>
              </div>
              {usernameStatus === "available" && <p className="text-xs text-success">Username is available!</p>}
              {usernameStatus === "taken" && <p className="text-xs text-destructive">Username is already taken.</p>}
              {usernameStatus === "invalid" && <p className="text-xs text-destructive">Must be 3-15 lowercase letters, numbers, or underscores.</p>}
              {usernameStatus === "unavailable" && <p role="alert" className="text-xs text-destructive">Couldn't check username availability. Try again when connected.</p>}
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
                <p className="font-body text-xs text-muted-foreground">Your work status appears on your public profile after you save.</p>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} aria-label="Open to work" />
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
