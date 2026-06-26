import { useEffect } from "react";
import { Palette, Code2, PenTool, Megaphone, Video, Briefcase, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAllCommunities, joinCommunity, leaveCommunity, seedDefaultCommunities } from "@/lib/communities";
import { getUserProfile } from "@/lib/users";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "react-router-dom";

// Map slug → icon for display
const COMMUNITY_ICONS: Record<string, React.ElementType> = {
  design: Palette,
  dev: Code2,
  writing: PenTool,
  marketing: Megaphone,
  video: Video,
  consulting: Briefcase,
};

const Communities = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Seed default communities on first load
  useEffect(() => {
    seedDefaultCommunities();
  }, []);

  const { data: communities = [], isLoading: loadingCommunities } = useQuery({
    queryKey: ['communities'],
    queryFn: fetchAllCommunities,
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user?.uid ? getUserProfile(user.uid) : null,
    enabled: !!user?.uid,
  });

  const joinedSlugs = profile?.communitiesList || {};

  const joinMutation = useMutation({
    mutationFn: ({ slug }: { slug: string }) => {
      if (!user) throw new Error("Please log in to join communities");
      return joinCommunity(user.uid, slug);
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success(`Joined b/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to join community"),
  });

  const leaveMutation = useMutation({
    mutationFn: ({ slug }: { slug: string }) => {
      if (!user) throw new Error("Please log in");
      return leaveCommunity(user.uid, slug);
    },
    onSuccess: (_, { slug }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      toast.success(`Left b/${slug}`);
    },
    onError: (err: any) => toast.error(err.message || "Failed to leave community"),
  });

  const handleToggle = (slug: string, isJoined: boolean) => {
    if (isJoined) {
      leaveMutation.mutate({ slug });
    } else {
      joinMutation.mutate({ slug });
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <PageHeader
          title="Borynx Spaces"
          subtitle="Niche spaces inside Borynx. Join the ones relevant to your work."
        />
        {loadingCommunities ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {communities.map((c, i) => {
              const isJoined = !!joinedSlugs[c.slug];
              const isPending = joinMutation.isPending || leaveMutation.isPending;
              const Icon = COMMUNITY_ICONS[c.slug] || Briefcase;

              return (
                <motion.div
                  key={c.slug}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <Link to={`/b/${c.slug}`} className="hover:text-primary transition-colors">
                        <h3 className="font-heading text-base font-semibold text-foreground">
                          b/{c.slug}
                        </h3>
                      </Link>
                      <p className="font-body text-[11px] text-muted-foreground">
                        {(c.memberCount || 0).toLocaleString()} members
                      </p>
                    </div>
                  </div>
                  <p className="font-body text-sm text-muted-foreground mb-4">
                    {c.description}
                  </p>
                  <button
                    onClick={() => handleToggle(c.slug, isJoined)}
                    disabled={isPending}
                    className={`w-full rounded-lg px-3 py-2 font-body text-sm font-semibold transition-all disabled:opacity-60 ${
                      isJoined
                        ? "bg-secondary text-foreground hover:bg-secondary/70"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    {isJoined ? "Joined ✓" : "Join"}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Communities;
