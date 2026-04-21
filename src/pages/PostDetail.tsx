import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Share2, Bookmark } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { VoteControls } from "@/components/VoteControls";
import { PostTypeBadge } from "@/components/PostTypeBadge";
import { mockPosts } from "@/data/mockPosts";

interface Comment {
  id: string;
  author: string;
  reputation: number;
  body: string;
  score: number;
  timeAgo: string;
  replies?: Comment[];
}

const mockComments: Comment[] = [
  {
    id: "c1",
    author: "designkara",
    reputation: 4210,
    body: "This resonates so much. I doubled my rate the moment I picked a niche. Generalist freelancers will always compete on price.",
    score: 34,
    timeAgo: "2h ago",
    replies: [
      {
        id: "c1-1",
        author: "marcelo_dev",
        reputation: 2340,
        body: "Exactly. The niche is the leverage. What was yours?",
        score: 12,
        timeAgo: "1h ago",
        replies: [
          {
            id: "c1-1-1",
            author: "designkara",
            reputation: 4210,
            body: "Brand systems for B2B SaaS. Very specific, very lucrative.",
            score: 8,
            timeAgo: "45m ago",
          },
        ],
      },
    ],
  },
  {
    id: "c2",
    author: "sarah_writes",
    reputation: 890,
    body: "Saving this. I've been on the fence about raising my rates for months.",
    score: 18,
    timeAgo: "3h ago",
  },
];

const CommentThread = ({ comment, depth = 0 }: { comment: Comment; depth?: number }) => (
  <div className={depth > 0 ? "ml-6 pl-4 border-l border-border" : ""}>
    <div className="flex gap-3 py-3">
      <VoteControls score={comment.score} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 font-heading text-[10px] font-bold text-primary">
            {comment.author.charAt(0).toUpperCase()}
          </div>
          <span className="font-body text-xs font-semibold text-foreground">{comment.author}</span>
          <span className="font-body text-[10px] text-muted-foreground">⚡ {comment.reputation}</span>
          <span className="font-body text-[10px] text-muted-foreground">· {comment.timeAgo}</span>
        </div>
        <p className="font-body text-sm text-foreground/90 leading-relaxed mb-1">{comment.body}</p>
        <button className="font-body text-[11px] font-medium text-muted-foreground hover:text-primary">
          Reply
        </button>
      </div>
    </div>
    {depth < 2 && comment.replies?.map((r) => (
      <CommentThread key={r.id} comment={r} depth={depth + 1} />
    ))}
  </div>
);

const PostDetail = () => {
  const { id } = useParams();
  const post = mockPosts.find((p) => p.id === id) ?? mockPosts[0];
  const [newComment, setNewComment] = useState("");

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 mb-4 font-body text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        {/* Post */}
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <div className="flex gap-4">
            <VoteControls score={post.score} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <PostTypeBadge type={post.type} />
                <span className="font-body text-xs text-muted-foreground">{post.timeAgo}</span>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground leading-tight mb-3">
                {post.title}
              </h1>
              <p className="font-body text-sm text-foreground/85 leading-relaxed mb-4 whitespace-pre-line">
                {post.body}
              </p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-secondary px-2 py-0.5 font-body text-[11px] font-medium text-secondary-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 font-heading text-xs font-bold text-primary">
                    {post.author.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-body text-sm font-medium text-foreground">{post.author.name}</span>
                  <span className="font-body text-[11px] text-muted-foreground">⚡ {post.author.reputation}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button className="flex items-center gap-1 rounded-md px-2 py-1 font-body text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {post.commentCount}
                  </button>
                  <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Bookmark className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comment box */}
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
            placeholder="Share your thoughts..."
            className="w-full resize-none rounded-lg bg-background border border-border px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <div className="flex justify-end mt-2">
            <button className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-primary-foreground hover:opacity-90">
              Comment
            </button>
          </div>
        </div>

        {/* Comments */}
        <h2 className="font-heading text-lg font-semibold text-foreground mb-2">
          {post.commentCount} Comments
        </h2>
        <div className="rounded-xl border border-border bg-card px-4">
          {mockComments.map((c) => (
            <CommentThread key={c.id} comment={c} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default PostDetail;
