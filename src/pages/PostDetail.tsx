import { useState, useMemo, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Share2, Bookmark, Loader2, CornerDownRight, MoreHorizontal, Edit2, Trash2, Eye, ExternalLink } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { LiveReputation } from "@/components/LiveReputation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPostById, incrementPostViews, updatePost, softDeletePost } from "@/lib/posts";
import { fetchComments, addComment, updateComment, softDeleteComment, CommentData } from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile, toggleBookmark } from "@/lib/users";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";
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
      <div className={depth > 0 ? "ml-6 pl-4 border-l border-dashed border-border/50 relative" : ""}>
        {depth > 0 && <CornerDownRight className="absolute -left-[11px] top-4 h-4 w-4 text-border opacity-50" />}
        <div className="flex gap-3 py-3 opacity-60">
          <div className="w-8" /> {/* Placeholder for missing votes */}
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
    <div className={depth > 0 ? "ml-6 pl-4 border-l border-border/50 relative" : ""}>
      {depth > 0 && <CornerDownRight className="absolute -left-[11px] top-4 h-4 w-4 text-border" />}
      <div className="flex gap-3 py-3">
        <VoteControls score={comment.score || 0} entityId={comment.id} authorUid={comment.authorUid} type="comment" postIdForComment={postId} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Link to={comment.authorUid ? `/profile/${comment.authorUid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 font-heading text-[10px] font-bold text-primary">
                  {comment.author ? comment.author.charAt(0).toUpperCase() : '?'}
                </div>
                <span className="font-body text-xs font-semibold text-foreground">{comment.author || 'Anonymous'}</span>
                <span className="font-body text-[10px] text-muted-foreground">
                  <LiveReputation uid={comment.authorUid} fallback={comment.reputation || 0} />
                </span>
              </Link>
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
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full resize-none rounded-md bg-background border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                rows={2}
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
            <p className="font-body text-sm text-foreground/90 leading-relaxed mb-1 whitespace-pre-line">{comment.body}</p>
          )}
          
          <button 
            onClick={() => setIsReplying(!isReplying)}
            className="font-body text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors mt-1"
          >
            {isReplying ? "Cancel" : "Reply"}
          </button>

          {isReplying && (
            <div className="mt-3 bg-secondary/30 rounded-lg p-3 border border-border">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                rows={2}
                placeholder="Write your reply..."
                className="w-full resize-none rounded-md bg-background border border-border px-3 py-2 font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-shadow"
              />
              <div className="flex justify-end mt-2">
                <button 
                  onClick={() => submitReply.mutate()}
                  disabled={submitReply.isPending || !replyBody.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
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
        <Link to="/" className="inline-flex items-center gap-1 mb-4 font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

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
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <PostTypeBadge type={post.type} />
                    <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                      {formatTimeAgo(post.createdAt)}
                      {post.isEdited && <span className="italic text-[10px]">(edited)</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5" /> {post.views || 0}
                    </span>
                  </div>
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
                
                {isEditingPost ? (
                  <div className="mb-4">
                    <textarea
                      value={editPostBody}
                      onChange={(e) => setEditPostBody(e.target.value)}
                      className="w-full resize-none rounded-md bg-background border border-border px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
                      rows={4}
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
                  <p className="font-body text-sm text-foreground/85 leading-relaxed mb-4 whitespace-pre-line">
                    {post.body}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(post.tags || []).map((tag) => (
                    <Link key={tag} to={`/tag/${tag}`} className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground hover:bg-primary/15 hover:text-primary transition-colors">
                      #{tag}
                    </Link>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <Link to={post.author?.uid ? `/profile/${post.author.uid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 font-heading text-xs font-bold text-primary">
                      {post.author?.name ? post.author.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span className="font-body text-sm font-medium text-foreground">{post.author?.name || 'Anonymous'}</span>
                    <span className="font-body text-[11px] text-muted-foreground">
                      <LiveReputation uid={post.author?.uid} fallback={post.author?.reputation || 0} />
                    </span>
                  </Link>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" /> {comments.length}
                    </div>
                    <button onClick={handleShare} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => bookmarkMutation.mutate()} disabled={bookmarkMutation.isPending} className={`rounded-md p-1.5 transition-colors hover:bg-secondary ${isSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
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
          </div>
        )}

        {/* Comment box */}
        {!post.isDeleted && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6 shadow-sm">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              placeholder="Share your thoughts..."
              className="w-full resize-none rounded-lg bg-background border border-border px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
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
