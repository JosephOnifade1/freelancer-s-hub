/**
 * Browser client for the Neon content API (Phase 2D).
 *
 * Mirrors `profile-client.ts`: thin, no retries, no fallback that reaches into
 * Supabase when Neon is unavailable. A failure surfaces as a typed outcome so the
 * caller decides what to show — silently falling back to the other database would be
 * the dual-read this migration exists to remove.
 *
 * Author hydration is the one piece of logic that lives here rather than on the
 * server, and only because the *client* already holds the profile cache: a feed of 50
 * posts by 12 authors is one `fetchPublicProfiles` call, not 50. The server's post
 * projection deliberately omits author data so the two databases are never joined;
 * this function puts them back together in the browser, where the profile endpoint is
 * already a separate authorized request.
 */
import {
  fetchPublicProfiles,
  isProfileError,
  type UserProfile,
} from "./profile-client";
import { isDemoMode } from "./supabase";
import * as demo from "./content-demo";

export interface ContentPost {
  id: string;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  type: string;
  score: number;
  ups: number;
  downs: number;
  views: number;
  commentCount: number;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  communitySlug: string | null;
  authorUid: string;
  visibility: string;
  allowComments: boolean;
  isPinned: boolean;
  externalLink: string | null;
}

export interface ContentComment {
  id: string;
  body: string;
  score: number;
  createdAt: string;
  parentId: string | null;
  isDeleted: boolean;
  isEdited: boolean;
  authorUid: string;
  postId: string;
}

export interface ContentAttachment {
  id: string;
  postId: string;
  uploaderUid: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export interface ContentPoll {
  id: string;
  postId: string;
  options: { id: string; label: string; position: number; votes: number }[];
  totalVotes: number;
  viewerOptionId: string | null;
}

export type ContentClientError =
  | "unauthenticated"
  | "unavailable"
  | "not_found"
  | "forbidden"
  | "invalid"
  /** 409: a domain conflict the caller should explain (already voted, limit, closed). */
  | "conflict"
  | "error";

export type ContentClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ContentClientError; message?: string };

/** `strictNullChecks` is off, so the `ok` discriminant needs a guard. */
export function isContentError<T>(
  result: ContentClientResult<T>,
): result is { ok: false; error: ContentClientError; message?: string } {
  return result.ok === false;
}

