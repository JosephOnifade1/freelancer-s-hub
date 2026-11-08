import { useState, useEffect } from "react";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserVote, handleVote as rtdbHandleVote } from "@/lib/votes";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface VoteControlsProps {
  entityId?: string;
  authorUid?: string;
  score: number;
  type?: "post" | "comment";
  postIdForComment?: string;
  orientation?: "vertical" | "horizontal";
}

export function VoteControls({ entityId, authorUid, score, type = "post", postIdForComment, orientation = "vertical" }: VoteControlsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [displayScore, setDisplayScore] = useState(score);

  useEffect(() => {
    setDisplayScore(score);
    if (user && entityId) {
      fetchUserVote(entityId, user.uid, type).then((val) => {
        if (val === 1) setVote("up");
        else if (val === -1) setVote("down");
        else setVote(null);
      }).catch(console.error);
    }
  }, [entityId, user, score, type]);

  const handleVote = async (direction: "up" | "down") => {
    if (!user) {
      toast.error("You must be logged in to vote");
      return;
    }
    if (!entityId) return;

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

    // Optimistic UI update
    setVote(newVote);
    setDisplayScore((prev) => prev + delta);
    
    // Fire mutation in background
    try {
      await rtdbHandleVote(entityId, authorUid, user.uid, numericVote, type, postIdForComment);
      // Invalidate author's profile so VeteranCelebration fires reactively on rep gain
      if (authorUid) {
        queryClient.invalidateQueries({ queryKey: ['profile', authorUid] });
      }
      // Refresh posts so vote scores stay in sync across the feed
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (e: any) {
      console.error(e);
      // The RPC rejected the vote — roll the optimistic update back so the
      // UI never claims a score the server doesn't have.
      setVote(vote);
      setDisplayScore((prev) => prev - delta);
      toast.error(e.message || "Failed to vote");
    }
  };

  const isHorizontal = orientation === "horizontal";

  return (
    <div className={isHorizontal ? "flex items-center gap-0.5 bg-muted/40 rounded-full px-1 py-0.5 border border-border" : "flex flex-col items-center justify-center gap-1.5 py-1 w-9 shrink-0"}>
      <button
        onClick={(e) => { e.preventDefault(); handleVote("up"); }}
        className={`rounded-full p-1 transition-all duration-200 ${
          vote === "up"
            ? "text-success bg-success/10"
            : "text-muted-foreground hover:text-success hover:bg-success/10"
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
            vote === "up" ? "text-success" : vote === "down" ? "text-destructive" : "text-foreground"
          }`}
        >
          {displayScore}
        </motion.span>
      </div>

      <button
        onClick={(e) => { e.preventDefault(); handleVote("down"); }}
        className={`rounded-full p-1 transition-all duration-200 ${
          vote === "down"
            ? "text-destructive bg-destructive/10"
            : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        }`}
      >
        <ArrowBigDown className={isHorizontal ? "h-4 w-4" : "h-5 w-5"} fill={vote === "down" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
