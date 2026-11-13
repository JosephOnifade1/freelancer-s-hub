import "server-only";
import {verifyUploadedDocument,signDocument} from "@/server/storage/documents";
import { communityFacts } from "../social/social-queries";

import { sql } from "drizzle-orm";

import { getDatabase, isDatabaseConfigured } from "@/server/db";
import { getServerSession } from "@/lib/server-session";

import {
  anonymousViewer,
  canViewPost,
  isStaff,
  type ContentViewer,
} from "./authorization";
import {
  castVote,
  countResourcesByAuthor,
  findCommunityHealthInputs,
  findContentPreviews,
  findContributionDates,
  findRecentContributors,
  sumScoresForAuthor,
  createAttachment,
  createComment,
  createPost,
  findAttachmentsForViewer,
  findAttachmentForViewer,
  findCommentsByAuthor,
  findCommentsForViewer,
  findPollForViewer,
  findPostForViewer,
  findPosts,
  findSavedPostIds,
  findVoteValue,
  incrementPostViews,
  removeAttachment,
  setUserRole,
  setUserVerifiedPro,
  softDeleteComment,
  softDeletePost,
  toggleSavedPost,
  updateCommentBody,
  updatePostBody,
  votePollOption,
  type AttachmentInput,
  type CreateCommentInput,
  type CreatePostInput,
  type FeedOptions,
} from "./content-queries";

/**
 * Server-only content services (Phase 2D).
 *
 * The single place where a browser-visible request becomes a Neon content query.
 * Every function here resolves the viewer the same way, and that is the whole point
 * of the file existing:
 *
 *   1. `getServerSession()` verifies the Supabase cookie. The uid is never read from
 *      a request body or query string.
 *   2. The viewer's `role` comes from **Neon** (profiles migrated in 2C).
 *   3. Membership and ownership come from Neon stable community IDs (Phase 2E).
 *      Client-supplied community facts are never used. No cross-provider reads.
 */

export type ContentFailureReason =
  | "unauthenticated"
  | "database_not_configured"
  | "not_found"
  | "forbidden"
  | "invalid"
  | "not_ready";

export type ContentResult<T> = { ok: true; data: T } | { ok: false; reason: ContentFailureReason };

/**
 * `strictNullChecks` is off, so the `ok` discriminant does not narrow on its own.
 * Same guard shape as the profile services.
 */
export function isContentFailure<T>(
  result: ContentResult<T>,
): result is { ok: false; reason: ContentFailureReason } {
  return result.ok === false;
}

function configured(): boolean {
  return isDatabaseConfigured();
}

/**
 * Resolves the viewer for an authorization decision.
 *
 * Anonymous callers get a viewer with no uid — which `canViewPost` correctly reduces
 * to "public posts only". A signed-in caller gets their role from Neon and their
 * community facts from Neon.
 *
 * Failure policy differs by fact, and the difference is deliberate:
 *
 *  - **Role lookup fails** → throw. The role is an authorization input, and the
 *    three alternatives are all wrong: defaulting to `member` silently hides content
 *    a moderator is entitled to see (the 2C behaviour change, kept), defaulting to
 *    admin would over-grant, and falling back to "public only" silently hides
 *    content from someone whose membership is fine.
 *  - **Community lookup fails** → throw, for the same reason. `memberSlugs: []` is a
 *    *valid* answer (a user in no communities) and must not be confused with "we
 *    could not find out".
 */
export async function resolveViewer(): Promise<ContentViewer> {
  const session = await getServerSession();
  if (!session) return anonymousViewer();

  const uid = session.uid;

  const [roleResult, facts] = await Promise.all([
    getDatabase().execute(sql`select role from profiles where uid = ${uid} limit 1`),
    communityFacts(getDatabase(), uid),
  ]);
  const roleRows = (roleResult as { rows?: Record<string, unknown>[] })?.rows ?? [];
  return { uid, role: String(roleRows[0]?.role ?? "member"), ...facts };
}

/** The viewer, or a failure result for endpoints that require a session. */
async function requireViewer(): Promise<
  { ok: true; viewer: ContentViewer } | { ok: false; reason: ContentFailureReason }
