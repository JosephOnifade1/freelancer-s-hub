import { MessageSquare, Share2, Bookmark } from "lucide-react";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { motion } from "framer-motion";

export interface PostData {
  id: string;
  title: string;
  body: string;
  type: "discussion" | "question" | "resource" | "weekly";
  author: {
    name: string;
    avatar?: string;
    reputation: number;
  };
  score: number;
  commentCount: number;
  tags: string[];
  timeAgo: string;
}

interface PostCardProps {
  post: PostData;
  index: number;
}

export function PostCard({ post, index }: PostCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group flex gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/20 hover:bg-surface-elevated"
    >
      <VoteControls score={post.score} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <PostTypeBadge type={post.type} />
          <span className="font-body text-xs text-muted-foreground">
            {post.timeAgo}
          </span>
        </div>

        <h3 className="font-heading text-base font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors cursor-pointer">
          {post.title}
        </h3>

        <p className="font-body text-sm text-muted-foreground line-clamp-2 mb-3">
          {post.body}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground cursor-pointer hover:bg-primary/15 hover:text-primary transition-colors"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 font-heading text-[10px] font-bold text-primary">
              {post.author.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-body text-xs font-medium text-foreground">
              {post.author.name}
            </span>
            <span className="font-body text-[10px] text-muted-foreground">
              ⚡ {post.author.reputation}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {post.commentCount}
            </button>
            <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Share2 className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Bookmark className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
