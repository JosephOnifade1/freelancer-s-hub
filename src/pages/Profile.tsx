import { useState } from "react";
import { Link as LinkIcon, MapPin, Calendar, Zap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PostCard } from "@/components/PostCard";
import { mockPosts } from "@/data/mockPosts";

const skills = ["React", "TypeScript", "UI Design", "Figma", "Copywriting"];
const tabs = ["Posts", "Comments", "Achievements"] as const;
type Tab = (typeof tabs)[number];

const Profile = () => {
  const [active, setActive] = useState<Tab>("Posts");
  const userPosts = mockPosts.slice(0, 3);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary/20 font-heading text-2xl font-bold text-primary glow-primary">
              M
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="font-heading text-2xl font-bold text-foreground">
                  marcelo_dev
                </h1>
                <span className="rounded-full bg-badge-resource/15 px-2 py-0.5 font-body text-[10px] font-semibold text-badge-resource">
                  Open to work
                </span>
              </div>
              <p className="font-body text-sm text-muted-foreground mb-3">
                Fintech dashboards & React specialist. Helping solo devs raise their rates.
              </p>
              <div className="flex flex-wrap gap-3 font-body text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> Lisbon, Portugal
                </span>
                <a href="#" className="flex items-center gap-1 hover:text-primary">
                  <LinkIcon className="h-3.5 w-3.5" /> marcelo.dev
                </a>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Joined 2024
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span
                    key={s}
                    className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <button className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:opacity-90">
              Follow
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 pt-5 border-t border-border">
            <div>
              <p className="font-heading text-xl font-bold text-foreground flex items-center gap-1">
                <Zap className="h-4 w-4 text-primary" /> 2,340
              </p>
              <p className="font-body text-[11px] text-muted-foreground">Reputation</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold text-foreground">847</p>
              <p className="font-body text-[11px] text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="font-heading text-xl font-bold text-foreground">124</p>
              <p className="font-body text-[11px] text-muted-foreground">Following</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex items-center gap-1 rounded-xl border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={`flex-1 rounded-lg px-4 py-2 font-body text-sm font-medium transition-all ${
                active === t
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {active === "Posts" && (
          <div className="space-y-3">
            {userPosts.map((post, i) => (
              <PostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        )}
        {active === "Comments" && (
          <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
            Comment history will appear here.
          </div>
        )}
        {active === "Achievements" && (
          <div className="rounded-xl border border-border bg-card p-6 text-center font-body text-sm text-muted-foreground">
            Visit the <a href="/achievements" className="text-primary hover:underline">Achievements page</a> to see all badges.
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Profile;
