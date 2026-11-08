import { supabase } from "./supabase";

export interface CommentData {
  id: string;
  author: string;
  authorUid?: string;
  reputation: number;
  body: string;
  score: number;
  createdAt: number;
  parentId?: string;
  replies?: CommentData[];
  isDeleted?: boolean;
  isEdited?: boolean;
}

export const fetchComments = async (postId: string): Promise<CommentData[]> => {
  const { data, error } = await supabase
    .from("comments")
    .select(`
      id, body, score, createdAt, parentId, isDeleted, isEdited, authorUid,
      profiles!comments_authorUid_fkey (username, displayName, reputation)
    `)
    .eq("postId", postId)
    .order("createdAt", { ascending: true });

  if (error || !data) {
    console.warn("Could not fetch comments from Supabase backend:", error?.message || error);
    return [];
  }

  return (data || []).map((c: any) => ({
    id: c.id,
    author: c.profiles?.displayName || c.profiles?.username || "Unknown",
    authorUid: c.authorUid,
    reputation: c.profiles?.reputation || 0,
    body: c.body,
    score: c.score,
    createdAt: new Date(c.createdAt).getTime(),
    parentId: c.parentId,
    isDeleted: c.isDeleted,
    isEdited: c.isEdited,
  }));
};

export const addComment = async (
  postId: string,
  commentData: Omit<CommentData, "id" | "createdAt" | "score">
) => {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      postId,
      authorUid: commentData.authorUid,
      body: commentData.body,
      parentId: commentData.parentId || null,
      score: 0,
      isDeleted: false,
      isEdited: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Increment comment count on post. The comment itself is already saved, so
  // a counter failure is logged loudly rather than reported as a failed post.
  const { error: rpcError } = await supabase.rpc("increment_comment_count", { post_id: postId });
  if (rpcError) console.warn("increment_comment_count failed:", rpcError.message);

  return data?.id as string;
};

export const updateComment = async (postId: string, commentId: string, body: string) => {
  const { error } = await supabase
    .from("comments")
    .update({ body, isEdited: true })
    .eq("id", commentId);
  if (error) throw new Error(error.message);
};

export const softDeleteComment = async (postId: string, commentId: string) => {
  const { error } = await supabase
    .from("comments")
    .update({ isDeleted: true })
    .eq("id", commentId);
  if (error) throw new Error(error.message);
};

export const fetchCommentsByAuthor = async (profile: {
  uid: string;
  username: string;
  displayName: string;
}): Promise<(CommentData & { postId: string })[]> => {
  const { data, error } = await supabase
    .from("comments")
    .select("id, body, score, createdAt, parentId, isDeleted, isEdited, authorUid, postId")
    .eq("authorUid", profile.uid)
    .eq("isDeleted", false)
    .order("createdAt", { ascending: false });

  if (error) return [];

  return (data || []).map((c: any) => ({
    id: c.id,
    author: profile.displayName || profile.username,
    authorUid: c.authorUid,
    reputation: 0,
    body: c.body,
    score: c.score,
    createdAt: new Date(c.createdAt).getTime(),
    parentId: c.parentId,
    isDeleted: c.isDeleted,
    isEdited: c.isEdited,
    postId: c.postId,
  }));
};
