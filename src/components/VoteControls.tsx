import { useState } from "react";
import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import { motion } from "framer-motion";

interface VoteControlsProps {
  score: number;
  userVote?: "up" | "down" | null;
  onVote?: (direction: "up" | "down" | null) => void;
}

export function VoteControls({ score, userVote = null, onVote }: VoteControlsProps) {
  const [vote, setVote] = useState(userVote);
  const [displayScore, setDisplayScore] = useState(score);

  const handleVote = (direction: "up" | "down") => {
    let newVote: "up" | "down" | null;
    let delta = 0;

    if (vote === direction) {
      newVote = null;
      delta = direction === "up" ? -1 : 1;
    } else if (vote === null) {
      newVote = direction;
      delta = direction === "up" ? 1 : -1;
    } else {
      newVote = direction;
      delta = direction === "up" ? 2 : -2;
    }

    setVote(newVote);
    setDisplayScore((prev) => prev + delta);
    onVote?.(newVote);
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
