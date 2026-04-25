import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import { achievements } from "@/data/mockAchievements";
import { Progress } from "@/components/ui/progress";
import { BadgeCheck, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const Achievements = () => {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const isTrustedVoice = achievements.find(a => a.id === 'rep-1000')?.unlocked;
  const isGenerous = achievements.find(a => a.id === 'resources-5')?.unlocked;
  const canVerify = isTrustedVoice && isGenerous;

  // Calculate progress toward verification (0, 50, or 100)
  const verificationProgress = (isTrustedVoice ? 50 : 0) + (isGenerous ? 50 : 0);

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <PageHeader
            title="Achievements"
            subtitle={`${unlockedCount} of ${achievements.length} unlocked. Keep contributing to earn more.`}
            className="mb-0"
          />
          
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm min-w-[300px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className={`h-5 w-5 ${canVerify ? "text-[#D1FF4A]" : "text-muted-foreground"}`} />
                <h3 className="font-heading text-sm font-bold text-foreground">Verification Path</h3>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[200px] font-body text-[11px] p-2">
                    Unlock both <span className="font-bold text-primary">Trusted Voice</span> and <span className="font-bold text-primary">Generous</span> to apply for pro verification.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Progress</span>
                <span>{verificationProgress}%</span>
              </div>
              <Progress value={verificationProgress} className="h-1.5 bg-secondary" />
              {canVerify ? (
                <p className="text-[11px] text-[#D1FF4A] font-medium mt-1">✨ You are eligible for Verification!</p>
              ) : (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Complete {!isTrustedVoice && "Trusted Voice"} {!isTrustedVoice && !isGenerous && "&"} {!isGenerous && "Generous"}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {achievements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-xl border p-4 text-center transition-all relative group overflow-hidden ${
                a.unlocked
                  ? "border-primary/30 bg-card hover:border-primary/60 shadow-sm"
                  : "border-dashed border-[#312E81] bg-card/10 opacity-70"
              }`}
            >
              {a.unlocked && (
                <motion.div 
                  className="absolute inset-0 bg-[#D1FF4A]/5 pointer-events-none"
                  animate={{ opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
              
              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-3 relative z-10 ${
                  a.unlocked ? "bg-primary/15 text-primary glow-primary" : "bg-secondary/50 text-muted-foreground/50"
                }`}
              >
                <a.icon className="h-6 w-6" />
                {a.unlocked && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-[#D1FF4A] rounded-full border-2 border-card animate-pulse" />
                )}
              </div>
              <h3 className="font-heading text-sm font-semibold text-foreground mb-1 relative z-10">
                {a.name}
              </h3>
              <p className="font-body text-[11px] text-muted-foreground leading-snug relative z-10">
                {a.description}
              </p>
              {!a.unlocked && (
                <div className="mt-2 flex items-center justify-center gap-1">
                  <div className="h-1 w-8 bg-[#312E81] rounded-full" />
                  <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground/40 font-bold">
                    Locked
                  </span>
                  <div className="h-1 w-8 bg-[#312E81] rounded-full" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Achievements;
