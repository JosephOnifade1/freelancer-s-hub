import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import { achievements } from "@/data/mockAchievements";

const Achievements = () => {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <PageHeader
          title="Achievements"
          subtitle={`${unlockedCount} of ${achievements.length} unlocked. Keep contributing to earn more.`}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border p-4 text-center transition-all ${
                a.unlocked
                  ? "border-primary/30 bg-card hover:border-primary/60"
                  : "border-border bg-card/30 opacity-60"
              }`}
            >
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-3 ${
                  a.unlocked ? "bg-primary/15 text-primary glow-primary" : "bg-secondary text-muted-foreground"
                }`}
              >
                <a.icon className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-1">
                {a.name}
              </h3>
              <p className="font-body text-[11px] text-muted-foreground leading-snug">
                {a.description}
              </p>
              {!a.unlocked && (
                <p className="mt-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  Locked
                </p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Achievements;
