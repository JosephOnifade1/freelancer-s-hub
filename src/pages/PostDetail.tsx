import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Share2, Bookmark, Loader2, MoreHorizontal, Edit2, Trash2, Eye, ExternalLink, Flag } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPostById, incrementPostViews, updatePost, softDeletePost } from "@/lib/posts";
import { fetchComments, addComment, updateComment, softDeleteComment, CommentData } from "@/lib/comments";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile, toggleBookmark } from "@/lib/users";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { Editor } from "@/components/editor/Editor";
import { MarkdownRenderer } from "@/components/editor/MarkdownRenderer";
import { ReportDialog } from "@/components/ReportDialog";
import { QueryErrorState } from "@/components/QueryErrorState";
import { PostAttachments } from "@/components/PostAttachments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const buildCommentTree = (flatComments: CommentData[]) => {
  const map = new Map<string, CommentData & { replies: CommentData[] }>();
  const roots: (CommentData & { replies: CommentData[] })[] = [];

  flatComments.forEach((c) => map.set(c.id, { ...c, replies: [] }));

  flatComments.forEach((c) => {
    const node = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

// ─── Plain-text comment textarea ─────────────────────────────────────────────
const CommentTextarea = ({
  value,
  onChange,
  placeholder = "Share your thoughts...",
  minRows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={minRows}
    className="w-full resize-none rounded-radius-md border border-border bg-card px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/20 transition-all"
  />
);

// ─── Comment Thread ──────────────────────────────────────────────────────────
const CommentThread = ({ comment, postId, depth = 0, commentsEnabled = true, votesEnabled = true }: { comment: CommentData; postId: string; depth?: number; commentsEnabled?: boolean; votesEnabled?: boolean }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isCommentReportOpen, setIsCommentReportOpen] = useState(false);

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isOwnComment = user?.uid === comment.authorUid;

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user
  });

  const submitReply = useMutation({
    mutationFn: async () => {
      if (!commentsEnabled) throw new Error("Replies are closed for this post.");
      if (!postId || !user || !profile || !replyBody.trim()) throw new Error("Missing data");
      await addComment(postId, {
        author: profile.username || "Anonymous",
        authorUid: user.uid,
        reputation: profile.reputation || 0,
        body: replyBody.trim(),
        parentId: comment.id
      });
    },
    onSuccess: () => {
      setReplyBody("");
      setIsReplying(false);
      toast.success("Reply posted!");
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to post reply")
  });

  const updateMutation = useMutation({
    mutationFn: async () => updateComment(postId, comment.id, editBody),
    onSuccess: () => {
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      toast.success("Comment updated");
    },
    onError: () => toast.error("Failed to update comment")
  });

  const deleteMutation = useMutation({
    mutationFn: async () => softDeleteComment(postId, comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment")
  });

  if (comment.isDeleted) {
    return (
      <div className={`${depth > 0 ? "ml-4 sm:ml-8 pl-4 border-l-2 border-dashed border-brand/20 relative" : ""}`}>
        {depth > 0 && <div className="absolute -left-[2px] top-4 h-4 w-4 border-l-2 border-b-2 border-brand/20 rounded-bl-lg" />}
        <div className="flex gap-3 py-3 opacity-60">
          <div className="w-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-heading text-[10px] font-bold text-muted-foreground">?</div>
              <span className="font-body text-xs font-semibold text-muted-foreground">Removed</span>
              <span className="font-body text-[10px] text-muted-foreground">· {formatTimeAgo(comment.createdAt)}</span>
            </div>
            <p className="font-body text-sm text-muted-foreground/70 italic leading-relaxed mb-1">
              This comment was removed.
            </p>
          </div>
        </div>
        {comment.replies && comment.replies.map((r) => (
          <CommentThread key={r.id} comment={r} postId={postId} depth={depth + 1} commentsEnabled={commentsEnabled} votesEnabled={votesEnabled} />
        ))}
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? "ml-4 sm:ml-8 pl-4 border-l-2 border-brand/40 relative" : ""}`}>
      {depth > 0 && <div className="absolute -left-[2px] top-4 h-4 w-4 border-l-2 border-b-2 border-brand/40 rounded-bl-lg" />}
      <div className="flex gap-3 py-3">
        <VoteControls score={comment.score || 0} entityId={comment.id} authorUid={comment.authorUid} type="comment" postIdForComment={postId} disabled={!votesEnabled} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link to={comment.authorUid ? `/f/${comment.author || comment.authorUid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="flex h-5 w-5 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-muted text-foreground">
                  {comment.author ? comment.author.charAt(0).toUpperCase() : '?'}
                </div>
                <span className="font-body text-xs font-semibold text-foreground flex items-center gap-1">
                  {comment.author || 'Anonymous'}
                  <VerifiedBadge isVerified={!!comment.isVerifiedPro} size={12} showTooltip={false} />
                </span>
                <span className="font-body text-[10px] text-muted-foreground">
                  <LiveReputation uid={comment.authorUid} fallback={comment.reputation || 0} />
                </span>
              </Link>
              <span className="font-body text-[10px] text-muted-foreground flex items-center gap-1">
                · {formatTimeAgo(comment.createdAt)}
                {comment.isEdited && <span className="italic">(edited)</span>}
              </span>
            </div>

            {isOwnComment ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-radius-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus:outline-none">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 font-body">
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="cursor-pointer">
                    <Edit2 className="h-4 w-4 mr-2" />
                    <span>Edit</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => deleteMutation.mutate()} className="cursor-pointer text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : user && (
                <button
                onClick={() => setIsCommentReportOpen(true)}
                className="rounded-radius-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-brand focus:outline-none"
                aria-label="Report comment"
              >
                <Flag className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {user && (
            <ReportDialog
              open={isCommentReportOpen}
              onOpenChange={setIsCommentReportOpen}
              entityType="comment"
              entityId={comment.id}
              entityLabel="this comment"
            />
          )}

          {isEditing ? (
            <div className="mb-2">
              <CommentTextarea value={editBody} onChange={setEditBody} placeholder="Edit your comment..." minRows={3} />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setIsEditing(false)} className="px-3 py-1 text-[10px] font-mono text-muted-foreground hover:text-foreground">Cancel</button>
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !editBody.trim()}
                  className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-mono font-semibold rounded-radius-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            // Plain text display for comments — no markdown rendering
            <p className="font-body text-sm text-foreground/90 leading-relaxed mb-1 whitespace-pre-wrap">
              {comment.body}
            </p>
          )}

          {commentsEnabled && (
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="font-body text-[11px] font-medium text-muted-foreground hover:text-brand transition-colors mt-1"
            >
              {isReplying ? "Cancel" : "Reply"}
            </button>
          )}

          {commentsEnabled && isReplying && (
            <div className="mt-3 bg-card rounded-radius-md p-3 border border-brand/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <CommentTextarea value={replyBody} onChange={setReplyBody} placeholder="Write your reply..." minRows={2} />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsReplying(false)}
                  className="px-3 py-1.5 font-body text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => submitReply.mutate()}
                  disabled={submitReply.isPending || !replyBody.trim()}
                  className="rounded-radius-md bg-primary px-4 py-1.5 font-body text-[10px] font-mono font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {submitReply.isPending ? "Posting..." : "Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.map((r) => (
        <CommentThread key={r.id} comment={r} postId={postId} depth={depth + 1} commentsEnabled={commentsEnabled} votesEnabled={votesEnabled} />
      ))}
    </div>
  );
};

const PostDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [newComment, setNewComment] = useState("");
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editPostBody, setEditPostBody] = useState("");

  const { data: post, isLoading: loadingPost, isError: postError, refetch: refetchPost } = useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPostById(id as string),
    enabled: !!id
  });

  const { data: comments = [], isLoading: loadingComments, isError: commentsError, refetch: refetchComments } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => fetchComments(id as string),
    enabled: !!id
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user
  });

  // Track views
  useEffect(() => {
    if (id) {
      incrementPostViews(id);
    }
  }, [id]);

  useEffect(() => {
    if (post) {
      setEditPostBody(post.body);
    }
  }, [post]);

  const isSaved = profile?.savedPosts?.[id || ""] === true;
  const isOwnPost = user?.uid === post?.author?.uid;

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error("Please log in");
      return toggleBookmark(user.uid, id);
    },
    onSuccess: (nowSaved) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.uid] });
      queryClient.invalidateQueries({ queryKey: ['savedPosts', user?.uid] });
      toast.success(nowSaved ? "Saved to your bookmarks" : "Removed from bookmarks");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update bookmark")
  });

  const updatePostMutation = useMutation({
    mutationFn: async () => updatePost(id as string, editPostBody),
    onSuccess: () => {
      setIsEditingPost(false);
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      if (post?.communitySlug) queryClient.invalidateQueries({ queryKey: ['communityPosts', post.communitySlug] });
      toast.success("Post updated");
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update post")
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => softDeletePost(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      if (post?.communitySlug) queryClient.invalidateQueries({ queryKey: ['communityPosts', post.communitySlug] });
      toast.success("Post deleted");
      navigate('/');
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete post")
  });

  const submitComment = useMutation({
    mutationFn: async () => {
      if (!commentsEnabled) throw new Error("Comments are closed for this post.");
      if (!id || !user || !profile || !newComment.trim()) throw new Error("Missing required data");
      await addComment(id, {
        author: profile.username || "Anonymous",
        authorUid: user.uid,
        reputation: profile.reputation || 0,
        body: newComment.trim()
      });
    },
    onSuccess: () => {
      setNewComment("");
      toast.success("Comment posted!");
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['communityPosts'] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to post comment")
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);
  const activeCommentCount = useMemo(() => comments.filter((c) => !c.isDeleted).length, [comments]);
  // A removed post is frozen: no new comments/replies and no comment votes.
  // Comments-off only blocks new comments — existing votes still count.
  const commentsEnabled = !!user && !!post && !post.isDeleted && post.allowComments !== false;
  const votesEnabled = !!user && !!post && !post.isDeleted;

  if (loadingPost) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (postError) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-12">
          <QueryErrorState
            title="Couldn't load this post"
            message="The post may exist, but the backend didn't answer. Try again in a moment."
            onRetry={() => refetchPost()}
          />
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Post not found</h2>
          <Link to="/" className="text-brand hover:underline">Return to feed</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 mb-6 font-body text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {post.isDeleted ? (
          <div className="rounded-2xl border border-dashed border-brand/50 bg-card p-5 mb-6 shadow-sm opacity-80">
            <div className="flex gap-4">
              <div className="w-8" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <PostTypeBadge type={post.type} />
                  <span className="font-body text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</span>
                </div>
                <p className="font-body text-sm text-muted-foreground/70 italic leading-relaxed mb-4 bg-muted/30 p-3 rounded-md">
                  This post was removed. Earlier comments remain visible, but replies and votes are closed.
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-heading text-xs font-bold text-muted-foreground">?</div>
                    <span className="font-body text-sm font-medium text-muted-foreground">Removed post</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" /> {commentsError || loadingComments ? post.commentCount : activeCommentCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 mb-6 shadow-sm">
            <div className="flex gap-4">
              <VoteControls score={post.score || 0} entityId={post.id} authorUid={post.author?.uid} type="post" disabled={!user} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PostTypeBadge type={post.type} />
                    <span className="font-body text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      {formatTimeAgo(post.createdAt)}
                      {post.isEdited && <span className="italic">(edited)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {post.views || 0}
                    </span>
                  </div>
                </div>

                <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight mb-3">
                  {post.title}
                </h1>

                {post.externalLink && (
                  <a
                    href={post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-body text-[11px] font-mono text-brand hover:underline mb-4"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Visit External Resource
                  </a>
                )}

                {/* Post edit uses the full rich text editor — appropriate for post body */}
                {isEditingPost ? (
                  <div className="mb-4">
                    <Editor
                      value={editPostBody}
                      onChange={setEditPostBody}
                      placeholder="Edit your post..."
                      minHeight="200px"
                      className="mb-4"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setIsEditingPost(false)} className="px-3 py-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground">Cancel</button>
                      <button
                        onClick={() => updatePostMutation.mutate()}
                        disabled={updatePostMutation.isPending || !editPostBody.trim()}
                        className="px-4 py-1.5 bg-primary text-primary-foreground text-[11px] font-mono font-semibold rounded-radius-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {updatePostMutation.isPending ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* MarkdownRenderer ONLY for the post body */
                  <MarkdownRenderer content={post.body} className="mb-4" />
                )}

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(post.tags || []).map((tag) => (
                    <Link key={tag} to={`/tag/${tag}`} className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-body text-[11px] font-medium text-muted-foreground hover:border-brand hover:text-brand transition-colors">
                      #{tag}
                    </Link>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <Link to={post.author?.uid ? `/f/${post.author.uid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-muted text-foreground">
                      {post.author?.avatar ? (
                        <img src={post.author.avatar} alt={post.author.name} className="h-full w-full object-cover" />
                      ) : (
                        post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'
                      )}
                    </div>
                    <span className="font-body text-sm font-medium text-foreground flex items-center gap-1">
                      {post.author?.name || 'Anonymous'}
                      <VerifiedBadge isVerified={!!post.author?.isVerifiedPro} size={14} showTooltip={false} />
                    </span>
                    <span className="font-body text-[10px] font-mono text-muted-foreground">
                      <LiveReputation uid={post.author?.uid} fallback={post.author?.reputation || 0} />
                    </span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 rounded-radius-md px-2 py-1 font-body text-[10px] font-mono text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" /> {commentsError || loadingComments ? post.commentCount : activeCommentCount}
                    </div>
                    <button onClick={handleShare} className="rounded-radius-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-brand transition-colors">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    {user && <button
                      type="button"
                      aria-label={isSaved ? "Remove bookmark" : "Bookmark post"}
                      onClick={() => bookmarkMutation.mutate()}
                      disabled={bookmarkMutation.isPending}
                      className={`rounded-radius-md p-1.5 transition-colors hover:bg-muted/50 ${isSaved ? 'text-warning' : 'text-muted-foreground hover:text-warning'}`}
                    >
                      <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
                    </button>}
                    {user && !isOwnPost && (
                      <button onClick={() => setIsReportOpen(true)} title="Report this post" className="rounded-radius-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-brand transition-colors">
                        <Flag className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isOwnPost && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label="Post actions" className="rounded-radius-md p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus:outline-none">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 font-body">
                          <DropdownMenuItem onClick={() => setIsEditingPost(true)} className="cursor-pointer">
                            <Edit2 className="h-4 w-4 mr-2" />
                            <span>Edit Post</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deletePostMutation.mutate()} className="cursor-pointer text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            <span>Delete Post</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!post.isDeleted && <PostAttachments postId={post.id} canUpload={!!isOwnPost} />}

        {!user && !post.isDeleted && post.allowComments !== false && <div className="mb-6 rounded-2xl border border-border bg-card p-4 text-center font-body text-sm text-muted-foreground">
          <Link to="/login" state={{ from: { pathname: window.location.pathname } }} className="font-medium text-brand hover:underline">Sign in</Link> to comment, vote or save this post.
        </div>}

        {/* Comment compose — blocked entirely when the author turned
            comments off (enforced in comments.ts + RLS as well) */}
        {!post.isDeleted && post.allowComments === false && (
          <div className="rounded-2xl border border-border bg-card p-4 mb-6 text-center shadow-sm">
            <p className="font-body text-sm font-medium text-foreground">Comments are turned off for this post</p>
            <p className="mt-1 text-[10px] font-mono text-muted-foreground">
              Existing comments stay visible, but new comments and replies are disabled.
            </p>
          </div>
        )}
        {user && !post.isDeleted && post.allowComments !== false && (
          <div className="rounded-2xl border border-border bg-card p-4 mb-6 shadow-sm">
            <p className="font-body text-[10px] font-mono font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Leave a comment</p>
            <CommentTextarea
              value={newComment}
              onChange={setNewComment}
              placeholder="Share your thoughts..."
              minRows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={() => submitComment.mutate()}
                disabled={submitComment.isPending || !newComment.trim()}
                className="rounded-radius-md bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitComment.isPending ? "Posting..." : "Comment"}
              </button>
            </div>
          </div>
        )}

        {/* Comments */}
        <h2 className="font-display text-lg font-semibold text-foreground mb-3 px-1">
          {commentsError || loadingComments ? "Comments" : `${activeCommentCount} Comments`}
        </h2>

        {commentsError ? (
          <QueryErrorState
            title="Couldn't load comments"
            message="Comments couldn't be loaded right now. Try again in a moment."
            onRetry={() => refetchComments()}
          />
        ) : loadingComments ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : commentTree.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="font-body text-sm text-muted-foreground">
              {post.isDeleted
                ? "No comments are available for this removed post."
                : post.allowComments === false
                  ? "No comments yet — and new comments are turned off for this post."
                  : user ? "No comments yet. Be the first to share your thoughts!" : "No comments yet. Sign in to start the discussion."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-4 shadow-sm divide-y divide-border/50 overflow-hidden">
            {commentTree.map((c) => (
              <CommentThread key={c.id} comment={c} postId={id as string} commentsEnabled={commentsEnabled} votesEnabled={votesEnabled} />
            ))}
          </div>
        )}
      </div>

      {post && (
        <ReportDialog
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          entityType="post"
          entityId={post.id}
          entityLabel="this post"
        />
      )}
    </AppLayout>
  );
};

export default PostDetail;