function statusToError(status: number): ContentClientError {
  switch (status) {
    case 400:
      return "invalid";
    case 401:
      return "unauthenticated";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 503:
      return "unavailable";
    default:
      return "error";
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: ContentClientError; message?: string }> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { accept: "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  const body = (await readJson(response)) ?? {};

  if (!response.ok) {
    return {
      ok: false,
      error: statusToError(response.status),
      message: typeof body.message === "string" ? body.message : undefined,
    };
  }

  return { ok: true, body };
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export interface FeedQuery {
  limit?: number;
  before?: string | null;
  community?: string | null;
  author?: string | null;
  type?: string | null;
  tag?: string | null;
  search?: string | null;
}

export async function fetchContentPosts(
  query: FeedQuery = {},
): Promise<ContentClientResult<ContentPost[]>> {
  if (isDemoMode) return demo.demoFetchPosts(query);
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.before) params.set("before", query.before);
  if (query.community) params.set("community", query.community);
  if (query.author) params.set("author", query.author);
  if (query.type) params.set("type", query.type);
  if (query.tag) params.set("tag", query.tag);
  if (query.search) params.set("q", query.search);

  const result = await request(`/api/content/posts?${params.toString()}`);
  if (result.ok === false) return result;

  const posts = result.body.posts as ContentPost[] | undefined;
  if (!Array.isArray(posts)) return { ok: false, error: "error" };
  return { ok: true, data: posts };
}

export async function fetchContentPost(
  postId: string,
): Promise<ContentClientResult<ContentPost | null>> {
  if (isDemoMode) return demo.demoFetchPost(postId);
  const result = await request(`/api/content/posts/${encodeURIComponent(postId)}`);
  if (result.ok === false) {
    // "Not visible" and "does not exist" are both 404 by design.
    if (result.error === "not_found") return { ok: true, data: null };
    return result;
  }
  const post = result.body.post as ContentPost | undefined;
  return { ok: true, data: post ?? null };
}

export interface CreatePostBody {
  title: string;
  body: string;
  category?: string | null;
  tags?: string[];
  type?: string;
  communitySlug?: string | null;
  visibility?: string;
  allowComments?: boolean;
  externalLink?: string | null;
  pollOptions?: string[];
}

export async function createContentPost(
  input: CreatePostBody,
): Promise<ContentClientResult<ContentPost>> {
  if (isDemoMode) return demo.demoCreatePost(input as unknown as Record<string, unknown>);
  const result = await request("/api/content/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (result.ok === false) return result;
  const post = result.body.post as ContentPost | undefined;
  if (!post) return { ok: false, error: "error" };
  return { ok: true, data: post };
}

export async function updateContentPost(
  postId: string,
  body: string,
): Promise<ContentClientResult<null>> {
  if (isDemoMode) return demo.demoUpdatePost(postId, body);
  const result = await request(`/api/content/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

export async function deleteContentPost(
  postId: string,
): Promise<ContentClientResult<null>> {
  if (isDemoMode) return demo.demoDeletePost(postId);
  const result = await request(`/api/content/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE",
  });
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

/**
 * Records a view. Fire-and-forget: a counter is not worth surfacing an error for,
 * which is the behaviour `incrementPostViews` already had (it logged a warning).
 */
export async function recordContentView(postId: string): Promise<void> {
  if (isDemoMode) return demo.demoRecordView(postId);
  try {
    await fetch(`/api/content/posts/${encodeURIComponent(postId)}`, {
      method: "POST",
      headers: { accept: "application/json" },
      keepalive: true,
    });
  } catch {
    // Deliberately ignored — see the comment above.
  }
}

// ─── Comments ───────────────────────────────────────────────────────────────

export async function fetchContentComments(
  postId: string,
): Promise<ContentClientResult<ContentComment[]>> {
  if (isDemoMode) return demo.demoFetchComments(postId);
  const result = await request(
    `/api/content/posts/${encodeURIComponent(postId)}/comments`,
  );
  if (result.ok === false) return result;
  const comments = result.body.comments as ContentComment[] | undefined;
  if (!Array.isArray(comments)) return { ok: false, error: "error" };
  return { ok: true, data: comments };
}

export async function fetchContentCommentsByAuthor(
  authorUid: string,
): Promise<ContentClientResult<ContentComment[]>> {
  if (isDemoMode) return demo.demoFetchCommentsByAuthor(authorUid);
  const result = await request(
    `/api/content/comments?author=${encodeURIComponent(authorUid)}`,
  );
  if (result.ok === false) return result;
  const comments = result.body.comments as ContentComment[] | undefined;
  if (!Array.isArray(comments)) return { ok: false, error: "error" };
  return { ok: true, data: comments };
}

export async function createContentComment(
  postId: string,
  body: string,
  parentId?: string | null,
): Promise<ContentClientResult<ContentComment>> {
  if (isDemoMode) return demo.demoCreateComment(postId, body, parentId);
  const result = await request(
    `/api/content/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body, parentId: parentId ?? null }),
    },
  );
  if (result.ok === false) return result;
  const comment = result.body.comment as ContentComment | undefined;
  if (!comment) return { ok: false, error: "error" };
  return { ok: true, data: comment };
}

export async function updateContentComment(
  commentId: string,
  body: string,
): Promise<ContentClientResult<null>> {
  if (isDemoMode) return demo.demoUpdateComment(commentId, body);
  const result = await request(`/api/content/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

export async function deleteContentComment(
  commentId: string,
): Promise<ContentClientResult<null>> {
  if (isDemoMode) return demo.demoDeleteComment(commentId);
  const result = await request(`/api/content/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

// ─── Votes ──────────────────────────────────────────────────────────────────

export async function fetchOwnVote(
  entityType: "post" | "comment",
  entityId: string,
): Promise<ContentClientResult<number>> {
  if (isDemoMode) return demo.demoFetchOwnVote(entityType, entityId);
  const result = await request(
    `/api/content/votes?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`,
  );
  if (result.ok === false) return result;
  return { ok: true, data: Number(result.body.voteValue ?? 0) };
}

export interface VoteResult {
  status: string;
  voteValue?: number;
  score?: number;
}

export async function submitVote(
  entityType: "post" | "comment",
  entityId: string,
  voteValue: 1 | -1 | 0,
): Promise<ContentClientResult<VoteResult>> {
  if (isDemoMode) return demo.demoSubmitVote(entityType, entityId, voteValue);
  const result = await request("/api/content/votes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entityType, entityId, voteValue }),
  });
  if (result.ok === false) return result;
  return {
    ok: true,
    data: {
      status: String(result.body.status ?? "applied"),
      voteValue: result.body.voteValue === undefined ? undefined : Number(result.body.voteValue),
      score: result.body.score === undefined ? undefined : Number(result.body.score),
    },
  };
}

// ─── Polls ──────────────────────────────────────────────────────────────────

export async function fetchContentPoll(
  postId: string,
): Promise<ContentClientResult<ContentPoll | null>> {
  if (isDemoMode) return demo.demoFetchPoll(postId);
  const result = await request(`/api/content/polls?postId=${encodeURIComponent(postId)}`);
  if (result.ok === false) {
    if (result.error === "not_found") return { ok: true, data: null };
    return result;
  }
  return { ok: true, data: (result.body.poll as ContentPoll | null) ?? null };
}

export async function submitPollVote(
  pollId: string,
  pollOptionId: string,
): Promise<ContentClientResult<{ status: string }>> {
  if (isDemoMode) return demo.demoSubmitPollVote(pollId, pollOptionId);
  const result = await request("/api/content/polls/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pollId, pollOptionId }),
  });
  if (result.ok === false) return result;
  return { ok: true, data: { status: String(result.body.status ?? "voted") } };
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function fetchContentAttachments(
  postId: string,
): Promise<ContentClientResult<ContentAttachment[]>> {
  if (isDemoMode) return demo.demoFetchAttachments(postId);
  const result = await request(
    `/api/content/attachments?postId=${encodeURIComponent(postId)}`,
  );
  if (result.ok === false) return result;
  const attachments = result.body.attachments as ContentAttachment[] | undefined;
  if (!Array.isArray(attachments)) return { ok: false, error: "error" };
  return { ok: true, data: attachments };
}

/** Registers a file that the browser has already uploaded to Supabase Storage. */
export async function registerAttachment(input: {
  postId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<ContentClientResult<ContentAttachment>> {
  if (isDemoMode) return demo.demoRegisterAttachment(input);
  const result = await request("/api/content/attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (result.ok === false) return result;
  const attachment = result.body.attachment as ContentAttachment | undefined;
  if (!attachment) return { ok: false, error: "error" };
  return { ok: true, data: attachment };
}

export async function removeAttachmentRecord(
  attachmentId: string,
): Promise<ContentClientResult<null>> {
  if (isDemoMode) return demo.demoRemoveAttachment(attachmentId);
  const result = await request(
    `/api/content/attachments/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

// ─── Saved posts ────────────────────────────────────────────────────────────

export async function fetchSavedPostIds(): Promise<ContentClientResult<string[]>> {
  if (isDemoMode) return demo.demoSavedPostIds();
  const result = await request("/api/content/saved");
  if (result.ok === false) return result;
  const postIds = result.body.postIds as string[] | undefined;
  return { ok: true, data: Array.isArray(postIds) ? postIds : [] };
}

export async function toggleSavedPost(postId: string): Promise<ContentClientResult<string>> {
  if (isDemoMode) return demo.demoToggleSavedPost(postId);
  const result = await request(`/api/content/saved/${encodeURIComponent(postId)}`, {
    method: "POST",
  });
  if (result.ok === false) return result;
  return { ok: true, data: String(result.body.status ?? "saved") };
}

// ─── Author hydration ───────────────────────────────────────────────────────

/**
 * The author shape `PostData`/`CommentData` already render.
 *
 * Identical to what the embedded `profiles!` join produced, and produced from the
 * **public** profile projection, so `role` and other privileged fields are absent by
 * construction rather than by remembering to delete them.
 */
export interface HydratedAuthor {
  uid: string;
  name: string;
  username?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  reputation: number;
  isVerifiedPro: boolean;
  initial?: string | null;
}

const UNKNOWN_AUTHOR: Omit<HydratedAuthor, "uid"> = {
  name: "Unknown",
  username: undefined,
  avatar: null,
  avatarUrl: null,
  reputation: 0,
  isVerifiedPro: false,
};

export function authorFromProfile(profile: UserProfile | undefined): Omit<HydratedAuthor, "uid"> {
  if (!profile) return { ...UNKNOWN_AUTHOR };
  return {
    name: profile.displayName || profile.username || "Unknown",
    username: profile.username,
    avatar: profile.avatarUrl,
    avatarUrl: profile.avatarUrl,
    reputation: profile.reputation ?? 0,
    isVerifiedPro: profile.isVerifiedPro ?? false,
    initial: profile.initial,
  };
}

/**
 * Hydrates authors for a batch of items in **one** profile request.
 *
 * Returns a map keyed by uid. A failed profile lookup yields an empty map rather than
 * throwing: a feed with a missing author name is still readable, and the alternative
 * is that one deleted profile blanks the whole page. `authorFromProfile(undefined)`
 * supplies the "Unknown" fallback, which is what the join produced when a profile was
 * missing.
 */
export async function hydrateAuthors(
  authorUids: (string | null | undefined)[],
): Promise<Map<string, Omit<HydratedAuthor, "uid">>> {
  const unique = [...new Set(authorUids.filter((uid): uid is string => Boolean(uid)))];

  if (unique.length === 0) return new Map();

  const result = await fetchPublicProfiles(unique);
  if (isProfileError(result)) return new Map();

  const profiles = new Map<string, Omit<HydratedAuthor, "uid">>();
  for (const profile of result.data) {
    profiles.set(profile.uid, authorFromProfile(profile));
  }
  return profiles;
}

/** Hydrates a single author. Thin wrapper so call sites read the same. */
export async function hydrateAuthor(
  authorUid: string | null | undefined,
): Promise<Omit<HydratedAuthor, "uid">> {
  if (!authorUid) return { ...UNKNOWN_AUTHOR };
  const map = await hydrateAuthors([authorUid]);
  return map.get(authorUid) ?? { ...UNKNOWN_AUTHOR };
}

// ─── Administration: roles and verification (Phase 2D §7) ───────────────────

/**
 * Changes a user's global role.
 *
 * The body names the target only; the actor is the verified session, so a caller
 * cannot claim administrator rights it does not have. The server enforces "actor must
 * be an admin" and "an admin cannot demote themselves".
 */
export async function changeUserRole(
  targetUid: string,
  role: "admin" | "moderator" | "member",
): Promise<ContentClientResult<null>> {
  const result = await request("/api/admin/roles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: targetUid, role }),
  });
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

/** Sets Verified Pro. Admin only, target named, actor never sent. */
export async function changeUserVerification(
  targetUid: string,
  verified: boolean,
): Promise<ContentClientResult<null>> {
  const result = await request("/api/admin/verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ uid: targetUid, verified }),
  });
  if (result.ok === false) return result;
  return { ok: true, data: null };
}

// ─── Aggregates and moderation previews ─────────────────────────────────────

export interface ContributorActivity {
  uid: string;
  contributions: number;
}

export async function fetchRecentContributors(days = 7): Promise<ContentClientResult<ContributorActivity[]>> {
  const result = await request(`/api/content/stats?activity=1&days=${days}`);
  if (result.ok === false) return result;
  const contributors = result.body.contributors as ContributorActivity[] | undefined;
  return { ok: true, data: Array.isArray(contributors) ? contributors : [] };
}

export async function fetchContributionDates(
  uid: string,
  days = 90,
): Promise<ContentClientResult<string[]>> {
  const result = await request(
    `/api/content/stats?streak=${encodeURIComponent(uid)}&days=${days}`,
  );
  if (result.ok === false) return result;
  const dates = result.body.dates as string[] | undefined;
  return { ok: true, data: Array.isArray(dates) ? dates : [] };
}

export async function fetchCommunityHealth(): Promise<
  ContentClientResult<{
    postCount: number;
    postsWithReplies: number;
    responses: { postId: string; postedAt: string; firstCommentAt: string | null }[];
  }>
> {
  const result = await request("/api/content/stats?health=1");
  if (result.ok === false) return result;
  const health = result.body.health as {
    postCount: number;
    postsWithReplies: number;
    responses: { postId: string; postedAt: string; firstCommentAt: string | null }[];
  } | undefined;
  if (!health) return { ok: false, error: "error" };
  return { ok: true, data: health };
}

export async function fetchAuthorScores(uid: string): Promise<ContentClientResult<number>> {
  const result = await request(`/api/content/stats?scores=${encodeURIComponent(uid)}`);
  if (result.ok === false) return result;
  return { ok: true, data: Number(result.body.total ?? 0) };
}

export async function fetchAuthorResourceCount(
  uid: string,
): Promise<ContentClientResult<number>> {
  const result = await request(`/api/content/stats?resources=${encodeURIComponent(uid)}`);
  if (result.ok === false) return result;
  return { ok: true, data: Number(result.body.count ?? 0) };
}

export interface ContentPreviews {
  posts: { id: string; title: string; body: string; isDeleted: boolean; authorUid: string }[];
  comments: { id: string; body: string; isDeleted: boolean; authorUid: string }[];
}

export async function fetchContentPreviews(
  postIds: string[],
  commentIds: string[],
): Promise<ContentClientResult<ContentPreviews>> {
  const result = await request("/api/content/previews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ postIds, commentIds }),
  });
  if (result.ok === false) return result;
  return {
    ok: true,
    data: {
      posts: (result.body.posts as ContentPreviews["posts"]) ?? [],
      comments: (result.body.comments as ContentPreviews["comments"]) ?? [],
    },
  };
}
