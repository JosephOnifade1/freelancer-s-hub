import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPollByPostId, votePollOption } from "@/lib/polls";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Check } from "lucide-react";

interface PollWidgetProps {
  postId: string;
}

export function PollWidget({ postId }: PollWidgetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: poll, isLoading } = useQuery({
    queryKey: ["poll", postId, user?.uid],
    queryFn: () => fetchPollByPostId(postId, user?.uid),
  });

  const voteMutation = useMutation({
    mutationFn: (optionId: string) => {
      if (!user?.uid) throw new Error("Sign in to vote");
      if (!poll?.id) throw new Error("Poll not found");
      return votePollOption(poll.id, optionId, user.uid);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["poll", postId, user?.uid] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to vote"),
  });

  if (isLoading || !poll) return null;

  const hasVoted = !!poll.userVoteOptionId;

  return (
    <div className="mt-2 space-y-1.5 border border-border/50 bg-card/50 p-3" onClick={(e) => e.stopPropagation()}>
      {poll.options.map((option) => {
        const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
        const isSelected = poll.userVoteOptionId === option.id;

        return (
          <button
            key={option.id}
            disabled={hasVoted || voteMutation.isPending}
            onClick={() => voteMutation.mutate(option.id)}
            className="relative w-full overflow-hidden border border-border/60 text-left disabled:cursor-default"
          >
            {hasVoted && (
              <div
                className="absolute inset-y-0 left-0 bg-primary/10"
                style={{ width: `${pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between px-3 py-2 font-body text-xs">
              <span className="flex items-center gap-1.5 text-foreground">
                {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                {option.label}
              </span>
              {hasVoted && (
                <span className="text-muted-foreground tabular-nums">{pct}%</span>
              )}
            </div>
          </button>
        );
      })}
      <p className="pt-1 font-body text-[10px] uppercase tracking-wide text-muted-foreground">
        {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
        {!hasVoted && !!user?.uid && " · tap to vote"}
      </p>
    </div>
  );
}
