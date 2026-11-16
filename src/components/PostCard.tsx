import { MessageSquare, Share2, Bookmark, MoreHorizontal, Edit2, Trash2, Eye, ExternalLink, Pin, Lock, Users, Flag, CheckCircle2 } from "lucide-react";
import { AppLink as Link } from "@/components/AppLink";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { UserHoverCard } from "@/components/UserHoverCard";
import { CommunityHoverCard } from "@/components/CommunityHoverCard";
import { cn, formatTimeAgo } from "@/lib/utils";
import { isVeteran } from "@/lib/users";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, toggleBookmark } from "@/lib/users";
import { updatePost, softDeletePost } from "@/lib/posts";
import { useState } from "react";
import { Editor } from "@/components/editor/Editor";
import { stripMarkdown } from "@/lib/markdown";
import { PollWidget } from "@/components/PollWidget";
import { ReportDialog } from "@/components/ReportDialog";
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

export interface PostCardProps {
  post: PostData;
  index: number;
  isFocused?: boolean;
}

export function PostCard({ post, index, isFocused }: PostCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [isPostReportOpen, setIsPostReportOpen] = useState(false);

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
      queryClient.invalidateQueries({ queryKey: ['savedPosts', user?.uid] });
      toast.success(nowSaved ? "Saved to your bookmarks" : "Removed from bookmarks");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save post");
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => updatePost(post.id, editBody),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['post', post.id] });
      if (post.communitySlug) queryClient.invalidateQueries({ queryKey: ['communityPosts', post.communitySlug] });
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
    const path = post.communitySlug ? `/b/${post.communitySlug}/p/${post.id}` : `/p/${post.id}`;
    navigator.clipboard.writeText(window.location.origin + path)
      .then(() => toast.success("Link copied to clipboard!"))
      .catch(() => toast.error("Couldn't copy the link"));
  };

  const postUrl = post.communitySlug ? `/b/${post.communitySlug}/p/${post.id}` : `/p/${post.id}`;

  const authorLinkTarget = post.author?.uid ? `/f/${post.author.username || post.author.name?.replace(/\s+/g, '')}` : "#";
  const authorDisplay = post.author?.username || post.author?.name?.replace(/\s+/g, '') || 'unknown';

  if (post.isDeleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
        className="group flex gap-3 rounded-xl border border-border bg-card p-4 transition-colors"
      >
        {/* Vote rail placeholder */}        <div className="flex flex-col items-center justify-center gap-1.5 py-1 w-8 shrink-0">
          <div className="h-5 w-5 rounded-full text-muted-foreground flex items-center justify-center">^</div>
          <span className="font-heading text-xs font-bold text-muted-foreground">{post.score || 0}</span>
          <div className="h-5 w-5 rounded-full text-muted-foreground flex items-center justify-center">v</div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <PostTypeBadge type={post.type} />
            <span className="text-muted-foreground text-[10px]">•</span>
            <time className="font-body text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</time>
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
          </div>

          <Link href={postUrl} className="block">
            <h3 className="font-display text-base font-semibold text-muted-foreground leading-snug mb-1 transition-colors cursor-pointer line-through opacity-80">
              {post.title}
            </h3>
            <p className="font-body text-sm text-muted-foreground/70 italic line-clamp-2 mb-3 bg-muted/30 p-2 rounded-md">
              This post was removed. Earlier comments remain visible; new replies and votes are closed.
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
              <Link href={postUrl} className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
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
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 8) * 0.05, duration: 0.3 }}
        className={cn(
          "group panel flex gap-3.5 rounded-lg p-3.5 transition-all hover:border-line-strong",
          isFocused && "ring-1 ring-ember border-ember shadow-md shadow-ember/10"
        )}
        data-focused={isFocused ? "true" : undefined}
      >
        {/* ── Vote rail (Agent 2 Ledger style) ── */}
        <div className="flex flex-col items-center justify-start self-start rounded-md bg-sunken px-1 py-1.5 shrink-0 border border-line">
          <VoteControls
            score={post.score || 0}
            entityId={post.id}
            authorUid={post.author?.uid}
            type="post"
            orientation="vertical"
            disabled={!user}
          />
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">

          {/* Meta line: community avatar + name + Join + time */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-3">
            {post.communitySlug ? (
              <>
                <CommunityHoverCard slug={post.communitySlug}>
                  <Link
                    href={`/b/${post.communitySlug}`}
                    className="tag hover:border-ink-3 transition-colors"
                  >
                    <span className="inline-block h-2 w-2 rounded-[2px] bg-ember" aria-hidden="true" />
                    <span className="num normal-case tracking-normal">b/{post.communitySlug}</span>
                  </Link>
                </CommunityHoverCard>
                <span aria-hidden="true">·</span>
                <UserHoverCard handle={authorDisplay}>
                  <Link
                    href={authorLinkTarget}
                    className="inline-flex items-center gap-1 num font-medium text-ink-2 hover:underline"
                  >
                    <span>f/{authorDisplay}</span>
                    <VerifiedBadge isVerified={!!post.author?.isVerifiedPro} size={11} showTooltip={false} />
                  </Link>
                </UserHoverCard>
              </>
            ) : (
              <>
                <UserHoverCard handle={authorDisplay}>
                  <Link
                    href={authorLinkTarget}
                    className="inline-flex items-center gap-1 num font-medium text-ink-2 hover:underline"
                  >
                    <span>f/{authorDisplay}</span>
                    <VerifiedBadge isVerified={!!post.author?.isVerifiedPro} size={11} showTooltip={false} />
                  </Link>
                </UserHoverCard>
                <span aria-hidden="true">·</span>
              </>
            )}

            <time className="num text-ink-3 flex items-center gap-1">
              {formatTimeAgo(post.createdAt)}
              {isVeteran(post.author?.reputation || 0) && (
                <span className="tag tag-gold py-0 px-1 text-[9px] font-bold" title="Veteran">V</span>
              )}
            </time>

            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {post.isPinned && (
                <span className="inline-flex items-center gap-1 text-gold text-xs font-medium">
                  <Pin className="h-3 w-3" /> pinned
                </span>
              )}
              {post.visibility === "members" && (
                <span className="tag">
                  <Users className="h-2.5 w-2.5" /> Members
                </span>
              )}
              {post.visibility === "admins" && (
                <span className="tag tag-danger">
                  <Lock className="h-2.5 w-2.5" /> Space admins
                </span>
              )}
              {post.type !== 'discussion' && <PostTypeBadge type={post.type} />}
            </div>
          </div>

          {/* Title */}
          <Link href={postUrl} className="block group">
            <h3 className="font-heading text-[16px] font-semibold text-ink leading-snug tracking-[-0.01em] group-hover:text-ember transition-colors">
              {post.title}
            </h3>
          </Link>

          {post.externalLink && (
            <a
              href={post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              onClick={(e) => e.stopPropagation()}
              className="mt-1 flex min-w-0 items-center gap-2 rounded-md border border-line bg-sunken px-2.5 py-1 text-[11.5px] transition-colors hover:border-line-strong w-fit max-w-full"
            >
              <ExternalLink size={12} className="shrink-0 text-ink-3" aria-hidden="true" />
              <span className="num truncate font-medium text-verdigris">
                {(() => {
                  try {
                    return new URL(post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`).host;
                  } catch {
                    return post.externalLink;
                  }
                })()}
              </span>
              <span className="num truncate text-ink-3">
                {(() => {
                  try {
                    const u = new URL(post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`);
                    return u.pathname === "/" ? "" : u.pathname;
                  } catch {
                    return "";
                  }
                })()}
              </span>
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
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground">Cancel</button>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !editBody.trim()}
                  className="px-3 py-1 bg-primary text-primary-foreground text-[11px] rounded-radius-md hover:opacity-90 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            !postImages[0] && previewText && (
              <Link href={postUrl} className="block mt-0.5">
                <p className="font-body text-sm text-muted-foreground leading-relaxed line-clamp-2">
                  {previewText}
                </p>
              </Link>
            )
          )}

          {post.type === "poll" && <PollWidget postId={post.id} />}

          {post.tags && post.tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/tag/${tag}`}
                  className="rounded-md border border-border bg-muted/50 px-2.5 py-0.5 font-body text-[10px] font-medium text-muted-foreground hover:border-brand hover:text-brand transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Action footer - Agent 2 Ledger style */}
          <div className="-ml-1.5 mt-2 flex flex-wrap items-center gap-1 border-t border-line/60 pt-2 text-ink-3">
            <Link href={postUrl} className="btn btn-ghost btn-sm text-ink-3 hover:text-ink">
              <MessageSquare className="h-3.5 w-3.5 text-ink-4" />
              <span className="num">{post.commentCount || 0}</span>
            </Link>

            <button onClick={handleShare} aria-label="Share post" className="btn btn-ghost btn-sm text-ink-3 hover:text-ink">
              <Share2 className="h-3.5 w-3.5 text-ink-4" />
              <span>Share</span>
            </button>

            {user && (
              <button
                aria-label={isSaved ? "Unsave post" : "Save post"}
                onClick={(e) => { e.preventDefault(); bookmarkMutation.mutate(); }}
                disabled={bookmarkMutation.isPending}
                className={`btn btn-ghost btn-sm ${isSaved ? 'text-gold' : 'text-ink-3 hover:text-ink'}`}
              >
                <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
                <span>{isSaved ? "Saved" : "Save"}</span>
              </button>
            )}

            {isOwnPost && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="btn btn-ghost btn-sm text-ink-3 hover:text-ink focus:outline-none">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 font-body bg-surface border border-line">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                    <Edit2 className="h-4 w-4 mr-2" />
                    <span>Edit Post</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteMutation.mutate()} className="cursor-pointer text-danger focus:text-danger">
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete Post</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {!isOwnPost && user && (
              <button
                onClick={() => setIsPostReportOpen(true)}
                className="btn btn-ghost btn-sm text-ink-3 hover:text-danger"
                aria-label="Report post"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {user && (
        <ReportDialog
          open={isPostReportOpen}
          onOpenChange={setIsPostReportOpen}
          entityType="post"
          entityId={post.id}
          entityLabel="this post"
        />
      )}
    </>
  );
}

export default PostCard;
