import { MessageSquare, Share2, Bookmark, MoreHorizontal, Edit2, Trash2, Eye, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { formatTimeAgo } from "@/lib/utils";
import { isVeteran } from "@/lib/users";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, toggleBookmark } from "@/lib/users";
import { updatePost, softDeletePost } from "@/lib/posts";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PostData {
  id: string;
  title: string;
  body: string;
  type: "discussion" | "question" | "resource" | "weekly";
  author: {
    uid?: string;
    name: string;
    avatar?: string;
    reputation: number;
    isVerifiedPro?: boolean;
  };
  score: number;
  commentCount: number;
  tags: string[];
  timeAgo: string;
  createdAt?: number;
  views?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  externalLink?: string;
}

interface PostCardProps {
  post: PostData;
  index: number;
}

export function PostCard({ post, index }: PostCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user?.uid ? getUserProfile(user.uid) : null,
    enabled: !!user?.uid,
  });

  const isSaved = profile?.savedPosts?.[post.id] === true;
  const isOwnPost = user?.uid === post.author?.uid;

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in to save posts");
      return toggleBookmark(user.uid, post.id);
    },
    onSuccess: (nowSaved) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
      toast.success(nowSaved ? "Saved to your profile" : "Removed from saved posts");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save post");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => updatePost(post.id, editBody),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
      toast.success("Post updated");
    },
    onError: () => toast.error("Failed to update post")
  });

  const deleteMutation = useMutation({
    mutationFn: async () => softDeletePost(post.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
      toast.success("Post deleted");
    },
    onError: () => toast.error("Failed to delete post")
  });

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText(window.location.origin + `/post/${post.id}`);
    toast.success("Link copied to clipboard!");
  };

  if (post.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="group flex gap-3 rounded-xl border border-border bg-card py-[13.6px] px-4 transition-colors"
      >
        <div className="flex flex-col items-center gap-1 w-8 opacity-50">
           {/* Placeholder for vote controls, unclickable */}
           <div className="h-6 w-6 rounded text-muted-foreground flex items-center justify-center">^</div>
           <span className="font-heading text-xs font-bold text-muted-foreground">{post.score || 0}</span>
           <div className="h-6 w-6 rounded text-muted-foreground flex items-center justify-center">v</div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <PostTypeBadge type={post.type} />
            <span className="font-body text-xs text-muted-foreground">
              {formatTimeAgo(post.createdAt)}
            </span>
          </div>

          <Link to={`/post/${post.id}`} className="block">
            <h3 className="font-heading text-base font-semibold text-muted-foreground leading-snug mb-1 transition-colors cursor-pointer line-through opacity-80">
              {post.title}
            </h3>

            <p className="font-body text-sm text-muted-foreground/70 italic line-clamp-2 mb-3 bg-muted/30 p-2 rounded-md">
              The author has removed this content, but the discussion below remains active.
            </p>
          </Link>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-heading text-[10px] font-bold text-muted-foreground">
                ?
              </div>
              <span className="font-body text-xs font-medium text-muted-foreground">
                Original Poster (Removed)
              </span>
            </div>

            <div className="flex items-center gap-1">
              <Link to={`/post/${post.id}`} className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                {post.commentCount || 0}
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`group flex gap-3 rounded-xl border bg-card py-[13.6px] px-4 transition-all duration-300 hover:bg-surface-elevated ${
        post.type === 'discussion' 
          ? 'border-[#6366F1]/30 shadow-[0_4px_15px_rgba(99,102,241,0.05)] hover:border-[#6366F1]/50' 
          : 'border-border hover:border-primary/20'
      } ${isVeteran(post.author?.reputation || 0) ? 'veteran-aura' : ''}`}
    >
      <VoteControls score={post.score || 0} entityId={post.id} authorUid={post.author?.uid} type="post" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <PostTypeBadge type={post.type} />
            <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
              {formatTimeAgo(post.createdAt)}
              {isVeteran(post.author?.reputation || 0) && (
                <span className="text-[#6366F1] font-bold ml-1 flex items-center gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1] animate-pulse" />
                  V
                </span>
              )}
              {post.isEdited && <span className="italic text-[10px]">(edited)</span>}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="font-body text-[11px] text-[#4B5563] flex items-center gap-1 opacity-80">
              <Eye className="h-3.5 w-3.5" /> {post.views || 0}
            </span>
          </div>
        </div>

        <Link to={`/post/${post.id}`} className="block">
          <h3 className="font-heading text-base font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors cursor-pointer">
            {post.title}
          </h3>
        </Link>
        
        {post.externalLink && (
          <a 
            href={post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 font-body text-[11px] text-primary hover:underline mb-2"
          >
            <ExternalLink className="h-3 w-3" />
            Source Reference
          </a>
        )}
        
        {isEditing ? (
          <div className="mb-3">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="w-full resize-none rounded-md bg-background border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              rows={3}
            />
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
              <button 
                onClick={() => updateMutation.mutate()} 
                disabled={updateMutation.isPending || !editBody.trim()}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded hover:opacity-90 disabled:opacity-50"
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <Link to={`/post/${post.id}`} className="block">
            <p className="font-body text-sm text-muted-foreground line-clamp-2 mb-3">
              {post.body}
            </p>
          </Link>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {(post.tags || []).map((tag) => (
            <Link
              key={tag}
              to={`/tag/${tag}`}
              className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground cursor-pointer hover:bg-primary/15 hover:text-primary transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <Link to={post.author?.uid ? `/profile/${post.author.uid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="flex h-6 w-6 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-primary/20 text-primary">
              {post.author?.avatar ? (
                <img src={post.author.avatar} alt={post.author.name} className="h-full w-full object-cover" />
              ) : (
                <span>{post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'}</span>
              )}
            </div>
            <span className="font-body text-xs font-medium text-foreground flex items-center gap-1">
              {post.author?.name || 'Unknown'}
              <VerifiedBadge isVerified={!!post.author?.isVerifiedPro} size={12} showTooltip={false} />
            </span>
            <span className="font-body text-[10px] text-muted-foreground">
              <LiveReputation uid={post.author?.uid} fallback={post.author?.reputation || 0} />
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <Link to={`/post/${post.id}`} className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {post.commentCount || 0}
            </Link>
            <button onClick={handleShare} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <Share2 className="h-3.5 w-3.5" />
            </button>
            
            {/* The dropdown menu replaces the standalone save button for a cleaner look if we wanted, but we keep bookmark for quick access. 
                Wait, let's keep bookmark and add the three dots! */}
            <button 
              onClick={(e) => { e.preventDefault(); bookmarkMutation.mutate(); }}
              disabled={bookmarkMutation.isPending}
              className={`rounded-md p-1 transition-colors hover:bg-secondary ${isSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
            </button>

            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 font-body">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                    <Edit2 className="h-4 w-4 mr-2" />
                    <span>Edit Post</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteMutation.mutate()} className="cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete Post</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
