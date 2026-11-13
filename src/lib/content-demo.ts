/**
 * Demo-mode content backend (Phase 2D).
 *
 * `NEXT_PUBLIC_DEMO_MODE=true` stores everything in the browser: `mockSupabase.ts` is
 * a full in-memory Postgres with an RLS mirror for every table this phase moved. When
 * demo mode is on there is no Neon, no session cookie, and no server route — so
 * `content-client.ts` delegates here instead of calling `/api/content`.
 *
 * Why a separate module rather than `if (isDemoMode)` inside every client function:
 *
 *  - The mock's RLS mirror is the observable behaviour in demo mode, and the tests in
 *    `uxPersistence.test.ts` are written against it. Routing through the same mock
 *    keeps that behaviour byte-for-byte identical instead of reimplementing
 *    authorization a second time in this file.
 *  - `content-client.ts` stays a thin HTTP client for production. A demo branch inside
 *    it would be the "fallback that reaches into Supabase" the migration forbids in
 *    spirit — this one is explicit, and only reachable when the app has no database at
 *    all.
 *
 * This module is **never** used in production: `isDemoMode` is a compile-time constant
 * of the deployment's environment, and the mock client is only constructed when it is
 * true.
 */
import { supabase } from "./supabase";
import type {
  ContentAttachment,
  ContentComment,
  ContentPost,
  ContentPoll,
  ContentClientResult,
  FeedQuery,
} from "./content-client";

/** The mock's error shape, narrowed to what this module maps. */
interface MockError {
  message: string;
  code?: string;
}

function fail<T>(error: MockError | null): ContentClientResult<T> {
  if (!error) return { ok: false, error: "error" };
  const code = (error as { code?: string }).code;
  return {
    ok: false,
    error: code === "23505" ? "conflict" : "error",
    message: error.message,
  };
}

async function currentUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return (data?.session?.user?.id as string | undefined) ?? null;
}

export async function demoFetchPosts(
  query: FeedQuery = {},
): Promise<ContentClientResult<ContentPost[]>> {
  let builder = supabase.from("posts").select("*").eq("isDeleted", false);
  if (query.community) builder = builder.eq("communitySlug", query.community);
  if (query.author) builder = builder.eq("authorUid", query.author);
  if (query.type) builder = builder.eq("type", query.type);

  // The mock applies its own visibility filter on select, so the rows that come back
  // are already the rows this viewer may see — the same contract as the server.
  const { data, error } = await builder.order("createdAt", { ascending: false }).limit(query.limit ?? 100);
  if (error) return fail(error);

  let posts = (data ?? []) as ContentPost[];
  if (query.search) {
    const needle = query.search.toLowerCase();
    posts = posts.filter(
      (post) =>
        String(post.title ?? "").toLowerCase().includes(needle) ||
        String(post.body ?? "").toLowerCase().includes(needle),
    );
  }
  return { ok: true, data: posts.slice(0, query.limit ?? 100) };
}

export async function demoFetchPost(
  postId: string,
): Promise<ContentClientResult<ContentPost | null>> {
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) return fail(error);
  return { ok: true, data: (data as ContentPost | null) ?? null };
}

export async function demoCreatePost(
  input: Record<string, unknown>,
): Promise<ContentClientResult<ContentPost>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("posts")
    .insert({
      ...input,
      authorUid: uid,
      score: 0,
      ups: 0,
      downs: 0,
      views: 0,
      commentCount: 0,
      isDeleted: false,
      isEdited: false,
    })
    .select("*")
    .single();
  if (error) return fail(error);
  const post = data as ContentPost;

  const pollOptions = (input.pollOptions as string[] | undefined) ?? [];
  if (input.type === "poll" && pollOptions.length >= 2) {
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({ postId: post.id })
      .select("id")
      .single();
    if (!pollError && poll?.id) {
      await supabase.from("poll_options").insert(
        pollOptions.map((label, position) => ({ pollId: poll.id, label, position })),
      );
    }
  }

  return { ok: true, data: post };
}

export async function demoUpdatePost(
  postId: string,
  body: string,
): Promise<ContentClientResult<null>> {
  const { data, error } = await supabase
    .from("posts")
    .update({ body, isEdited: true })
    .eq("id", postId)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}

export async function demoDeletePost(
  postId: string,
): Promise<ContentClientResult<null>> {
  const { data, error } = await supabase
    .from("posts")
    .update({ isDeleted: true })
    .eq("id", postId)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}

export async function demoRecordView(postId: string): Promise<void> {
  await supabase.rpc("increment_post_views", { post_id: postId });
}

export async function demoFetchComments(
  postId: string,
): Promise<ContentClientResult<ContentComment[]>> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("postId", postId)
    .order("createdAt", { ascending: true });
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as ContentComment[] };
}

export async function demoFetchCommentsByAuthor(
  authorUid: string,
): Promise<ContentClientResult<ContentComment[]>> {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("authorUid", authorUid)
    .eq("isDeleted", false)
    .order("createdAt", { ascending: false });
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as ContentComment[] };
}

export async function demoCreateComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<ContentClientResult<ContentComment>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  // The mock enforces `allowComments`, the deleted state and reply-parent integrity
  // exactly where the real trigger does, so the preflight is not duplicated here.
  const { data, error } = await supabase
    .from("comments")
    .insert({ postId, authorUid: uid, body, parentId: parentId || null, score: 0, isDeleted: false, isEdited: false })
    .select("*")
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as ContentComment };
}

