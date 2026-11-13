import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, UserProfile, checkUsernameAvailability } from "@/lib/users";
import { saveOwnProfile, isProfileError } from "@/lib/profile-client";
import { claimUsernameOnServer } from "@/lib/profile-provisioning";
import { supabase } from "@/lib/supabase";
import { requestPasswordReset, resendConfirmationEmail } from "@/lib/auth";
import { getErrorMessage } from "@/lib/utils";
import { QueryErrorState } from "@/components/QueryErrorState";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-6">
    <div className="space-y-2 mb-5">
      <h2 className="font-display text-lg font-bold text-foreground tracking-tight">{title}</h2>
      {description && (
        <p className="font-body text-sm text-muted-foreground">{description}</p>
      )}
    </div>
    <div className="space-y-5">{children}</div>
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
      // Phase 2C: read the viewer's own row from Neon. `getUserProfile` still works for
      // public reads, but this page edits the profile, so it should load exactly the row
      // it is about to write.
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
        // Phase 2B.3: the claim is atomic and server-side. The uid is no longer
        // passed from the browser — the server uses the verified session, so this
        // call cannot be pointed at another account. A binding failure means the
        // handle was taken between the availability check and now.
        const claim = await claimUsernameOnServer(username);
        if (claim.status !== "claimed" && claim.status !== "same") {
          toast({
            title: "Error",
            description:
              claim.status === "taken"
                ? "That username was just taken. Please choose another."
                : "Could not save that username. Please try again.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
        setOriginalUsername(claim.username);
        setUsername(claim.username);
      }

      // Phase 2C — settings save consistency.
      //
      // This used to be two writes in one user action: the username claim went to Neon
      // (since 2B.3) while displayName/bio/website/status went to Supabase. A failure in
      // the second left the form half-saved with the handle already changed and no way
      // to tell from the UI.
      //
      // Both halves now target Neon, and the fields go in **one** PATCH. The claim is
      // still a separate atomic operation — it has to be, because it is a race against
      // other users, not a field update — but it happens first and its result is
      // committed before the fields are sent, so a failed PATCH leaves a coherent state
      // (new handle, old fields) that the user can simply save again.
      const result = await saveOwnProfile({
        displayName,
        bio,
        website,
        status: available ? "Available" : "Busy",
      });

      if (isProfileError(result)) {
        if (result.error === "not_provisioned") {
          throw new Error("Your profile isn't ready yet. Please try again in a moment.");
        }
        if (result.error === "unauthenticated") {
          throw new Error("Your session expired. Please sign in again.");
        }
        throw new Error("Could not save your profile. Please try again.");
      }

      setProfile((previous) => (previous ? { ...previous, ...result.data } : result.data));

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
              <Input id="email" type="email" defaultValue={user?.email || ""} disabled className="bg-muted/50" />
              {user?.email_confirmed_at ? (
                <p className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Email verified
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="flex items-center gap-2 text-[11px] font-mono text-destructive">
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
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-brand hover:underline disabled:opacity-50"
                  >
                    {resendingConfirm ? "Sending..." : "Resend confirmation email"}
                  </button>
                </div>
              )}
              <p className="text-[11px] font-mono text-muted-foreground">
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
                  className="rounded-radius-md border border-border bg-background px-4 py-2 font-body text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
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
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-medium select-none">@</span>
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
              {usernameStatus === "available" && <p className="text-[10px] font-mono text-success">Username is available!</p>}
              {usernameStatus === "taken" && <p className="text-[10px] font-mono text-destructive">Username is already taken.</p>}
              {usernameStatus === "invalid" && <p className="text-[10px] font-mono text-destructive">Must be 3-15 lowercase letters, numbers, or underscores.</p>}
              {usernameStatus === "unavailable" && <p role="alert" className="text-[10px] font-mono text-destructive">Couldn't check username availability. Try again when connected.</p>}
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
                <p className="font-body text-xs font-mono text-muted-foreground">Your work status appears on your public profile after you save.</p>
              </div>
              <Switch checked={available} onCheckedChange={setAvailable} aria-label="Open to work" />
            </div>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isSaving || (username !== originalUsername && usernameStatus !== "available")}
              className="rounded-radius-md bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
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
