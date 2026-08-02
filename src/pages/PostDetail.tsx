import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Share2, Bookmark, Loader2, MoreHorizontal, Edit2, Trash2, Eye, ExternalLink, Globe } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { LiveReputation } from "@/components/LiveReputation";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPostById, incrementPostViews, updatePost, softDeletePost } from "@/lib/posts";
import { fetchComments, addComment, updateComment, softDeleteComment, CommentData } from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, toggleBookmark, isVeteran } from "@/lib/users";
import { fetchAllCommunities, getCommunityStyle } from "@/lib/communities";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
import { CommunityHoverCard } from "@/components/CommunityHoverCard";
import { UserHoverCard } from "@/components/UserHoverCard";
import { Editor } from "@/components/editor/Editor";
import { MarkdownRenderer } from "@/components/editor/MarkdownRenderer";
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
    className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2.5 font-body text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
  />
);

// ─── Comment Thread ──────────────────────────────────────────────────────────
const CommentThread = ({ comment, postId, depth = 0 }: { comment: CommentData; postId: string; depth?: number }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  
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
    },
    onError: (e: any) => toast.error(e.message || "Failed to post reply")
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
      toast.success("Comment deleted");
    },
    onError: () => toast.error("Failed to delete comment")
  });

  if (comment.isDeleted) {
    return (
      <div className={`${depth > 0 ? "ml-4 sm:ml-8 pl-4 border-l-2 border-dashed border-primary/20 relative" : ""}`}>
        {depth > 0 && <div className="absolute -left-[2px] top-4 h-4 w-4 border-l-2 border-b-2 border-primary/20 rounded-bl-lg" />}
        <div className="flex gap-3 py-3 opacity-60">
          <div className="w-10 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted font-heading text-[10px] font-bold text-muted-foreground">?</div>
              <span className="font-body text-xs font-semibold text-muted-foreground">Removed</span>
              <span className="font-body text-[10px] text-muted-foreground">· {formatTimeAgo(comment.createdAt)}</span>
            </div>
            <p className="font-body text-sm text-muted-foreground/70 italic leading-relaxed mb-1">
              This insight was removed by the author.
            </p>
          </div>
        </div>
        {comment.replies && comment.replies.map((r) => (
          <CommentThread key={r.id} comment={r} postId={postId} depth={depth + 1} />
        ))}
      </div>
    );
  }

  return (
    <div className={`${depth > 0 ? "ml-4 sm:ml-8 pl-4 border-l-2 border-primary/40 relative" : ""}`}>
      {depth > 0 && <div className="absolute -left-[2px] top-4 h-4 w-4 border-l-2 border-b-2 border-primary/40 rounded-bl-lg" />}
      <div className="flex gap-3 py-3">
        <VoteControls score={comment.score || 0} entityId={comment.id} authorUid={comment.authorUid} type="comment" postIdForComment={postId} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <UserHoverCard handle={comment.author || comment.authorUid || ''} asChild>
                <Link to={comment.authorUid ? `/u/${comment.author || comment.authorUid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-primary/20 text-primary">
                    {comment.author ? comment.author.charAt(0).toUpperCase() : '?'}
                  </div>
                  <span className="font-body text-xs font-semibold text-foreground flex items-center gap-1">
                    u/{comment.author || 'Anonymous'}
                    <VerifiedBadge isVerified={!!(comment as any).isVerifiedPro} size={12} showTooltip={false} />
                  </span>
                  <span className="font-body text-[10px] text-muted-foreground">
                    <LiveReputation uid={comment.authorUid} fallback={comment.reputation || 0} />
                  </span>
                </Link>
              </UserHoverCard>
              <span className="font-body text-[10px] text-muted-foreground flex items-center gap-1">
                · {formatTimeAgo(comment.createdAt)}
                {comment.isEdited && <span className="italic">(edited)</span>}
              </span>
            </div>
            
            {isOwnComment && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus:outline-none">
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
            )}
          </div>
          
          {isEditing ? (
            <div className="mb-2">
              <CommentTextarea value={editBody} onChange={setEditBody} placeholder="Edit your comment..." minRows={3} />
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
            // Plain text display for comments — no markdown rendering
            <p className="font-body text-sm text-foreground/90 leading-relaxed mb-1 whitespace-pre-wrap">
              {comment.body}
            </p>
          )}
          
          <button 
            onClick={() => setIsReplying(!isReplying)}
            className="font-body text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors mt-1"
          >
            {isReplying ? "Cancel" : "Reply"}
          </button>

          {isReplying && (
            <div className="mt-3 bg-card rounded-lg p-3 border border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <CommentTextarea value={replyBody} onChange={setReplyBody} placeholder="Write your reply..." minRows={2} />
              <div className="flex justify-end gap-2 mt-2">
                <button 
                  onClick={() => setIsReplying(false)}
                  className="px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => submitReply.mutate()}
                  disabled={submitReply.isPending || !replyBody.trim()}
                  className="rounded-md bg-primary px-4 py-1.5 font-body text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                >
                  {submitReply.isPending ? "Posting..." : "Reply"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {comment.replies && comment.replies.map((r) => (
        <CommentThread key={r.id} comment={r} postId={postId} depth={depth + 1} />
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
  const [editPostBody, setEditPostBody] = useState("");

  const { data: post, isLoading: loadingPost } = useQuery({
    queryKey: ['post', id],
    queryFn: () => fetchPostById(id as string),
    enabled: !!id
  });

  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['comments', id],
    queryFn: () => fetchComments(id as string),
    enabled: !!id
  });

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user
  });

  const { data: communities = [] } = useQuery<any[]>({
    queryKey: ["communities"],
    queryFn: fetchAllCommunities,
  });

  const community = post?.communitySlug
    ? communities.find((c) => c.slug === post.communitySlug)
    : null;

  const style = community ? getCommunityStyle(community.category) : null;
  const IconComp = style ? style.icon : Globe;

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
      toast.success(nowSaved ? "Saved to your profile" : "Removed from saved posts");
    }
  });

  const updatePostMutation = useMutation({
    mutationFn: async () => updatePost(id as string, editPostBody),
    onSuccess: () => {
      setIsEditingPost(false);
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      toast.success("Post updated");
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async () => softDeletePost(id as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      toast.success("Post deleted");
      navigate('/');
    }
  });

  const submitComment = useMutation({
    mutationFn: async () => {
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
    }
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied!");
  };

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  if (loadingPost) {
    return (
      <AppLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!post) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h2 className="font-heading text-2xl font-bold mb-2">Post not found</h2>
          <Link to="/" className="text-primary hover:underline">Return to feed</Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 mb-4 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {post.isDeleted ? (
          <div className="rounded-xl border border-dashed border-violet-500/50 bg-card p-5 mb-6 shadow-sm opacity-80">
            <div className="flex gap-4">
              <div className="w-8" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <PostTypeBadge type={post.type} />
                  <span className="font-body text-xs text-muted-foreground">{formatTimeAgo(post.createdAt)}</span>
                </div>
                <p className="font-body text-sm text-muted-foreground/70 italic leading-relaxed mb-4 bg-muted/30 p-3 rounded-md">
                  The author has removed this content, but the discussion below remains active.
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted font-heading text-xs font-bold text-muted-foreground">?</div>
                    <span className="font-body text-sm font-medium text-muted-foreground">Original Poster (Removed)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" /> {comments.length}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-5 mb-6 shadow-sm">
            <div className="flex gap-4">
              <VoteControls score={post.score || 0} entityId={post.id} authorUid={post.author?.uid} type="post" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-2 mb-3 border-b border-border/50 pb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {post.communitySlug ? (
                      // Community Post Header
                      <CommunityHoverCard slug={post.communitySlug} asChild>
                        <Link to={`/b/${post.communitySlug}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                          <div className={`flex h-5 w-5 items-center justify-center rounded-md ${style?.iconBg || 'bg-primary/20 text-primary'}`}>
                            {IconComp && <IconComp className="h-3 w-3" />}
                          </div>
                          <span className="font-body text-xs font-semibold text-foreground hover:underline">
                            b/{post.communitySlug}
                          </span>
                        </Link>
                      </CommunityHoverCard>
                    ) : (
                      // Profile Post Header (Space is the user)
                      <UserHoverCard handle={post.author?.username || post.author?.uid || ''} asChild>
                        <Link to={`/u/${post.author?.username || post.author?.uid}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full font-heading text-[10px] font-bold overflow-hidden bg-primary/20 text-primary shrink-0">
                            {post.author?.avatar ? (
                              <img src={post.author.avatar} alt={post.author.name} className="h-full w-full object-cover" />
                            ) : (
                              post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'
                            )}
                          </div>
                          <span className="font-body text-xs font-semibold text-foreground hover:underline flex items-center gap-1">
                            u/{post.author?.username || 'user'}
                            <VerifiedBadge isVerified={!!(post.author as any).isVerifiedPro} size={12} showTooltip={false} />
                          </span>
                        </Link>
                      </UserHoverCard>
                    )}

                    <span className="text-muted-foreground text-xs">•</span>
                    <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                      {formatTimeAgo(post.createdAt)}
                      {post.isEdited && <span className="italic text-[10px]">(edited)</span>}
                    </span>

                    <div className="ml-auto flex items-center gap-2">
                      <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> {post.views || 0}
                      </span>
                      {post.type !== 'discussion' && <PostTypeBadge type={post.type} />}
                    </div>
                  </div>

                  {/* Line 2: Only show author details if it is a community post */}
                  {post.communitySlug && (
                    <div className="flex items-center gap-1.5 pl-6 text-xs text-muted-foreground">
                      <span>Posted by</span>
                      <UserHoverCard handle={post.author?.username || post.author?.uid || ''} asChild>
                        <Link to={`/u/${post.author?.username || post.author?.uid}`} className="flex items-center gap-1 hover:text-foreground font-medium text-foreground transition-colors">
                          <div className="flex h-4 w-4 items-center justify-center rounded-full font-heading text-[8px] font-bold overflow-hidden bg-primary/20 text-primary shrink-0">
                            {post.author?.avatar ? (
                              <img src={post.author.avatar} alt={post.author.name} className="h-full w-full object-cover" />
                            ) : (
                              post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'
                            )}
                          </div>
                          <span>u/{post.author?.username || 'user'}</span>
                          <VerifiedBadge isVerified={!!(post.author as any).isVerifiedPro} size={10} showTooltip={false} />
                        </Link>
                      </UserHoverCard>
                      {isVeteran(post.author?.reputation || 0) && (
                        <span className="text-[var(--brand-primary)] font-bold ml-1" title="Veteran">V</span>
                      )}
                    </div>
                  )}
                </div>
                
                <h1 className="font-heading text-2xl font-bold text-foreground leading-tight mb-3">
                  {post.title}
                </h1>

                {post.externalLink && (
                  <a 
                    href={post.externalLink.startsWith('http') ? post.externalLink : `https://${post.externalLink}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-body text-sm text-primary hover:underline mb-4"
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
                      <button onClick={() => setIsEditingPost(false)} className="px-3 py-1.5 text-sm font-body text-muted-foreground hover:text-foreground">Cancel</button>
                      <button 
                        onClick={() => updatePostMutation.mutate()} 
                        disabled={updatePostMutation.isPending || !editPostBody.trim()}
                        className="px-4 py-1.5 bg-primary text-primary-foreground text-sm font-semibold rounded-md hover:opacity-90 disabled:opacity-50"
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
                    <Link key={tag} to={`/tag/${tag}`} className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground hover:bg-primary/15 hover:text-primary transition-colors">
                      #{tag}
                    </Link>
                  ))}
                </div>
                
                <div className="flex items-center justify-end pt-3 border-t border-border/50 gap-2">
                  <div className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" /> {comments.length}
                  </div>
                  <button onClick={handleShare} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Copy Link">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => bookmarkMutation.mutate()} disabled={bookmarkMutation.isPending} className={`rounded-md p-1.5 transition-colors hover:bg-secondary ${isSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Save Post">
                    <Bookmark className="h-3.5 w-3.5" fill={isSaved ? "currentColor" : "none"} />
                  </button>
                  {isOwnPost && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground focus:outline-none">
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
        )}

        {/* Comment compose — plain textarea, no rich text toolbar */}
        {!post.isDeleted && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6 shadow-sm">
            <p className="font-body text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Leave a comment</p>
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
                className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {submitComment.isPending ? "Posting..." : "Comment"}
              </button>
            </div>
          </div>
        )}

        {/* Comments */}
        <h2 className="font-heading text-lg font-semibold text-foreground mb-3 px-1">
          {comments.length} Comments
        </h2>
        
        {loadingComments ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : commentTree.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No comments yet. Be the first to share your thoughts!</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-4 shadow-sm divide-y divide-border/50 overflow-hidden">
            {commentTree.map((c) => (
              <CommentThread key={c.id} comment={c} postId={id as string} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default PostDetail;
