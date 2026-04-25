import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { BadgeCheck, Info, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, Flame, MessageSquare, Star, Calendar, BookOpen, Heart, Zap, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getUserProfile, getUserResourcesCount } from "@/lib/users";
import { fetchPosts } from "@/lib/posts";
import { fetchCommentsByAuthor } from "@/lib/comments";

type AchievementDef = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
};

const Achievements = () => {
  const { user } = useAuth();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user?.uid ? getUserProfile(user.uid) : null,
    enabled: !!user?.uid,
  });

  const { data: allPosts = [] } = useQuery({
    queryKey: ['posts'],
    queryFn: fetchPosts,
    enabled: !!profile,
  });

  const { data: resourceCount = 0 } = useQuery({
    queryKey: ['user-resources-count', user?.uid],
    queryFn: () => getUserResourcesCount(user!.uid),
    enabled: !!user?.uid,
  });

  const { data: userComments = [] } = useQuery({
    queryKey: ['userComments', profile?.uid],
    queryFn: () => profile ? fetchCommentsByAuthor(profile) : [],
    enabled: !!profile,
  });

  const reputation = profile?.reputation || 0;

  const userPosts = profile
    ? allPosts.filter(p =>
        !p.isDeleted && (
          p.author?.uid === profile.uid ||
          p.author?.name === profile.username ||
          p.author?.name === profile.displayName
        )
      )
    : [];

  // Count upvotes received on comments
  const commentUpvotes = userComments.reduce((sum, c) => sum + Math.max(0, c.score || 0), 0);

  // Dynamic achievements based on real data
  const achievements: AchievementDef[] = [
    {
      id: "first-post",
      name: "First Post",
      description: "Publish your very first post.",
      icon: Flame,
      unlocked: userPosts.length >= 1,
    },
    {
      id: "rep-100",
      name: "Rising Voice",
      description: "Reach 100 reputation points.",
      icon: Zap,
      unlocked: reputation >= 100,
    },
    {
      id: "helper",
      name: "Helper",
      description: "Get 10 upvotes on comments.",
      icon: Heart,
      unlocked: commentUpvotes >= 10,
    },
    {
      id: "rep-1000",
      name: "Trusted Voice",
      description: "Reach 1,000 reputation.",
      icon: Star,
      unlocked: reputation >= 1000,
    },
    {
      id: "streak-30",
      name: "Consistent",
      description: "Post 30 days in a row.",
      icon: Calendar,
      unlocked: false, // Requires server-side streak tracking — future feature
    },
    {
      id: "resources-5",
      name: "Generous",
      description: "Share 5 resource posts.",
      icon: BookOpen,
      unlocked: resourceCount >= 5,
    },
    {
      id: "veteran",
      name: "Veteran Freelancer",
      description: "Reach 5,000 reputation.",
      icon: Trophy,
      unlocked: reputation >= 5000,
    },
    {
      id: "convo-starter",
      name: "Conversation Starter",
      description: "Get 50 comments on a single post.",
      icon: MessageSquare,
      unlocked: userPosts.some(p => (p.commentCount || 0) >= 50),
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const isTrustedVoice = achievements.find(a => a.id === 'rep-1000')?.unlocked ?? false;
  const isGenerous = achievements.find(a => a.id === 'resources-5')?.unlocked ?? false;
  const canVerify = isTrustedVoice && isGenerous;
  const verificationProgress = (isTrustedVoice ? 50 : 0) + (isGenerous ? 50 : 0);

  if (loadingProfile) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

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
                  Complete{!isTrustedVoice && " Trusted Voice"}{!isTrustedVoice && !isGenerous && " &"}{!isGenerous && " Generous"}
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
                  ? a.id === 'veteran'
                    ? "border-[#6366F1] bg-card shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                    : "border-primary/30 bg-card hover:border-primary/60 shadow-sm"
                  : "border-dashed border-[#312E81] bg-card/10 opacity-70"
              }`}
            >
              {a.unlocked && (
                <motion.div
                  className={`absolute inset-0 pointer-events-none ${a.id === 'veteran' ? 'veteran-gradient-bg opacity-40' : 'bg-[#D1FF4A]/5'}`}
                  animate={{ opacity: a.id === 'veteran' ? [0.2, 0.4, 0.2] : [0, 0.5, 0] }}
                  transition={{ duration: a.id === 'veteran' ? 4 : 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              <div
                className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-3 relative z-10 ${
                  a.unlocked
                    ? a.id === 'veteran'
                      ? "bg-[#6366F1]/30 text-[#6366F1] shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      : "bg-primary/15 text-primary glow-primary"
                    : "bg-secondary/50 text-muted-foreground/50"
                }`}
              >
                <a.icon className={`h-6 w-6 ${a.id === 'veteran' && a.unlocked ? "animate-pulse" : ""}`} />
                {a.unlocked && (
                  <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-card animate-pulse ${a.id === 'veteran' ? "bg-[#6366F1]" : "bg-[#D1FF4A]"}`} />
                )}
              </div>
              <h3 className={`font-heading text-sm font-semibold mb-1 relative z-10 ${a.id === 'veteran' && a.unlocked ? "veteran-text-gradient" : "text-foreground"}`}>
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
