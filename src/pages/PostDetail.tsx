import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Share2, Bookmark, Loader2, CornerDownRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { LiveReputation } from "@/components/LiveReputation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPostById } from "@/lib/posts";
import { fetchComments, addComment, CommentData } from "@/lib/comments";
import { useAuth } from "@/hooks/useAuth";
import { getUserProfile } from "@/lib/users";
import { formatTimeAgo } from "@/lib/utils";
import { toast } from "sonner";


const buildCommentTree = (flatComments: CommentData[]) => {
  const map = new Map<string, CommentData & { replies: CommentData[] }>();
  const roots: (CommentData & { replies: CommentData[] })[] = [];

  // Initialize
  flatComments.forEach((c) => map.set(c.id, { ...c, replies: [] }));

  // Build tree
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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: () => user ? getUserProfile(user.uid) : null,
    enabled: !!user
  });

  const submitReply = useMutation({
    mutationFn: async () => {
      if (!postId || !user || !profile || !replyBody.trim()) {
        throw new Error("Missing required data");
      }
      await addComment(postId, {
        author: profile.username || "Anonymous",
        authorUid: user.uid,
        reputation: profile.reputation || 0,
        body: replyBody.trim(),
        parentId: comment.id // Link it to the parent
      });
    },
    onSuccess: () => {
      setReplyBody("");
      setIsReplying(false);
      toast.success("Reply posted!");
      queryClient.invalidateQueries({ queryKey: ['comments', postId] });
    },
    onError: (e: any) => {
      toast.error(e.message || "Failed to post reply");
    }
  });

  return (
    <div className={depth > 0 ? "ml-6 pl-4 border-l border-border/50 relative" : ""}>
      {depth > 0 && (
        <CornerDownRight className="absolute -left-[11px] top-4 h-4 w-4 text-border" />
      )}
      <div className="flex gap-3 py-3">
        <VoteControls 
          score={comment.score || 0} 
          entityId={comment.id} 
          authorUid={comment.authorUid}
          type="comment"
          postIdForComment={postId}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link to={comment.authorUid ? `/profile/${comment.authorUid}` : "#"} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 font-heading text-[10px] font-bold text-primary">
                {comment.author ? comment.author.charAt(0).toUpperCase() : '?'}
              </div>
              <span className="font-body text-xs font-semibold text-foreground">{comment.author || 'Anonymous'}</span>
              <span className="font-body text-[10px] text-muted-foreground">
                <LiveReputation uid={comment.authorUid} fallback={comment.reputation || 0} />
              </span>
            </Link>
            <span className="font-body text-[10px] text-muted-foreground">· {formatTimeAgo(comment.createdAt)}</span>
          </div>
          <p className="font-body text-sm text-foreground/90 leading-relaxed mb-1 whitespace-pre-line">{comment.body}</p>
          
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
      
      {/* Nested Replies */}
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
  const [newComment, setNewComment] = useState("");

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

  const submitComment = useMutation({
    mutationFn: async () => {
      if (!id || !user || !profile || !newComment.trim()) {
        throw new Error("Missing required data");
      }
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
    },
    onError: () => {
      toast.error("Failed to post comment");
    }
  });

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
        <Link
          to="/"
          className="inline-flex items-center gap-1 mb-4 font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        {/* Post */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6 shadow-sm">
          <div className="flex gap-4">
            <VoteControls score={post.score || 0} entityId={post.id} authorUid={post.author?.uid} type="post" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <PostTypeBadge type={post.type} />
                <span className="font-body text-xs text-muted-foreground">
                  {formatTimeAgo(post.createdAt)}
                </span>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground leading-tight mb-3">
                {post.title}
              </h1>
              <p className="font-body text-sm text-foreground/85 leading-relaxed mb-4 whitespace-pre-line">
                {post.body}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(post.tags || []).map((tag) => (
                  <Link
                    key={tag}
                    to={`/tag/${tag}`}
                    className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                  >
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
                    <MessageSquare className="h-3.5 w-3.5" />
                    {comments.length}
                  </div>
                  <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                    <Bookmark className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comment box */}
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
