import { useState, useEffect } from "react";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { fetchUserVote, handleVote as rtdbHandleVote } from "@/lib/votes";
import { toast } from "sonner";

interface VoteControlsProps {
  entityId?: string;
  authorUid?: string;
  score: number;
  type?: "post" | "comment";
  postIdForComment?: string;
}

export function VoteControls({ entityId, authorUid, score, type = "post", postIdForComment }: VoteControlsProps) {
  const { user } = useAuth();
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
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Failed to vote");
      // Could revert state here
    }
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={() => handleVote("up")}
        className={`rounded-md p-1 transition-colors ${
          vote === "up"
            ? "text-upvote bg-upvote/10"
            : "text-muted-foreground hover:text-upvote hover:bg-upvote/5"
        }`}
      >
        <ArrowBigUp className="h-5 w-5" fill={vote === "up" ? "currentColor" : "none"} />
      </button>
      <motion.span
        key={displayScore}
        initial={{ scale: 1.2, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`font-heading text-sm font-bold ${
          vote === "up" ? "text-upvote" : vote === "down" ? "text-downvote" : "text-foreground"
        }`}
      >
        {displayScore}
      </motion.span>
      <button
        onClick={() => handleVote("down")}
        className={`rounded-md p-1 transition-colors ${
          vote === "down"
            ? "text-downvote bg-downvote/10"
            : "text-muted-foreground hover:text-downvote hover:bg-downvote/5"
        }`}
      >
        <ArrowBigDown className="h-5 w-5" fill={vote === "down" ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
