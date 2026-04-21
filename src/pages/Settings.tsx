import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

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
  const [available, setAvailable] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [mentions, setMentions] = useState(true);

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
              <Input id="email" type="email" defaultValue="marcelo@example.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" />
            </div>
          </Section>

          <Section title="Profile" description="How you appear to other freelancers.">
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" defaultValue="marcelo_dev" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                defaultValue="Fintech dashboards & React specialist. Helping solo devs raise their rates."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="portfolio">Portfolio URL</Label>
              <Input id="portfolio" placeholder="https://yourname.com" />
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

          <Section title="Notifications" description="Choose what we email you about.">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-foreground">Weekly digest</p>
                <p className="font-body text-xs text-muted-foreground">Top posts from the freelancer community.</p>
              </div>
              <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-body text-sm font-medium text-foreground">Mentions & replies</p>
                <p className="font-body text-xs text-muted-foreground">When someone replies to your post or comment.</p>
              </div>
              <Switch checked={mentions} onCheckedChange={setMentions} />
            </div>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={() => toast({ title: "Saved", description: "Your settings have been updated." })}
              className="rounded-lg bg-primary px-5 py-2.5 font-body text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Settings;
