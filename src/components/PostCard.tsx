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
import { Editor } from "@/components/editor/Editor";
import { stripMarkdown } from "@/lib/markdown";
import { PollWidget } from "@/components/PollWidget";
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
  type: "discussion" | "question" | "resource" | "weekly" | "poll";
  author: {
    uid?: string;
    name: string;
    username?: string;
    avatar?: string;
    avatarUrl?: string;
    reputation: number;
    isVerifiedPro?: boolean;
  };
  score: number;
  ups?: number;
  downs?: number;
  commentCount: number;
  tags: string[];
  timeAgo?: string;
  createdAt?: number;
  views?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  externalLink?: string;
  category?: string;
  communitySlug?: string;
  visibility?: "public" | "members" | "admins";
  allowComments?: boolean;
  isPinned?: boolean;
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

  const previewText = stripMarkdown(post.body || "").substring(0, 150) + (stripMarkdown(post.body || "").length > 150 ? "..." : "");
  
  const postImages: { alt: string, src: string }[] = [];
  const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
  let match;
  while ((match = imageRegex.exec(post.body || "")) !== null) {
    postImages.push({ alt: match[1], src: match[2] });
  }

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
    const spacePath = post.category ? `/b/${post.category}` : '';
    const shareUrl = window.location.origin + `${spacePath}/p/${post.id}${user?.uid ? `?ref_id=${user.uid}` : ''}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard!");
  };

  if (post.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.3 }}
        className="group flex gap-3 rounded-xl border border-border bg-card py-[11.5px] px-4 transition-colors"
      >
        <div className="flex flex-col items-center justify-center gap-1.5 py-1 w-9 shrink-0">
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

          <Link to={post.category ? `/b/${post.category}/p/${post.id}` : `/p/${post.id}`} className="block">
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
              <Link to={post.category ? `/b/${post.category}/p/${post.id}` : `/p/${post.id}`} className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
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
      className="group flex gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-muted-foreground/40"
    >
      {postImages[0] && !isEditing && (
        <Link to={post.category ? `/b/${post.category}/p/${post.id}` : `/p/${post.id}`} className="shrink-0 mt-1 block h-[72px] w-[96px] overflow-hidden rounded-md border border-border bg-muted/20">
          <img
            src={postImages[0].src}
            alt={postImages[0].alt || "Post thumbnail"}
            className="h-full w-full object-cover"
          />
        </Link>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">

          {post.communitySlug ? (
            // ── COMMUNITY POST: b/space is the primary identity ──────────────
            <>
              <Link
                to={`/b/${post.communitySlug}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-foreground font-heading text-[9px] font-bold shrink-0">
                  {post.communitySlug.charAt(0).toUpperCase()}
                </div>
                <span className="font-body text-[12px] font-bold text-foreground hover:underline">
                  b/{post.communitySlug}
                </span>
              </Link>
              <span className="text-muted-foreground text-[11px]">·</span>
              <Link
                to={post.author?.uid ? `/f/${post.author.username || post.author.name?.replace(/\s+/g, '')}` : "#"}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <div className="flex h-4 w-4 items-center justify-center rounded-full font-heading text-[9px] font-bold overflow-hidden bg-muted text-muted-foreground shrink-0">
                  {(post.author?.avatar || post.author?.avatarUrl) ? (
                    <img src={post.author.avatar || post.author.avatarUrl} alt={post.author.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'}</span>
                  )}
                </div>
                <span className="font-body text-[11px] text-muted-foreground hover:underline flex items-center gap-0.5">
                  f/{post.author?.username || post.author?.name?.replace(/\s+/g, '') || 'unknown'}
                  <VerifiedBadge isVerified={!!post.author?.isVerifiedPro} size={10} showTooltip={false} />
                </span>
              </Link>
            </>
          ) : (
            // ── PROFILE POST: f/username is the primary identity ─────────────
            <Link
              to={post.author?.uid ? `/f/${post.author.username || post.author.name?.replace(/\s+/g, '')}` : "#"}
              className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-muted text-foreground shrink-0">
                {(post.author?.avatar || post.author?.avatarUrl) ? (
                  <img src={post.author.avatar || post.author.avatarUrl} alt={post.author.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'}</span>
                )}
              </div>
              <span className="font-body text-[12px] font-medium text-foreground hover:underline flex items-center gap-1">
                f/{post.author?.username || post.author?.name?.replace(/\s+/g, '') || 'unknown'}
                <VerifiedBadge isVerified={!!post.author?.isVerifiedPro} size={12} showTooltip={false} />
              </span>
            </Link>
          )}

          <span className="text-muted-foreground text-[12px]">•</span>
          <span className="font-body text-[12px] text-muted-foreground flex items-center gap-1">
            {formatTimeAgo(post.createdAt)}
            {isVeteran(post.author?.reputation || 0) && (
              <span className="text-brand font-bold ml-1" title="Veteran">V</span>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
             {post.type !== 'discussion' && <PostTypeBadge type={post.type} />}
          </div>
        </div>

        <Link to={post.category ? `/b/${post.category}/p/${post.id}` : `/p/${post.id}`} className="block">
          <h3 className="font-heading text-[1.1rem] font-semibold text-foreground leading-tight cursor-pointer">
            {post.title}
          </h3>
        </Link>
        
        {post.externalLink && (
          <a 
            href={post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 font-body text-[11px] text-brand hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Source Reference
          </a>
        )}
        
        {isEditing ? (
          <div className="mb-2 mt-2">
            <Editor
              value={editBody}
              onChange={setEditBody}
              placeholder="Edit your post..."
              minHeight="150px"
              className="mb-3"
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
          !postImages[0] && previewText && (
            <Link to={post.category ? `/b/${post.category}/p/${post.id}` : `/p/${post.id}`} className="block mt-0.5">
              <p className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-2">
                {previewText}
              </p>
            </Link>
          )
        )}

        {post.type === "poll" && <PollWidget postId={post.id} />}

        {post.tags && post.tags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                to={`/tag/${tag}`}
                className="rounded-full bg-muted px-2.5 py-0.5 font-body text-[11px] font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-all"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <VoteControls score={post.score || 0} entityId={post.id} authorUid={post.author?.uid} type="post" orientation="horizontal" />
          
          <Link to={post.category ? `/b/${post.category}/p/${post.id}` : `/p/${post.id}`} className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-body text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-info">
            <MessageSquare className="h-4 w-4" />
            {post.commentCount || 0}
          </Link>
          
          <button onClick={handleShare} aria-label="Share post" className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-body text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-brand">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Share</span>
          </button>
          
          <button aria-label={isSaved ? "Unsave post" : "Save post"} 
            onClick={(e) => { e.preventDefault(); bookmarkMutation.mutate(); }}
            disabled={bookmarkMutation.isPending}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-body text-[12px] font-medium transition-colors hover:bg-muted/40 ${isSaved ? 'text-warning' : 'text-muted-foreground hover:text-warning'}`}
          >
            <Bookmark className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} />
            <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
          </button>

          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus:outline-none">
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
    </motion.div>
  );
}
