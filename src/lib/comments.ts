import {
  createContentComment,
  deleteContentComment,
  fetchContentComments,
  fetchContentCommentsByAuthor,
  hydrateAuthor,
  hydrateAuthors,
  isContentError,
  updateContentComment,
  type ContentComment,
} from "./content-client";

/**
 * Comments — Neon via `/api/content` (Phase 2D).
 *
 * The embedded `profiles!comments_authorUid_fkey` join is gone; authors are hydrated
 * from the profile endpoint in one batched request, using the public projection, so
 * `role` cannot appear in a comment payload.
 *
 * Threading is unchanged: the server returns a flat list oldest-first and the UI
 * nests replies by `parentId`. `replies` is still attached here so `CommentData` is
 * the same type the components already expect.
 */

export interface CommentData {
  id: string;
  author: string;
  authorUid?: string;
  reputation: number;
  body: string;
  score: number;
  createdAt: number;
  parentId?: string;
  isVerifiedPro?: boolean;
  replies?: CommentData[];
  isDeleted?: boolean;
  isEdited?: boolean;
  avatar?: string | null;
}

async function mapComments(rows: ContentComment[]): Promise<CommentData[]> {
  const authors = await hydrateAuthors(rows.map((row) => row.authorUid));

  return rows.map((row) => {
    const author = authors.get(row.authorUid);
    return {
      id: row.id,
      // A missing profile renders as "Unknown", exactly as the join fallback did.
      author: author?.name || "Unknown",
      authorUid: row.authorUid,
      reputation: author?.reputation ?? 0,
      body: row.body,
      score: row.score,
      createdAt: new Date(row.createdAt).getTime(),
      parentId: row.parentId || undefined,
      isVerifiedPro: author?.isVerifiedPro ?? false,
      isDeleted: row.isDeleted,
      isEdited: row.isEdited,
      avatar: author?.avatarUrl ?? null,
    };
  });
}

export const fetchComments = async (postId: string): Promise<CommentData[]> => {
  const result = await fetchContentComments(postId);
  // A post the viewer cannot see yields no comments — the same result RLS produced,
  // and not an error state the UI would have to explain.
  if (isContentError(result)) {
    if (result.error === "not_found") return [];
    throw new Error("Could not load comments.");
  }
  return mapComments(result.data);
};

export const addComment = async (
  postId: string,
  commentData: Omit<CommentData, "id" | "createdAt" | "score">,
): Promise<string> => {
  // `allowComments`, the deleted state and post visibility are all enforced inside
  // the server transaction (row-locked), so the client no longer pre-reads the post.
  const result = await createContentComment(postId, commentData.body, commentData.parentId);

  if (isContentError(result)) {
    switch (result.error) {
      case "unauthenticated":
        throw new Error("Sign in to join the discussion.");
      case "not_found":
        throw new Error("Post not found or not accessible.");
      case "forbidden":
        throw new Error("You cannot comment on this post.");
      default:
        // The server returns a human-readable reason for the closed-post cases
        // (`comments_closed`, `post_removed`); prefer it over a generic message.
        throw new Error(result.message || "Could not post your comment. Please try again.");
    }
  }

  // `posts.commentCount` is maintained by the server in the same transaction, so
  // there is no client-side counter to keep in sync.
  return result.data.id;
};

export const updateComment = async (_postId: string, commentId: string, body: string) => {
  const result = await updateContentComment(commentId, body);
  if (isContentError(result)) {
    throw new Error(
      result.error === "not_found"
        ? "Comment not found or not editable."
        : "Could not save your edit. Please try again.",
    );
  }
};

export const softDeleteComment = async (_postId: string, commentId: string) => {
  const result = await deleteContentComment(commentId);
  if (isContentError(result)) {
    throw new Error(
      result.error === "not_found"
        ? "Comment not found or not removable."
        : "Could not remove this comment. Please try again.",
    );
  }
};

/**
 * Comments written by one author, for their profile page.
 *
 * The profile argument is kept for call-site compatibility but only its uid is used:
 * the author name now comes from the same batched hydration as everything else, so a
 * stale `displayName` passed by the caller cannot label the wrong person.
 */
export const fetchCommentsByAuthor = async (profile: {
  uid: string;
  username: string;
  displayName: string;
}): Promise<(CommentData & { postId: string })[]> => {
  const result = await fetchContentCommentsByAuthor(profile.uid);
  if (isContentError(result)) {
    if (result.error === "not_found") return [];
    throw new Error("Could not load author comments.");
  }

  const mapped = await mapComments(result.data);
  return mapped.map((comment, index) => ({
    ...comment,
    postId: result.data[index].postId,
  }));
};