export async function demoUpdateComment(
  commentId: string,
  body: string,
): Promise<ContentClientResult<null>> {
  const { error } = await supabase
    .from("comments")
    .update({ body, isEdited: true })
    .eq("id", commentId);
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function demoDeleteComment(
  commentId: string,
): Promise<ContentClientResult<null>> {
  const { error } = await supabase
    .from("comments")
    .update({ isDeleted: true })
    .eq("id", commentId);
  if (error) return fail(error);
  return { ok: true, data: null };
}

export async function demoFetchOwnVote(
  entityType: "post" | "comment",
  entityId: string,
): Promise<ContentClientResult<number>> {
  const uid = await currentUid();
  if (!uid) return { ok: true, data: 0 };
  const { data, error } = await supabase
    .from("votes")
    .select("voteValue")
    .eq("userId", uid)
    .eq("entityType", entityType)
    .eq("entityId", entityId)
    .maybeSingle();
  if (error) return fail(error);
  return { ok: true, data: Number((data as { voteValue?: number } | null)?.voteValue ?? 0) };
}

export async function demoSubmitVote(
  entityType: "post" | "comment",
  entityId: string,
  voteValue: 1 | -1 | 0,
): Promise<ContentClientResult<{ status: string }>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  // The mock implements the hardened `cast_vote` semantics, including the self-vote
  // and visibility refusals, so the same error strings surface in demo mode.
  const { error } = await supabase.rpc("cast_vote", {
    entity_id: entityId,
    entity_type: entityType,
    voter_uid: uid,
    new_vote: voteValue,
  });
  if (error) {
    const message = error.message ?? "";
    if (/own content/i.test(message)) {
      return { ok: false, error: "forbidden", message: "You cannot vote on your own content" };
    }
    if (/deleted/i.test(message)) return { ok: false, error: "conflict", message };
    if (/not authorized|not visible/i.test(message)) {
      return { ok: false, error: "not_found", message };
    }
    return fail(error);
  }
  return { ok: true, data: { status: "applied" } };
}

export async function demoFetchPoll(
  postId: string,
): Promise<ContentClientResult<ContentPoll | null>> {
  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .select("id")
    .eq("postId", postId)
    .maybeSingle();
  if (pollError) return fail(pollError);
  if (!poll) return { ok: true, data: null };

  const pollId = (poll as { id: string }).id;

  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, label, position")
    .eq("pollId", pollId)
    .order("position", { ascending: true });
  if (optionsError) return fail(optionsError);

  const { data: votes, error: votesError } = await supabase
    .from("poll_votes")
    .select("pollOptionId, userId")
    .eq("pollId", pollId);
  if (votesError) return fail(votesError);

  const uid = await currentUid();
  const counts: Record<string, number> = {};
  let viewerOptionId: string | null = null;
  for (const vote of (votes ?? []) as { pollOptionId: string; userId: string }[]) {
    counts[vote.pollOptionId] = (counts[vote.pollOptionId] ?? 0) + 1;
    if (uid && vote.userId === uid) viewerOptionId = vote.pollOptionId;
  }

  const mapped = ((options ?? []) as { id: string; label: string; position: number }[]).map(
    (option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      votes: counts[option.id] ?? 0,
    }),
  );

  return {
    ok: true,
    data: {
      id: pollId,
      postId,
      options: mapped,
      totalVotes: mapped.reduce((sum, option) => sum + option.votes, 0),
      viewerOptionId,
    },
  };
}

export async function demoSubmitPollVote(
  pollId: string,
  pollOptionId: string,
): Promise<ContentClientResult<{ status: string }>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { error } = await supabase
    .from("poll_votes")
    .insert({ pollId, pollOptionId, userId: uid });
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return { ok: true, data: { status: "already_voted" } };
    }
    return fail(error);
  }
  return { ok: true, data: { status: "voted" } };
}

export async function demoFetchAttachments(
  postId: string,
): Promise<ContentClientResult<ContentAttachment[]>> {
  const { data, error } = await supabase
    .from("post_attachments")
    .select("*")
    .eq("postId", postId)
    .order("createdAt", { ascending: true });
  if (error) return fail(error);
  return { ok: true, data: (data ?? []) as ContentAttachment[] };
}

export async function demoRegisterAttachment(input: {
  postId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<ContentClientResult<ContentAttachment>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("post_attachments")
    .insert({ ...input, uploaderUid: uid })
    .select("*")
    .single();
  if (error) return fail(error);
  return { ok: true, data: data as ContentAttachment };
}

export async function demoRemoveAttachment(
  attachmentId: string,
): Promise<ContentClientResult<null>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { data, error } = await supabase
    .from("post_attachments")
    .delete()
    .eq("id", attachmentId)
    .eq("uploaderUid", uid)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "not_found" };
  return { ok: true, data: null };
}

export async function demoSavedPostIds(): Promise<ContentClientResult<string[]>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };
  const { data, error } = await supabase.from("saved_posts").select("postId").eq("userId", uid);
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as { postId: string }[]).map((row) => row.postId) };
}

export async function demoToggleSavedPost(
  postId: string,
): Promise<ContentClientResult<string>> {
  const uid = await currentUid();
  if (!uid) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: lookupError } = await supabase
    .from("saved_posts")
    .select("postId")
    .eq("userId", uid)
    .eq("postId", postId)
    .maybeSingle();
  if (lookupError) return fail(lookupError);

  if (existing) {
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("userId", uid)
      .eq("postId", postId);
    if (error) return fail(error);
    return { ok: true, data: "removed" };
  }

  const { error } = await supabase.from("saved_posts").insert({ userId: uid, postId });
  if (error) return fail(error);
  return { ok: true, data: "saved" };
}
