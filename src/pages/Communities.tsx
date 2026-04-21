import { useState } from "react";
import { Palette, Code2, PenTool, Megaphone, Video, Briefcase } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";

const communities = [
  { id: "design", name: "Design", icon: Palette, members: 4820, description: "UI, UX, branding, illustration." },
  { id: "dev", name: "Freelance Dev", icon: Code2, members: 6310, description: "Web, mobile, full-stack devs going solo." },
  { id: "writing", name: "Writing", icon: PenTool, members: 2140, description: "Copywriters, content writers, ghostwriters." },
  { id: "marketing", name: "Marketing", icon: Megaphone, members: 3290, description: "Growth, SEO, paid ads, email." },
  { id: "video", name: "Video & Motion", icon: Video, members: 1780, description: "Editors, motion designers, animators." },
  { id: "consulting", name: "Consulting", icon: Briefcase, members: 1540, description: "Strategy, ops, advisory work." },
];

const Communities = () => {
  const [joined, setJoined] = useState<Set<string>>(new Set(["design"]));

  const toggle = (id: string) => {
    setJoined((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <PageHeader
          title="Communities"
          subtitle="Niche spaces inside Soloboard. Join the ones relevant to your work."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {communities.map((c, i) => {
            const isJoined = joined.has(c.id);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {c.name}
                    </h3>
                    <p className="font-body text-[11px] text-muted-foreground">
                      {c.members.toLocaleString()} members
                    </p>
                  </div>
                </div>
                <p className="font-body text-sm text-muted-foreground mb-4">
                  {c.description}
                </p>
                <button
                  onClick={() => toggle(c.id)}
                  className={`w-full rounded-lg px-3 py-2 font-body text-sm font-semibold transition-all ${
                    isJoined
                      ? "bg-secondary text-foreground hover:bg-secondary/70"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {isJoined ? "Joined" : "Join"}
                </button>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default Communities;