> {
  if (!configured()) return { ok: false, reason: "database_not_configured" };
  try {
    const viewer = await resolveViewer();
    if (!viewer.uid) return { ok: false, reason: "unauthenticated" };
    return { ok: true, viewer };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export async function getPosts(options: FeedOptions = {}): Promise<ContentResult<Awaited<ReturnType<typeof findPosts>>>> {
  if (!configured()) return { ok: false, reason: "database_not_configured" };
  try {
    const viewer = await resolveViewer();
    return { ok: true, data: await findPosts(getDatabase(), viewer, options) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

export async function getPost(
  postId: string,
): Promise<ContentResult<Awaited<ReturnType<typeof findPostForViewer>>>> {
  if (!configured()) return { ok: false, reason: "database_not_configured" };
  try {
    const viewer = await resolveViewer();
    return { ok: true, data: await findPostForViewer(getDatabase(), viewer, postId) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

/**
 * Creates a post as the signed-in caller.
 *
 * The author is the session uid; there is no author parameter, so "post as someone
 * else" is not an expressible request.
 */
export async function createPostForCurrentUser(
  input: CreatePostInput,
): Promise<ContentResult<Awaited<ReturnType<typeof createPost>>>> {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return { ok: true, data: await createPost(getDatabase(), identity.viewer.uid!, input) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

export async function updatePostForCurrentUser(
  postId: string,
  body: string,
): Promise<ContentResult<Awaited<ReturnType<typeof updatePostBody>>>> {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return { ok: true, data: await updatePostBody(getDatabase(), identity.viewer, postId, body) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

export async function deletePostForCurrentUser(
  postId: string,
): Promise<ContentResult<Awaited<ReturnType<typeof softDeletePost>>>> {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return { ok: true, data: await softDeletePost(getDatabase(), identity.viewer, postId) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

/**
 * Records a view.
 *
 * Fire-and-forget from the post page, so it reports its own failure instead of
 * throwing into a render: a view counter is not worth an error boundary.
 */
export async function recordPostView(postId: string): Promise<void> {
  if (!configured()) return;
  try {
    await incrementPostViews(getDatabase(), postId);
  } catch {
    // Deliberately swallowed and logged by the caller if it cares; see
    // `incrementPostViews` in the client for the pre-2D behaviour.
  }
}

// ─── Comments ───────────────────────────────────────────────────────────────

export async function getComments(postId: string) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const viewer = await resolveViewer();
    return {
      ok: true as const,
      data: await findCommentsForViewer(getDatabase(), viewer, postId),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function getCommentsByAuthor(authorUid: string) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const viewer = await resolveViewer();
    return {
      ok: true as const,
      data: await findCommentsByAuthor(getDatabase(), viewer, authorUid),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function createCommentForCurrentUser(postId: string, input: CreateCommentInput) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await createComment(getDatabase(), identity.viewer, postId, input),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function updateCommentForCurrentUser(commentId: string, body: string) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await updateCommentBody(getDatabase(), identity.viewer, commentId, body),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function deleteCommentForCurrentUser(commentId: string) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await softDeleteComment(getDatabase(), identity.viewer, commentId),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

// ─── Votes ──────────────────────────────────────────────────────────────────

export async function getOwnVote(
  entityType: "post" | "comment",
  entityId: string,
): Promise<ContentResult<number>> {
  if (!configured()) return { ok: false, reason: "database_not_configured" };
  try {
    const viewer = await resolveViewer();
    if (!viewer.uid) return { ok: true, data: 0 };
    return { ok: true, data: await findVoteValue(getDatabase(), viewer.uid, entityType, entityId) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

/**
 * Casts a vote as the signed-in caller.
 *
 * The voter is the session uid. The legacy client signature accepted
 * `currentUserId` and `authorUid`; neither is accepted here, because a vote that can
 * name its voter is a vote that can be cast for someone else.
 */
export async function castVoteForCurrentUser(
  entityType: "post" | "comment",
  entityId: string,
  voteValue: number,
) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await castVote(getDatabase(), identity.viewer, { entityType, entityId, voteValue }),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

// ─── Polls ──────────────────────────────────────────────────────────────────

export async function getPoll(postId: string) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const viewer = await resolveViewer();
    return { ok: true as const, data: await findPollForViewer(getDatabase(), viewer, postId) };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function votePollForCurrentUser(pollId: string, pollOptionId: string) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await votePollOption(getDatabase(), identity.viewer, pollId, pollOptionId),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function getAttachments(postId: string) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const viewer = await resolveViewer();
    return {
      ok: true as const,
      data: await findAttachmentsForViewer(getDatabase(), viewer, postId),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function createAttachmentForCurrentUser(postId: string, input: AttachmentInput) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    if(!input.storagePath?.startsWith(`${identity.viewer.uid}/${postId}/`))return {ok:true as const,data:{status:"invalid"}};
    const post=await findPostForViewer(getDatabase(),identity.viewer,postId);
    if(!post||post.authorUid!==identity.viewer.uid)return {ok:false as const,reason:"not_found" as const};
    // Cross-provider precondition, not a distributed transaction. Files are immutable
    // through browser policies; a failed/lost response is reconciled by metadata reload.
    if(!await verifyUploadedDocument(input.storagePath,input.fileSize,input.mimeType))return {ok:true as const,data:{status:"invalid"}};
    return {
      ok: true as const,
      data: await createAttachment(getDatabase(), identity.viewer, postId, input),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function removeAttachmentForCurrentUser(attachmentId: string) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await removeAttachment(getDatabase(), identity.viewer, attachmentId),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

// ─── Saved posts ────────────────────────────────────────────────────────────

/** The caller's own bookmarks. Takes no uid. */
export async function getSavedPostIds(): Promise<ContentResult<string[]>> {
  if (!configured()) return { ok: false, reason: "database_not_configured" };
  try {
    const viewer = await resolveViewer();
    if (!viewer.uid) return { ok: false, reason: "unauthenticated" };
    return { ok: true, data: await findSavedPostIds(getDatabase(), viewer) };
  } catch {
    return { ok: false, reason: "not_ready" };
  }
}

export async function toggleSavedPostForCurrentUser(postId: string) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await toggleSavedPost(getDatabase(), identity.viewer, postId),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

// ─── Moderation: role and verification (Phase 2D §7) ────────────────────────

/**
 * Changes a global role.
 *
 * `setUserRole` in the query layer enforces "actor must be an admin" and "an admin
 * cannot demote themselves"; this wrapper only supplies the actor from the verified
 * session. The target *is* a parameter — changing another user's role is the whole
 * operation — but the actor never is.
 */
export async function setUserRoleByCurrentUser(targetUid: string, newRole: string) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await setUserRole(getDatabase(), identity.viewer.uid!, targetUid, newRole),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

export async function setUserVerifiedProByCurrentUser(targetUid: string, verified: boolean) {
  const identity = await requireViewer();
  if (identity.ok === false) return identity;
  try {
    return {
      ok: true as const,
      data: await setUserVerifiedPro(getDatabase(), identity.viewer.uid!, targetUid, verified),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/** Re-exported so routes and the client layer share one decision surface. */
export { canViewPost, isStaff, anonymousViewer };
export type { ContentViewer };

// ─── Aggregates (Phase 2D §9) ───────────────────────────────────────────────

/**
 * Contributors ranked by activity over the last `days` days.
 *
 * Author counts are computed only from content visible to the verified viewer.
 */
export async function getRecentContributors(days = 7) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    return {
      ok: true as const,
      data: await findRecentContributors(getDatabase(), since, 50, await resolveViewer()),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/** Distinct active dates for one author, for the streak panel. */
export async function getContributionDates(authorUid: string, days = 90) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
    return {
      ok: true as const,
      data: await findContributionDates(getDatabase(), authorUid, since, await resolveViewer()),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/** Community health aggregates (posts, replies, response times). */
export async function getCommunityHealth() {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    return { ok: true as const, data: await findCommunityHealthInputs(getDatabase(), await resolveViewer()) };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/** Summed post+comment score for one author, used by `calculateReputation`. */
export async function getAuthorScores(authorUid: string) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    return { ok: true as const, data: await sumScoresForAuthor(getDatabase(), authorUid, await resolveViewer()) };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/** How many resource posts an author has. */
export async function getAuthorResourceCount(authorUid: string) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    return { ok: true as const, data: await countResourcesByAuthor(getDatabase(), authorUid, await resolveViewer()) };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/**
 * Post and comment previews for the moderation queue.
 *
 * Staff-only. The check is here rather than in the route for the same reason the
 * profile moderation check lives in its service: a second caller cannot forget it.
 */
export async function getContentPreviews(postIds: string[], commentIds: string[]) {
  if (!configured()) return { ok: false as const, reason: "database_not_configured" as const };
  try {
    const viewer = await resolveViewer();
    if (!viewer.uid) return { ok: false as const, reason: "unauthenticated" as const };
    if (!isStaff(viewer)) return { ok: false as const, reason: "forbidden" as const };

    return {
      ok: true as const,
      data: await findContentPreviews(getDatabase(), postIds, commentIds),
    };
  } catch {
    return { ok: false as const, reason: "not_ready" as const };
  }
}

/** Neon authorization precedes privileged Storage signing; caller supplies only ID. */
export async function getAttachmentDownload(id:string){
 if(!configured())return {ok:false as const,reason:"database_not_configured" as const};
 try{
  const row=await findAttachmentForViewer(getDatabase(),await resolveViewer(),id);
  if(!row)return {ok:false as const,reason:"not_found" as const};
  return {ok:true as const,data:await signDocument(row.storagePath,row.fileName)};
 }catch{return {ok:false as const,reason:"not_ready" as const};}
}
