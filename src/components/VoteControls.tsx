import { useState, useEffect, useRef } from "react";
import { ArrowBigUp, ArrowBigDown, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/auth-context";
import { fetchUserVote, handleVote as rtdbHandleVote } from "@/lib/votes";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface VoteControlsProps {
  entityId?: string;
  authorUid?: string;
  score: number;
  type?: "post" | "comment";
  postIdForComment?: string;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
}

export function VoteControls({ entityId, authorUid, score, type = "post", postIdForComment, orientation = "vertical", disabled = false }: VoteControlsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [displayScore, setDisplayScore] = useState(score);
  const [isVoting, setIsVoting] = useState(false);
  const [loadedVoteKey, setLoadedVoteKey] = useState<string | null>(null);
  const [voteLoadError, setVoteLoadError] = useState(false);
  const [voteRetry, setVoteRetry] = useState(0);
  const voteKey = `${user?.uid || ""}:${type}:${entityId || ""}`;
  const voteReady = disabled || !user?.uid || !entityId || loadedVoteKey === voteKey;
  // A ref closes the tiny gap between a click and React's next render, so
  // repeated clicks in the same tick cannot submit two RPCs.
  const votingRef = useRef(false);
  const latestScoreRef = useRef(score);
  latestScoreRef.current = score;

  useEffect(() => {
    if (!votingRef.current) setDisplayScore(score);
  }, [entityId, score]);

  useEffect(() => {
    let cancelled = false;
    setVote(null);
    setLoadedVoteKey(null);
    setVoteLoadError(false);
    if (!disabled && user?.uid && entityId) {
      fetchUserVote(entityId, user.uid, type).then((val) => {
        if (!cancelled) {
          setVote(val === 1 ? "up" : val === -1 ? "down" : null);
          setLoadedVoteKey(voteKey);
        }
      }).catch((error) => {
        if (!cancelled) {
          console.error("Could not load vote status", error);
          setVoteLoadError(true);
        }
      });
    }
    return () => { cancelled = true; };
  }, [entityId, user?.uid, type, voteKey, voteRetry, disabled]);

  const handleVote = async (direction: "up" | "down") => {
    if (disabled || !voteReady || votingRef.current) return;
    if (!user) {
      toast.error("You must be logged in to vote");
      return;
    }
    if (!entityId) return;
    if (authorUid && authorUid === user.uid) {
      toast.error("You can't vote on your own content");
      return;
    }

    let newVote: "up" | "down" | null;
    let delta = 0;
    let numericVote: 1 | -1 | 0 = 0;

    if (vote === direction) {
      newVote = null;
      delta = direction === "up" ? -1 : 1;
      numericVote = 0;
    } else if (vote === null) {
      newVote = direction;
      delta = direction === "up" ? 1 : -1;
      numericVote = direction === "up" ? 1 : -1;
    } else {
      newVote = direction;
      delta = direction === "up" ? 2 : -2;
      numericVote = direction === "up" ? 1 : -1;
    }

    // Optimistic UI update. The ref and disabled buttons lock this control
    // until the RPC settles; cast_vote serializes other tabs on the server.
    votingRef.current = true;
    const scoreWhenSubmitted = latestScoreRef.current;
    setIsVoting(true);
    setVote(newVote);
    setDisplayScore((prev) => prev + delta);

    try {
      await rtdbHandleVote(entityId, authorUid, user.uid, numericVote, type, postIdForComment);
      // Invalidate author's profile so VeteranCelebration fires reactively on rep gain
      if (authorUid) {
        queryClient.invalidateQueries({ queryKey: ['profile', authorUid] });
      }
    } catch (e) {
      console.error(e);
      // The RPC rejected the vote — roll the optimistic update back so the
      // UI never claims a score the server doesn't have.
      setVote(vote);
      setDisplayScore(latestScoreRef.current);
      toast.error(getErrorMessage(e, "Failed to vote"));
    } finally {
      votingRef.current = false;
      setIsVoting(false);
      // If another refetch changed the prop while the vote was in flight,
      // use its latest score instead of leaving a stale optimistic number.
      if (latestScoreRef.current !== scoreWhenSubmitted) setDisplayScore(latestScoreRef.current);
      // Reconcile the optimistic score with the server on success or error
      // (a network failure might arrive after the server committed a vote).
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
      if (type === "post") {
        queryClient.invalidateQueries({ queryKey: ['post', entityId] });
      } else if (postIdForComment) {
        queryClient.invalidateQueries({ queryKey: ['comments', postIdForComment] });
        queryClient.invalidateQueries({ queryKey: ['post', postIdForComment] });
      }
    }
  };

  const isHorizontal = orientation === "horizontal";

  return (
    <div className={isHorizontal ? "flex items-center gap-0.5 bg-muted/40 rounded-full px-1 py-0.5 border border-border" : "flex flex-col items-center justify-center gap-1.5 py-1 w-9 shrink-0"}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); handleVote("up"); }}
        disabled={disabled || isVoting || !voteReady}
        title={voteReady ? undefined : voteLoadError ? "Vote status unavailable; retry below" : "Loading your vote status"}
        aria-label="Upvote"
        aria-pressed={vote === "up"}
        className={`rounded-full p-1 transition-all duration-200 disabled:opacity-50 ${
          vote === "up"
            ? "text-upvote bg-upvote/10"
            : "text-muted-foreground hover:text-upvote hover:bg-upvote/10"
        }`}
      >
        <ArrowBigUp className={isHorizontal ? "h-4 w-4" : "h-5 w-5"} fill={vote === "up" ? "currentColor" : "none"} />
      </button>
      
      <div className={`flex items-center justify-center ${isHorizontal ? 'px-1' : 'min-h-[20px]'}`}>
        <motion.span
          key={displayScore}
          initial={{ scale: 1.2, opacity: 0.7 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`font-heading ${isHorizontal ? 'text-[12px]' : 'text-sm'} font-bold leading-none ${
            vote === "up" ? "text-upvote" : vote === "down" ? "text-downvote" : "text-foreground"
          }`}
        >
          {displayScore}
        </motion.span>
      </div>

      {voteLoadError && !disabled && (
        <button
          type="button"
          aria-label="Retry loading vote"
          title="Retry loading your vote status"
          onClick={() => setVoteRetry((attempt) => attempt + 1)}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); handleVote("down"); }}
        disabled={disabled || isVoting || !voteReady}
        title={voteReady ? undefined : voteLoadError ? "Vote status unavailable; retry below" : "Loading your vote status"}
        aria-label="Downvote"
        aria-pressed={vote === "down"}
        className={`rounded-full p-1 transition-all duration-200 disabled:opacity-50 ${
          vote === "down"
            ? "text-downvote bg-downvote/10"
            : "text-muted-foreground hover:text-downvote hover:bg-downvote/10"
        }`}
      >
        <ArrowBigDown className={isHorizontal ? "h-4 w-4" : "h-5 w-5"} fill={vote === "down" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
