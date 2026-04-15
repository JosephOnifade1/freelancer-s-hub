import { TrendingUp, Sparkles, Users } from "lucide-react";

const tags = [
  { name: "pricing", count: 342 },
  { name: "clients", count: 289 },
  { name: "design", count: 256 },
  { name: "dev", count: 231 },
  { name: "marketing", count: 198 },
  { name: "finance", count: 167 },
  { name: "tools", count: 145 },
  { name: "growth", count: 134 },
];

const topContributors = [
  { name: "designkara", reputation: 4210 },
  { name: "marcelo_dev", reputation: 2340 },
  { name: "freelance_mike", reputation: 1560 },
];

export function FeedSidebar() {
  return (
    <div className="space-y-5">
      {/* Trending Tags */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Trending Tags
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag.name}
              className="rounded-md bg-secondary px-2 py-1 font-body text-[11px] font-medium text-secondary-foreground transition-colors hover:bg-primary/15 hover:text-primary"
            >
              #{tag.name}
              <span className="ml-1 text-muted-foreground">{tag.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Top Contributors */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-badge-question" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Top Contributors
          </h3>
        </div>
        <div className="space-y-2.5">
          {topContributors.map((user, i) => (
            <div key={user.name} className="flex items-center gap-2">
              <span className="font-heading text-xs font-bold text-muted-foreground w-4">
                {i + 1}
              </span>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 font-heading text-[10px] font-bold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 font-body text-xs font-medium text-foreground">
                {user.name}
              </span>
              <span className="font-body text-[10px] text-muted-foreground">
                ⚡ {user.reputation}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Community Stats */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-badge-resource" />
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Community
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="font-heading text-lg font-bold text-foreground">2.4k</p>
            <p className="font-body text-[10px] text-muted-foreground">Freelancers</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">847</p>
            <p className="font-body text-[10px] text-muted-foreground">Posts this week</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">12</p>
            <p className="font-body text-[10px] text-muted-foreground">Communities</p>
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-foreground">94%</p>
            <p className="font-body text-[10px] text-muted-foreground">Helpful rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
