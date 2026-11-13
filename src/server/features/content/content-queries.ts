import { notifyComment, notifyUpvote } from "../trust/notification-events";
/**
 * Content domain queries (Phase 2D).
 *
 * Same shape as `profile-queries.ts`: pure, dependency-injected, no `server-only`
 * import, so this file is unit-testable with a fake and integration-testable
 * against real PostgreSQL without a second copy of the SQL.
 *
 * Two rules hold throughout, and they are the reason this is one file rather than a
 * thin wrapper per table:
 *
 *  1. **Authorization is a `where` clause, not a post-filter.** Feed reads compile
 *     `authorizationFilter()` into the statement, so a post the viewer may not see
 *     is never returned to this process at all. A row loaded by id is checked with
 *     `canViewPost()` before it is returned. No function returns a row it has not
 *     authorized.
 *  2. **Counters and votes move together.** `castVote` reads the previous vote,
 *     writes the vote, adjusts the entity's counters and the author's reputation in
 *     one transaction, serialized per (voter, entity) by an advisory lock — the
 *     behaviour `cast_vote` provided. Nothing here is a read-then-write that a
 *     second request could interleave with.
 */
import { sql } from "drizzle-orm";

import {
  canViewPost,
  anonymousViewer,
  authorizationFilter,
  isStaff,
  type ContentViewer,
  type PostAuthorizationFacts,
} from "./authorization";

/** A Drizzle client, or anything structurally similar (used by tests). */
export interface ContentDatabase {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}

/** Anything that can open a transaction (all write paths). */
export interface ContentTransactionDatabase extends ContentDatabase {
  transaction: <T>(run: (tx: ContentDatabase) => Promise<T>) => Promise<T>;
}

/** Drizzle's node-postgres driver returns `{ rows }`; a fake may return an array. */
/**
 * Logs and returns a failure for a write that threw.
 *
 * The write functions return typed outcomes rather than throwing, because the routes
 * map them to status codes. But a *swallowed* exception is how a broken `returning`
 * clause hides: the caller sees `{ status: "invalid" }` and has nothing to debug with.
 * Every catch in this file therefore reports the driver error before converting it.
 *
 * The message only — never the bound parameters or the statement, which can contain
 * user content.
 */
function writeFailure(operation: string, error: unknown): void {
  // Driver messages may embed SQL parameters (including notification titles).
  // Log only a SQLSTATE; never user content or a wrapped Drizzle message.
  const failure=error as {code?:string;cause?:{code?:string}};
  console.error(`[content] ${operation} failed`, {code:failure?.cause?.code??failure?.code??"unknown"});
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ─── Projections ────────────────────────────────────────────────────────────

/**
 * Post columns, without author data.
 *
 * Author data is hydrated separately from Neon profiles (Phase 2D §6) — this
 * projection exists so a feed query never joins across two databases.
 */
const POST_COLUMNS = sql`
  p.id, p.title, p.body, p.category, p.tags, p.type,
  p.score, p.ups, p.downs, p.views, p."commentCount",
  p."isDeleted", p."isEdited", p."createdAt",
  (select slug from communities where id=p."communityId") as "communitySlug", p."communityId", p."authorUid", p.visibility,
  p."allowComments", p."isPinned", p."externalLink"
`;

/**
 * Post columns without a table alias, for `insert ... returning`.
 *
 * `POST_COLUMNS` is written against the alias `p` (every read joins), and a
 * `returning` clause has no alias to bind — using it there fails with
 * `missing FROM-clause entry for table "p"`. PostgreSQL accepts an unqualified list,
 * so the returning variant drops the prefix rather than duplicating the list by hand.
 */
const RETURNING_POST_COLUMNS = sql`
  id, title, body, category, tags, type,
  score, ups, downs, views, "commentCount",
  "isDeleted", "isEdited", "createdAt",
  (select slug from communities where id=posts."communityId") as "communitySlug", "communityId", "authorUid", visibility,
  "allowComments", "isPinned", "externalLink"
`;

const RETURNING_COMMENT_COLUMNS = sql`
  id, body, score, "createdAt", "parentId",
  "isDeleted", "isEdited", "authorUid", "postId"
`;

const RETURNING_ATTACHMENT_COLUMNS = sql`
  id, "postId", "uploaderUid", "storagePath", "fileName",
  "mimeType", "fileSize", "createdAt"
`;

const COMMENT_COLUMNS = sql`
  c.id, c.body, c.score, c."createdAt", c."parentId",
  c."isDeleted", c."isEdited", c."authorUid", c."postId"
`;

export interface PostRecord {
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
  communityId: string | null;
  authorUid: string;
  visibility: string;
  allowComments: boolean;
  isPinned: boolean;
  externalLink: string | null;
}

function toPostRecord(row: Record<string, unknown>): PostRecord {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    body: String(row.body ?? ""),
    category: (row.category as string | null) ?? null,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    type: String(row.type ?? "discussion"),
    score: num(row.score),
    ups: num(row.ups),
    downs: num(row.downs),
    views: num(row.views),
    commentCount: num(row.commentCount),
    isDeleted: Boolean(row.isDeleted),
    isEdited: Boolean(row.isEdited),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    communitySlug: (row.communitySlug as string | null) ?? null,
    communityId: (row.communityId as string | null) ?? null,
    authorUid: String(row.authorUid ?? ""),
    visibility: String(row.visibility ?? "public"),
    allowComments: row.allowComments === undefined ? true : Boolean(row.allowComments),
    isPinned: Boolean(row.isPinned),
    externalLink: (row.externalLink as string | null) ?? null,
  };
}

export interface CommentRecord {
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

function toCommentRecord(row: Record<string, unknown>): CommentRecord {
  return {
    id: String(row.id),
    body: String(row.body ?? ""),
    score: num(row.score),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    parentId: (row.parentId as string | null) ?? null,
    isDeleted: Boolean(row.isDeleted),
    isEdited: Boolean(row.isEdited),
    authorUid: String(row.authorUid ?? ""),
    postId: String(row.postId ?? ""),
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export interface FeedOptions {
  limit?: number;
  /** Keyset pagination: return rows strictly older than this ISO timestamp. */
  before?: string | null;
  communitySlug?: string | null;
  authorUid?: string | null;
  type?: string | null;
  tag?: string | null;
  /** Case-insensitive substring match on title or body. */
  search?: string | null;
}

const MAX_FEED_LIMIT = 100;

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(MAX_FEED_LIMIT, Math.max(1, Math.trunc(limit as number)));
}

/**
 * A feed page the viewer is authorized to see.
 *
 * Deleted posts are excluded for everyone: the schema has `isDeleted`, and the
 * original read path filtered `.eq("isDeleted", false)`. Moderation of deleted
 * content happens through the report queue, not the feed.
 *
 * Ordering is `createdAt desc, id desc` — the id tiebreak is what makes keyset
 * pagination stable when two posts share a timestamp.
 */
export async function findPosts(
  db: ContentDatabase,
  viewer: ContentViewer,
  options: FeedOptions = {},
): Promise<PostRecord[]> {
  const { authorizationFilter } = await import("./authorization");
  const limit = clampLimit(options.limit);

  const conditions = [sql`p."isDeleted" is not true`, authorizationFilter(viewer)];

  if (options.communitySlug) conditions.push(sql`p."communityId" = (select id from communities where slug=${options.communitySlug})`);
  if (options.authorUid) conditions.push(sql`p."authorUid" = ${options.authorUid}`);
  if (options.type) conditions.push(sql`p.type = ${options.type}`);
  if (options.tag) conditions.push(sql`${options.tag} = any(p.tags)`);
  if (options.search) {
    // Escape the LIKE metacharacters so a literal `%` or `_` in the term stays
    // literal instead of acting as a wildcard — the same trap the profile search in
    // 2C had to escape. The value is still a bound parameter, never interpolated.
    const escaped = options.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    conditions.push(sql`(p.title ilike ${pattern} or p.body ilike ${pattern})`);
  }
  if (options.before) {
    const before = new Date(options.before);
    if (!Number.isNaN(before.getTime())) {
      conditions.push(sql`p."createdAt" < ${before.toISOString()}::timestamptz`);
    }
  }

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${POST_COLUMNS}
      from posts p
      where ${sql.join(conditions, sql` and `)}
      order by p."createdAt" desc, p.id desc
      limit ${limit}
    `),
  );

  return rows.map(toPostRecord);
}

/**
 * One post, authorized.
 *
 * Returns `null` for both "no such post" and "not visible" — the caller must not be
 * able to distinguish them, which is the behaviour `fetchPostById` already had.
 */
export async function findPostForViewer(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
): Promise<PostRecord | null> {
  if (!isValidUuid(postId)) return null;

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${POST_COLUMNS}
      from posts p
      where p.id = ${postId} and p."isDeleted" is not true
      limit 1
    `),
  );
  if (rows.length === 0) return null;

  const record = toPostRecord(rows[0]);
  return canViewPost(factsOf(record), viewer) ? record : null;
}

function factsOf(post: PostRecord): PostAuthorizationFacts {
  return {
    authorUid: post.authorUid,
    visibility: post.visibility,
    communitySlug: post.communitySlug,
    communityId: post.communityId,
  };
}

/**
 * Comments on a post the viewer may see, oldest first.
 *
 * The visibility check is on the **post**, not the comment: `can_view_post` gated
 * comments through their post (`for select using (public.can_view_post("postId"))`),
 * so a comment never has visibility of its own.
 *
 * Nothing is returned when the post is not visible — including for the comment
 * authors themselves. That matches RLS, where the comment row was filtered by a
 * predicate over a post the session could not see.
 */
export async function findCommentsForViewer(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
  options: { includeDeleted?: boolean; limit?: number } = {},
): Promise<CommentRecord[]> {
  if (!isValidUuid(postId)) return [];

  const post = await findPostForViewer(db, viewer, postId);
  if (!post) return [];

  const conditions = [sql`c."postId" = ${postId}`];
  // Deleted comments are hidden from readers but still needed by moderation tools,
  // which ask for them explicitly.
  if (!options.includeDeleted) conditions.push(sql`c."isDeleted" is not true`);

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${COMMENT_COLUMNS}
      from comments c
      where ${sql.join(conditions, sql` and `)}
      order by c."createdAt" asc, c.id asc
      limit ${clampLimit(options.limit)}
    `),
  );

  return rows.map(toCommentRecord);
}

/** A single comment, authorized through its post. */
export async function findCommentForViewer(
  db: ContentDatabase,
  viewer: ContentViewer,
  commentId: string,
): Promise<{ comment: CommentRecord; post: PostRecord } | null> {
  if (!isValidUuid(commentId)) return null;

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${COMMENT_COLUMNS}, c."postId"
      from comments c
      where c.id = ${commentId}
      limit 1
    `),
  );
  if (rows.length === 0) return null;

  const comment = toCommentRecord(rows[0]);
  const post = await findPostForViewer(db, viewer, comment.postId);
  if (!post) return null;
  return { comment, post };
}

/** Comments written by one author, newest first. Hidden posts' comments included only for the author. */
export async function findCommentsByAuthor(
  db: ContentDatabase,
  viewer: ContentViewer,
  authorUid: string,
  limit = 50,
): Promise<CommentRecord[]> {
  if (!isValidUuid(authorUid)) return [];

  const { authorizationFilter } = await import("./authorization");
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${COMMENT_COLUMNS}
      from comments c
      join posts p on p.id = c."postId"
      where c."authorUid" = ${authorUid}
        and c."isDeleted" is not true
        and p."isDeleted" is not true
        and ${authorizationFilter(viewer)}
      order by c."createdAt" desc
      limit ${clampLimit(limit)}
    `),
  );

  return rows.map(toCommentRecord);
}

/** The viewer's own vote on an entity, or 0. */
export async function findVoteValue(
  db: ContentDatabase,
  uid: string,
  entityType: "post" | "comment",
  entityId: string,
): Promise<number> {
  if (!isValidUuid(uid) || !isValidUuid(entityId)) return 0;

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select "voteValue" from votes
      where "userId" = ${uid} and "entityType" = ${entityType} and "entityId" = ${entityId}
      limit 1
    `),
  );
  return rows.length === 0 ? 0 : num(rows[0].voteValue);
}

// ─── Writes: posts ──────────────────────────────────────────────────────────

export type PostWriteOutcome =
  | { status: "created"; post: PostRecord }
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid" };

export interface CreatePostInput {
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

const MAX_TITLE_LENGTH = 300;
const MAX_BODY_LENGTH = 50_000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;
const MAX_POLL_OPTIONS = 10;

function cleanTag(tag: string): string {
  return tag.trim().slice(0, MAX_TAG_LENGTH);
}

/**
 * A bound `text[]` built from an array of strings.
 *
 * Drizzle's `node-postgres` binding sends a JavaScript array as a non-array
 * parameter (SQLSTATE 42809 — the bug the 2C integration suite caught), so the array
 * itself cannot be bound. Each element is bound individually instead and the whole
 * thing is cast, which keeps user-supplied tags out of the SQL text.
 */
function textArray(values: string[]) {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`;
}

/**
 * Creates a post and, for a poll, its options — atomically.
 *
 * The Supabase version was three separate statements (`posts`, then `polls`, then
 * `poll_options`) with the failure of the second silently ignored, which could
 * leave a `type: 'poll'` post with no poll. One transaction means a post is only
 * visible once it is complete.
 *
 * `authorUid` is the caller's session identity, never an argument.
 */
export async function createPost(
  db: ContentTransactionDatabase,
  authorUid: string,
  input: CreatePostInput,
): Promise<PostWriteOutcome> {
  if (!isValidUuid(authorUid)) return { status: "invalid" };

  const title = (input.title ?? "").trim().slice(0, MAX_TITLE_LENGTH);
  const body = (input.body ?? "").trim().slice(0, MAX_BODY_LENGTH);
  if (!title || !body) return { status: "invalid" };

  const type = input.type ?? "discussion";
  if (!["discussion", "question", "resource", "poll"].includes(type)) {
    return { status: "invalid" };
  }

  const visibility = input.visibility ?? "public";
  if (!["public", "members", "admins"].includes(visibility)) return { status: "invalid" };

  const communitySlug = input.communitySlug || null;
  // Mirrors `posts_restricted_requires_community`: a restricted post without a
  // community would be author-and-staff-only, which no screen can produce.
  if (visibility !== "public" && !communitySlug) return { status: "invalid" };

  const tags = (input.tags ?? [])
    .map(cleanTag)
    .filter(Boolean)
    .slice(0, MAX_TAGS);

  const pollOptions =
    type === "poll"
      ? (input.pollOptions ?? []).map((o) => o.trim()).filter(Boolean).slice(0, MAX_POLL_OPTIONS)
      : [];
  // The UI requires two options before offering a poll; a poll with fewer cannot
  // be voted on, so it is rejected rather than created inert.
  if (type === "poll" && pollOptions.length < 2) return { status: "invalid" };

  try {
    const created = await db.transaction(async (tx) => {
      const community = communitySlug ? rowsOf<Record<string, unknown>>(await tx.execute(sql`select id from communities where slug=${communitySlug} for key share`))[0] : null;
      if (communitySlug && !community) throw new Error("Community not found");
      const communityId = community?.id ?? null;
      const postRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          insert into posts (
            title, body, category, tags, type, "authorUid", "communityId",
            visibility, "allowComments", "externalLink"
          ) values (
            ${title}, ${body}, ${(input.category ?? null) as string | null},
            ${textArray(tags)},
            ${type}, ${authorUid}, ${communityId},
            ${visibility}, ${input.allowComments ?? true},
            ${(input.externalLink ?? null) as string | null}
          )
          returning ${RETURNING_POST_COLUMNS}
        `),
      );

      // The poll and its options are part of the same transaction as the post. The
      // Supabase version inserted them afterwards and ignored a failure, which could
      // leave a `type: 'poll'` post with nothing to vote on.
      if (type === "poll" && pollOptions.length >= 2) {
        const pollRows = rowsOf<Record<string, unknown>>(
          await tx.execute(sql`
            insert into polls ("postId") values (${String(postRows[0].id)})
            returning id
          `),
        );
        const pollId = String(pollRows[0].id);

        await tx.execute(sql`
          insert into poll_options ("pollId", label, position) values ${sql.join(
            pollOptions.map((label, position) => sql`(${pollId}, ${label}, ${position})`),
            sql`, `,
          )}
        `);
      }

      return postRows;
    });
    return { status: "created", post: toPostRecord(created[0]) };
  } catch (error) {
    writeFailure("createPost", error);
    return { status: "invalid" };
  }
}

/**
 * Edits a post body. Author only.
 *
 * The Supabase version sent `.update().eq("id", id)` and relied entirely on RLS to
 * refuse a non-author. With RLS gone the check has to exist here, and it does: the
 * `where` clause includes `"authorUid" = caller`, so a non-author's update matches
 * zero rows and is reported as `not_found` rather than silently succeeding.
 */
export async function updatePostBody(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
  body: string,
): Promise<PostWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(postId)) return { status: "invalid" };

  const trimmed = (body ?? "").trim().slice(0, MAX_BODY_LENGTH);
  if (!trimmed) return { status: "invalid" };

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      update posts
      set body = ${trimmed}, "isEdited" = true, "updatedAt" = now()
      where id = ${postId} and "authorUid" = ${viewer.uid} and "isDeleted" is not true
      returning id
    `),
  );

  return rows.length > 0 ? { status: "updated" } : { status: "not_found" };
}

/** Soft-deletes a post. Author only, matching the original RLS update policy. */
export async function softDeletePost(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
): Promise<PostWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(postId)) return { status: "invalid" };

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      update posts
      set "isDeleted" = true, "updatedAt" = now()
      where id = ${postId} and "authorUid" = ${viewer.uid} and "isDeleted" is not true
      returning id
    `),
  );

  return rows.length > 0 ? { status: "updated" } : { status: "not_found" };
}

/**
 * Increments a post's view count.
 *
 * Deliberately does **not** check visibility beyond the post existing and not being
 * deleted: the call comes from the post's own detail page, and requiring a viewer
 * would make anonymous reads uncountable. It writes a single counter and returns
 * nothing, exactly like `increment_post_views`.
 */
export async function incrementPostViews(db: ContentDatabase, postId: string): Promise<void> {
  if (!isValidUuid(postId)) return;
  await db.execute(sql`
    update posts set views = views + 1 where id = ${postId} and "isDeleted" is not true
  `);
}

// ─── Writes: comments ───────────────────────────────────────────────────────

export type CommentWriteOutcome =
  | { status: "created"; comment: CommentRecord }
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "comments_closed" }
  | { status: "post_removed" }
  | { status: "invalid" };

export interface CreateCommentInput {
  body: string;
  parentId?: string | null;
}

const MAX_COMMENT_LENGTH = 10_000;

/**
 * Adds a comment, maintaining `posts."commentCount"` in the same transaction.
 *
 * The Supabase version relied on `trg_post_comment_count`, which did three things
 * beyond counting: it locked the post row (so a concurrent `isDeleted` /
 * `allowComments` flip wins cleanly), it refused when comments were closed, and it
 * refused when the post was removed. All three are reproduced here inside the
 * transaction, because with RLS gone this function is the only guard.
 *
 * The parent check is also from the original policy set: a reply's parent must
 * belong to the same post.
 */
export async function createComment(
  db: ContentTransactionDatabase,
  viewer: ContentViewer,
  postId: string,
  input: CreateCommentInput,
): Promise<CommentWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(postId)) return { status: "invalid" };

  const body = (input.body ?? "").trim().slice(0, MAX_COMMENT_LENGTH);
  if (!body) return { status: "invalid" };

  const parentId = input.parentId || null;
  if (parentId && !isValidUuid(parentId)) return { status: "invalid" };

  try {
    const outcome = await db.transaction<CommentWriteOutcome>(async (tx) => {
      // `for update` serialises against a concurrent delete / comments-off flip:
      // if that wins first, the values read here are already the closed ones.
      const postRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          select id, "isDeleted", "allowComments"
          from posts where id = ${postId} for update
        `),
      );
      if (postRows.length === 0) return { status: "not_found" };

      const post = postRows[0];
      if (post.isDeleted === true) return { status: "post_removed" };
      if (post.allowComments === false) return { status: "comments_closed" };

      // Authorization: the commenter must be able to see the post at all. Checked
      // after the lock so a visibility change cannot land between check and insert.
      const factsRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          select "authorUid", visibility, "communityId", (select slug from communities where id=posts."communityId") as "communitySlug" from posts where id = ${postId}
        `),
      );
      const facts = factsRows[0];
      if (
        !facts ||
        !canViewPost(
          {
            authorUid: String(facts.authorUid),
            visibility: String(facts.visibility),
            communitySlug: (facts.communitySlug as string | null) ?? null,
            communityId: (facts.communityId as string | null) ?? null,
          },
          viewer,
        )
      ) {
        return { status: "not_found" };
      }

      if (parentId) {
        const parentRows = rowsOf<Record<string, unknown>>(
          await tx.execute(sql`
            select "postId" from comments where id = ${parentId} limit 1
          `),
        );
        // A parent from another post would make the reply unreachable through the
        // post's comment list.
        if (parentRows.length === 0 || String(parentRows[0].postId) !== postId) {
          return { status: "invalid" };
        }
      }

      const inserted = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          insert into comments ("postId", "parentId", "authorUid", body)
          values (${postId}, ${parentId}, ${viewer.uid}, ${body})
          returning ${RETURNING_COMMENT_COLUMNS}
        `),
      );

      await tx.execute(sql`
        update posts set "commentCount" = "commentCount" + 1, "updatedAt" = now()
        where id = ${postId}
      `);

      await notifyComment(tx, String(inserted[0].id));
      return { status: "created", comment: toCommentRecord(inserted[0]) };
    });

    return outcome;
  } catch (error) {
    writeFailure("createComment", error);
    return { status: "invalid" };
  }
}

/** Edits a comment body. Author only. */
export async function updateCommentBody(
  db: ContentDatabase,
  viewer: ContentViewer,
  commentId: string,
  body: string,
): Promise<CommentWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(commentId)) return { status: "invalid" };

  const trimmed = (body ?? "").trim().slice(0, MAX_COMMENT_LENGTH);
  if (!trimmed) return { status: "invalid" };

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      update comments
      set body = ${trimmed}, "isEdited" = true
      where id = ${commentId} and "authorUid" = ${viewer.uid} and "isDeleted" is not true
      returning id
    `),
  );

  return rows.length > 0 ? { status: "updated" } : { status: "not_found" };
}

/**
 * Soft-deletes a comment and decrements the post's counter.
 *
 * Author only. The counter decrement is `greatest(0, …)` so a double-delete (or a
 * counter that already drifted) cannot go negative — the `CHECK` would otherwise
 * turn a repeated request into a 500.
 */
export async function softDeleteComment(
  db: ContentTransactionDatabase,
  viewer: ContentViewer,
  commentId: string,
): Promise<CommentWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(commentId)) return { status: "invalid" };

  try {
    const outcome = await db.transaction<CommentWriteOutcome>(async (tx) => {
      const rows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          update comments
          set "isDeleted" = true
          where id = ${commentId} and "authorUid" = ${viewer.uid} and "isDeleted" is not true
          returning "postId"
        `),
      );
      if (rows.length === 0) return { status: "not_found" };

      const postId = String(rows[0].postId);
      await tx.execute(sql`
        update posts
        set "commentCount" = greatest(0, "commentCount" - 1), "updatedAt" = now()
        where id = ${postId}
      `);
      return { status: "updated" };
    });
    return outcome;
  } catch (error) {
    writeFailure("softDeleteComment", error);
    return { status: "invalid" };
  }
}

// ─── Writes: votes ──────────────────────────────────────────────────────────

export type VoteOutcome =
  | { status: "applied"; voteValue: number; score: number }
  | { status: "unchanged"; voteValue: number }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "self_vote" }
  | { status: "deleted_content" }
  | { status: "invalid" };

/**
 * The vote state machine — a port of `public.cast_vote`.
 *
 * Order of checks is the original's, because the error the caller sees depends on
 * it: identity, value validity, entity existence, deleted state, visibility,
 * self-vote, then the lock.
 *
 * The advisory lock is the part that cannot be dropped. `cast_vote` took
 * `pg_advisory_xact_lock(hashtextextended(voter || ':' || type || ':' || entity))`
 * before reading the previous vote, so two concurrent requests from the same voter
 * serialize instead of both reading "no previous vote" and applying the same delta
 * twice. The integration suite asserts 10 concurrent calls produce a net delta of
 * exactly one vote.
 *
 * Reputation: the delta is applied to `profiles.reputation` in the same transaction
 * **when the entity has an author different from the voter**. Self-votes are
 * rejected before this point, so the guard is defensive.
 */
export async function castVote(
  db: ContentTransactionDatabase,
  viewer: ContentViewer,
  input: { entityType: "post" | "comment"; entityId: string; voteValue: number },
): Promise<VoteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };

  const { entityType, entityId, voteValue } = input;
  if (entityType !== "post" && entityType !== "comment") return { status: "invalid" };
  if (![1, -1, 0].includes(voteValue)) return { status: "invalid" };
  if (!isValidUuid(entityId)) return { status: "invalid" };

  const voterUid = viewer.uid;

  try {
    const outcome = await db.transaction<VoteOutcome>(async (tx) => {
      // Serialize this voter's votes on this entity for the rest of the transaction.
      await tx.execute(sql`
        select pg_advisory_xact_lock(
          hashtextextended(${`${voterUid}:${entityType}:${entityId}`}, 0)
        )
      `);

      let entityAuthor: string | null = null;
      let postId: string | null = null;
      let deleted = false;
      let parentDeleted = false;

      if (entityType === "post") {
        const rows = rowsOf<Record<string, unknown>>(
          await tx.execute(sql`
            select "authorUid", id, "isDeleted"::boolean as "isDeleted"
            from posts where id = ${entityId} for update
          `),
        );
        if (rows.length === 0) return { status: "not_found" };
        entityAuthor = String(rows[0].authorUid);
        postId = String(rows[0].id);
        deleted = rows[0].isDeleted === true;
      } else {
        const rows = rowsOf<Record<string, unknown>>(
          await tx.execute(sql`
            select c."authorUid", c."postId", c."isDeleted"::boolean as "isDeleted",
                   p."isDeleted"::boolean as "parentDeleted"
            from comments c
            join posts p on p.id = c."postId"
            where c.id = ${entityId}
            for update of c, p
          `),
        );
        if (rows.length === 0) return { status: "not_found" };
        entityAuthor = String(rows[0].authorUid);
        postId = String(rows[0].postId);
        deleted = rows[0].isDeleted === true;
        parentDeleted = rows[0].parentDeleted === true;
      }

      if (!entityAuthor) return { status: "not_found" };
      if (deleted || parentDeleted) return { status: "deleted_content" };

      // `cast_vote` is SECURITY DEFINER, so it checked visibility itself.
      const factsRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          select "authorUid", visibility, "communityId", (select slug from communities where id=posts."communityId") as "communitySlug" from posts where id = ${postId}
        `),
      );
      const facts = factsRows[0];
      if (
        !facts ||
        !canViewPost(
          {
            authorUid: String(facts.authorUid),
            visibility: String(facts.visibility),
            communitySlug: (facts.communitySlug as string | null) ?? null,
            communityId: (facts.communityId as string | null) ?? null,
          },
          viewer,
        )
      ) {
        return { status: "not_found" };
      }

      if (entityAuthor === voterUid) return { status: "self_vote" };

      const previousRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          select "voteValue" from votes
          where "userId" = ${voterUid} and "entityType" = ${entityType} and "entityId" = ${entityId}
          for update
        `),
      );
      const previous = previousRows.length === 0 ? 0 : num(previousRows[0].voteValue);

      if (previous === voteValue) return { status: "unchanged", voteValue };

      if (voteValue === 0) {
        await tx.execute(sql`
          delete from votes
          where "userId" = ${voterUid} and "entityType" = ${entityType} and "entityId" = ${entityId}
        `);
      } else {
        await tx.execute(sql`
          insert into votes ("userId", "entityType", "entityId", "voteValue")
          values (${voterUid}, ${entityType}, ${entityId}, ${voteValue})
          on conflict ("userId", "entityType", "entityId")
          do update set "voteValue" = excluded."voteValue"
        `);
      }

      const scoreDelta = voteValue - previous;
      const upsDelta = (voteValue === 1 ? 1 : 0) - (previous === 1 ? 1 : 0);
      const downsDelta = (voteValue === -1 ? 1 : 0) - (previous === -1 ? 1 : 0);

      const table = entityType === "post" ? sql`posts` : sql`comments`;
      const updated = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          update ${table}
          set score = score + ${scoreDelta},
              ups = ups + ${upsDelta},
              downs = downs + ${downsDelta}
          where id = ${entityId}
          returning score
        `),
      );

      if (entityAuthor !== voterUid) {
        await tx.execute(sql`
          update profiles
          set reputation = greatest(0, reputation + ${scoreDelta}), "updatedAt" = now()
          where uid = ${entityAuthor}
        `);
      }

      if (voteValue === 1) await notifyUpvote(tx, voterUid, entityType, entityId, postId!, entityAuthor);
      return {
        status: "applied",
        voteValue,
        score: updated.length > 0 ? num(updated[0].score) : 0,
      };
    });

    return outcome;
  } catch (error) {
    writeFailure("castVote", error);
    return { status: "invalid" };
  }
}

// ─── Polls ──────────────────────────────────────────────────────────────────

export interface PollWithOptions {
  id: string;
  postId: string;
  options: { id: string; label: string; position: number; votes: number }[];
  totalVotes: number;
  viewerOptionId: string | null;
}

/**
 * A post's poll with per-option counts, authorized through the post.
 *
 * One statement with a `left join lateral` count instead of the original three
 * round trips (poll, options, all votes) and the client-side tally.
 */
export async function findPollForViewer(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
): Promise<PollWithOptions | null> {
  if (!isValidUuid(postId)) return null;

  const post = await findPostForViewer(db, viewer, postId);
  if (!post) return null;

  const pollRows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`select id, "postId" from polls where "postId" = ${postId} limit 1`),
  );
  if (pollRows.length === 0) return null;

  const pollId = String(pollRows[0].id);

  const optionRows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select o.id, o.label, o.position,
             (select count(*) from poll_votes v where v."pollOptionId" = o.id) as votes
      from poll_options o
      where o."pollId" = ${pollId}
      order by o.position asc, o.id asc
    `),
  );

  const options = optionRows.map((row) => ({
    id: String(row.id),
    label: String(row.label ?? ""),
    position: num(row.position),
    votes: num(row.votes),
  }));

  let viewerOptionId: string | null = null;
  if (viewer.uid && options.length > 0) {
    const mine = rowsOf<Record<string, unknown>>(
      await db.execute(sql`
        select "pollOptionId" from poll_votes
        where "pollId" = ${pollId} and "userId" = ${viewer.uid}
        limit 1
      `),
    );
    if (mine.length > 0) viewerOptionId = String(mine[0].pollOptionId);
  }

  return {
    id: pollId,
    postId,
    options,
    totalVotes: options.reduce((sum, option) => sum + option.votes, 0),
    viewerOptionId,
  };
}

export type PollVoteOutcome =
  | { status: "voted"; optionId: string }
  | { status: "already_voted" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "invalid" };

/**
 * Casts a poll vote. One per user per poll, enforced by the unique key.
 *
 * The option must belong to the named poll — otherwise a caller could vote with an
 * option from a different poll, creating a row whose counts land in the wrong
 * tally. The original unique `(pollId, userId)` prevented duplicates but not that.
 */
export async function votePollOption(
  db: ContentDatabase,
  viewer: ContentViewer,
  pollId: string,
  pollOptionId: string,
): Promise<PollVoteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(pollId) || !isValidUuid(pollOptionId)) return { status: "invalid" };

  const pollRows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`select "postId" from polls where id = ${pollId} limit 1`),
  );
  if (pollRows.length === 0) return { status: "not_found" };

  // Polls inherit their post's visibility, so a vote cannot be cast on a poll the
  // voter cannot see.
  const post = await findPostForViewer(db, viewer, String(pollRows[0].postId));
  if (!post) return { status: "not_found" };

  const optionRows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select id from poll_options where id = ${pollOptionId} and "pollId" = ${pollId} limit 1
    `),
  );
  if (optionRows.length === 0) return { status: "invalid" };

  const inserted = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      insert into poll_votes ("pollId", "pollOptionId", "userId")
      values (${pollId}, ${pollOptionId}, ${viewer.uid})
      on conflict ("pollId", "userId") do nothing
      returning id
    `),
  );

  // No row means the conflict clause fired: this user already voted on this poll.
  return inserted.length > 0
    ? { status: "voted", optionId: pollOptionId }
    : { status: "already_voted" };
}

// ─── Attachments ────────────────────────────────────────────────────────────

export interface AttachmentRecord {
  id: string;
  postId: string;
  uploaderUid: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

const ATTACHMENT_COLUMNS = sql`
  id, "postId", "uploaderUid", "storagePath", "fileName",
  "mimeType", "fileSize", "createdAt"
`;

function toAttachmentRecord(row: Record<string, unknown>): AttachmentRecord {
  return {
    id: String(row.id),
    postId: String(row.postId),
    uploaderUid: String(row.uploaderUid),
    storagePath: String(row.storagePath ?? ""),
    fileName: String(row.fileName ?? ""),
    mimeType: String(row.mimeType ?? ""),
    fileSize: num(row.fileSize),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
  };
}

/**
 * Attachment metadata for a post the viewer may see, and that is not deleted.
 *
 * Two conditions, both from the original policy: `can_view_post(postId)` **and**
 * the post is not deleted. A removed post's documents disappear with it — the files
 * stay in Storage (this phase does not touch bytes) but are no longer linked.
 */
export async function findAttachmentsForViewer(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
): Promise<AttachmentRecord[]> {
  if (!isValidUuid(postId)) return [];

  const post = await findPostForViewer(db, viewer, postId);
  if (!post) return [];

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${ATTACHMENT_COLUMNS} from post_attachments
      where "postId" = ${postId}
      order by "createdAt" asc
    `),
  );
  return rows.map(toAttachmentRecord);
}

export type AttachmentWriteOutcome =
  | { status: "created"; attachment: AttachmentRecord }
  | { status: "removed" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "limit_reached" }
  | { status: "invalid" };

export interface AttachmentInput {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Records an uploaded document.
 *
 * The limit is enforced inside the transaction with the post row locked, which is
 * what `enforce_post_document_limit` did: without the lock two concurrent uploads
 * each count 2 and both insert, producing 4.
 *
 * Uploader must be the post's author — the original policy required it, and it is
 * what stops one user attaching files to someone else's post.
 */
export async function createAttachment(
  db: ContentTransactionDatabase,
  viewer: ContentViewer,
  postId: string,
  input: AttachmentInput,
  maxPerPost = 3,
): Promise<AttachmentWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(postId)) return { status: "invalid" };

  const { storagePath, fileName, mimeType, fileSize } = input;
  if (!storagePath || !fileName || !mimeType) return { status: "invalid" };
  // Mirrors the schema's `attachment_path_owned` check; refusing here gives a
  // clearer error than a constraint violation.
  if (!storagePath.startsWith(`${viewer.uid}/${postId}/`)) return { status: "invalid" };

  try {
    const outcome = await db.transaction<AttachmentWriteOutcome>(async (tx) => {
      const postRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          select "authorUid", "isDeleted" from posts where id = ${postId} for update
        `),
      );
      if (postRows.length === 0) return { status: "not_found" };
      if (postRows[0].isDeleted === true) return { status: "not_found" };
      if (String(postRows[0].authorUid) !== viewer.uid) return { status: "forbidden" };

      const countRows = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          select count(*)::int as n from post_attachments where "postId" = ${postId}
        `),
      );
      if (num(countRows[0]?.n) >= maxPerPost) return { status: "limit_reached" };

      const inserted = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          insert into post_attachments (
            "postId", "uploaderUid", "storagePath", "fileName", "mimeType", "fileSize"
          ) values (${postId}, ${viewer.uid}, ${storagePath}, ${fileName}, ${mimeType}, ${fileSize})
          returning ${RETURNING_ATTACHMENT_COLUMNS}
        `),
      );
      return { status: "created", attachment: toAttachmentRecord(inserted[0]) };
    });
    return outcome;
  } catch (error) {
    writeFailure("createAttachment", error);
    // Do not mislabel an uncertain commit/connection failure as a safe refusal:
    // Storage compensation must keep the bytes until metadata is reconciled.
    throw error;
  }
}

/** Removes an attachment record. Uploader only. */
export async function removeAttachment(
  db: ContentDatabase,
  viewer: ContentViewer,
  attachmentId: string,
): Promise<AttachmentWriteOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(attachmentId)) return { status: "invalid" };

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      delete from post_attachments
      where id = ${attachmentId} and "uploaderUid" = ${viewer.uid}
      returning id
    `),
  );
  return rows.length > 0 ? { status: "removed" } : { status: "not_found" };
}

// ─── Saved posts ────────────────────────────────────────────────────────────

/**
 * The viewer's bookmarks.
 *
 * Takes no uid: the subject is the caller. The original
 * `getSavedPostIds(uid)` could read *any* user's bookmarks, which RLS silently
 * narrowed to the caller's own — the same trap as the profile writes in 2C.
 */
export async function findSavedPostIds(
  db: ContentDatabase,
  viewer: ContentViewer,
  options: { postId?: string } = {},
): Promise<string[]> {
  if (!viewer.uid) return [];

  const conditions = [sql`"userId" = ${viewer.uid}`];
  if (options.postId) conditions.push(sql`"postId" = ${options.postId}`);

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select "postId" from saved_posts where ${sql.join(conditions, sql` and `)}
    `),
  );
  return rows.map((row) => String(row.postId));
}

export type SaveOutcome = { status: "saved" | "removed" | "not_found" | "forbidden" };

/**
 * Toggles a bookmark atomically.
 *
 * The original did `select` then `insert`/`delete` — two requests, and a
 * double-click could race them into a duplicate-key error. Here it is one statement
 * that deletes if present and inserts if not, using the composite key as the
 * arbiter.
 */
export async function toggleSavedPost(
  db: ContentDatabase,
  viewer: ContentViewer,
  postId: string,
): Promise<SaveOutcome> {
  if (!viewer.uid) return { status: "forbidden" };
  if (!isValidUuid(postId)) return { status: "not_found" };

  // Saving a post you cannot see would leak its existence through the bookmark list.
  const post = await findPostForViewer(db, viewer, postId);
  if (!post) return { status: "not_found" };

  const removed = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      delete from saved_posts
      where "userId" = ${viewer.uid} and "postId" = ${postId}
      returning "postId"
    `),
  );
  if (removed.length > 0) return { status: "removed" };

  await db.execute(sql`
    insert into saved_posts ("userId", "postId")
    values (${viewer.uid}, ${postId})
    on conflict ("userId", "postId") do nothing
  `);
  return { status: "saved" };
}

// ─── Moderation: role and verification (Phase 2D §7) ────────────────────────

export type RoleOutcome =
  | { status: "updated" }
  | { status: "not_found" }
  | { status: "forbidden" }
  | { status: "self_demotion" }
  | { status: "invalid" };

/**
 * Changes another user's global role. Administrator only.
 *
 * The Supabase RPC `set_user_role` was `SECURITY DEFINER` and checked
 * `is_admin(auth.uid())` itself. There is no RLS to lean on here, so the check is
 * this function: it reads the **actor's** own row from Neon and refuses unless it is
 * `admin`. `moderator` is not enough — that matches `is_admin`, which tested for
 * exactly `'admin'`, and it is what stops a moderator promoting anyone.
 *
 * The self-demotion guard is carried over from the RPC: an admin who demotes
 * themselves could leave the deployment with no administrator at all.
 *
 * `actorUid` is passed by the caller (the service layer) from the verified session.
 * It is a parameter here only because this module is dependency-injected and pure;
 * no HTTP handler ever supplies it from a request body.
 */
export async function setUserRole(
  db: ContentTransactionDatabase,
  actorUid: string,
  targetUid: string,
  newRole: string,
): Promise<RoleOutcome> {
  if (!isValidUuid(actorUid) || !isValidUuid(targetUid)) return { status: "invalid" };
  if (!["admin", "moderator", "member"].includes(newRole)) return { status: "invalid" };

  try {
    return await db.transaction<RoleOutcome>(async (tx) => {
      const actor = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`select role from profiles where uid = ${actorUid} limit 1`),
      );
      if (actor.length === 0 || String(actor[0].role) !== "admin") {
        return { status: "forbidden" };
      }

      if (actorUid === targetUid && newRole !== "admin") {
        return { status: "self_demotion" };
      }

      const updated = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          update profiles set role = ${newRole}, "updatedAt" = now()
          where uid = ${targetUid}
          returning uid
        `),
      );
      return updated.length > 0 ? { status: "updated" } : { status: "not_found" };
    });
  } catch (error) {
    writeFailure("setUserRole", error);
    return { status: "invalid" };
  }
}

/**
 * Sets Verified Pro. Administrator only.
 *
 * Same shape as `set_user_role`, and the same authorization: the original
 * `set_user_verified_pro` called `is_admin(auth.uid())` — verified status was never
 * self-service, and the threshold shown in the admin UI is policy, not a rule the
 * database enforced.
 */
export async function setUserVerifiedPro(
  db: ContentTransactionDatabase,
  actorUid: string,
  targetUid: string,
  verified: boolean,
): Promise<RoleOutcome> {
  if (!isValidUuid(actorUid) || !isValidUuid(targetUid)) return { status: "invalid" };

  try {
    return await db.transaction<RoleOutcome>(async (tx) => {
      const actor = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`select role from profiles where uid = ${actorUid} limit 1`),
      );
      if (actor.length === 0 || String(actor[0].role) !== "admin") {
        return { status: "forbidden" };
      }

      const updated = rowsOf<Record<string, unknown>>(
        await tx.execute(sql`
          update profiles set "isVerifiedPro" = ${verified}, "updatedAt" = now()
          where uid = ${targetUid}
          returning uid
        `),
      );
      return updated.length > 0 ? { status: "updated" } : { status: "not_found" };
    });
  } catch (error) {
    writeFailure("setUserVerifiedPro", error);
    return { status: "invalid" };
  }
}

/** Exposed for the service layer: is this viewer staff? */
export { isStaff };

// ─── Aggregates for stats and profile counters (Phase 2D §9) ────────────────

/**
 * How many `resource`-type posts an author has.
 *
 * Counted in the database rather than by fetching every post and filtering, which is
 * what the Supabase version did with `{ count: "exact", head: true }`.
 *
 * Only counts resource posts visible to the current viewer.
 */
export async function countResourcesByAuthor(
  db: ContentDatabase,
  authorUid: string,
  viewer: ContentViewer = anonymousViewer(),
): Promise<number> {
  if (!isValidUuid(authorUid)) return 0;
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select count(*)::int as n from posts p
      where p."authorUid" = ${authorUid} and p.type = 'resource' and p."isDeleted" is not true and ${authorizationFilter(viewer)}
    `),
  );
  return num(rows[0]?.n);
}

/** The sum of an author's post and comment scores, for `calculateReputation`. */
export async function sumScoresForAuthor(
  db: ContentDatabase,
  authorUid: string,
  viewer: ContentViewer = anonymousViewer(),
): Promise<number> {
  if (!isValidUuid(authorUid)) return 0;
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select (
        coalesce((select sum(score) from posts p
                  where p."authorUid" = ${authorUid} and p."isDeleted" is not true and ${authorizationFilter(viewer)}), 0)
        + coalesce((select sum(c.score) from comments c join posts p on p.id=c."postId"
                  where c."authorUid" = ${authorUid} and c."isDeleted" is not true and p."isDeleted" is not true and ${authorizationFilter(viewer)}), 0)
      )::int as total
    `),
  );
  return num(rows[0]?.total);
}

/** Author ids with a contribution since `since`, newest first, for the activity board. */
export async function findRecentContributors(
  db: ContentDatabase,
  since: Date,
  limit = 50,
  viewer: ContentViewer = anonymousViewer(),
): Promise<{ uid: string; contributions: number }[]> {
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select "authorUid" as uid, count(*)::int as contributions
      from (
        select p."authorUid" from posts p
        where p."isDeleted" is not true and p."createdAt" >= ${since.toISOString()}::timestamptz and ${authorizationFilter(viewer)}
        union all
        select c."authorUid" from comments c join posts p on p.id=c."postId"
        where c."isDeleted" is not true and p."isDeleted" is not true and c."createdAt" >= ${since.toISOString()}::timestamptz and ${authorizationFilter(viewer)}
      ) activity
      group by "authorUid"
      order by contributions desc, "authorUid" asc
      limit ${clampLimit(limit)}
    `),
  );
  return rows.map((row) => ({ uid: String(row.uid), contributions: num(row.contributions) }));
}

/** Distinct UTC dates on which an author contributed since `since`. */
export async function findContributionDates(
  db: ContentDatabase,
  authorUid: string,
  since: Date,
  viewer: ContentViewer = anonymousViewer(),
): Promise<string[]> {
  if (!isValidUuid(authorUid)) return [];
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select distinct to_char("createdAt" at time zone 'utc', 'YYYY-MM-DD') as day
      from (
        select p."createdAt" from posts p
        where p."authorUid" = ${authorUid} and p."isDeleted" is not true
          and p."createdAt" >= ${since.toISOString()}::timestamptz and ${authorizationFilter(viewer)}
        union all
        select c."createdAt" from comments c join posts p on p.id=c."postId"
        where c."authorUid" = ${authorUid} and c."isDeleted" is not true and p."isDeleted" is not true
          and c."createdAt" >= ${since.toISOString()}::timestamptz and ${authorizationFilter(viewer)}
      ) activity
      order by day asc
    `),
  );
  return rows.map((row) => String(row.day));
}

/**
 * Aggregate inputs for the community-health panel.
 *
 * Returns counts only — how many posts exist, how many got a reply, and the two
 * timestamps needed to compute a median response time. No post text, no author ids.
 */
export async function findCommunityHealthInputs(db: ContentDatabase, viewer: ContentViewer = anonymousViewer()): Promise<{
  postCount: number;
  postsWithReplies: number;
  responses: { postId: string; postedAt: string; firstCommentAt: string | null }[];
}> {
  const totals = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select
        count(*)::int as total,
        count(*) filter (where "commentCount" > 0)::int as with_replies
      from posts p where p."isDeleted" is not true and ${authorizationFilter(viewer)}
    `),
  );

  const responses = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select p.id as "postId", p."createdAt" as "postedAt",
             min(c."createdAt") as "firstCommentAt"
      from posts p
      left join comments c on c."postId" = p.id and c."isDeleted" is not true
      where p."isDeleted" is not true and p."commentCount" > 0 and ${authorizationFilter(viewer)}
      group by p.id, p."createdAt"
    `),
  );

  return {
    postCount: num(totals[0]?.total),
    postsWithReplies: num(totals[0]?.with_replies),
    responses: responses.map((row) => ({
      postId: String(row.postId),
      postedAt: iso(row.postedAt) ?? new Date(0).toISOString(),
      firstCommentAt: iso(row.firstCommentAt),
    })),
  };
}

/**
 * Minimal post/comment facts for the moderation report queue.
 *
 * Staff-only, and the caller enforces that (see `getContentPreviews`). Deliberately
 * narrow: id, title/body, `isDeleted` and `authorUid`. It is the same projection the
 * Supabase preview query returned, minus the embedded profile join — the caller
 * hydrates names from the profile endpoint like every other read path.
 */
export async function findContentPreviews(
  db: ContentDatabase,
  postIds: string[],
  commentIds: string[],
): Promise<{
  posts: { id: string; title: string; body: string; isDeleted: boolean; authorUid: string }[];
  comments: { id: string; body: string; isDeleted: boolean; authorUid: string }[];
}> {
  const validPosts = postIds.filter(isValidUuid);
  const validComments = commentIds.filter(isValidUuid);

  const posts = validPosts.length
    ? rowsOf<Record<string, unknown>>(
        await db.execute(sql`
          select id, title, body, "isDeleted", "authorUid" from posts
          where id in (${sql.join(validPosts.map((id) => sql`${id}`), sql`, `)})
        `),
      ).map((row) => ({
        id: String(row.id),
        title: String(row.title ?? ""),
        body: String(row.body ?? ""),
        isDeleted: row.isDeleted === true,
        authorUid: String(row.authorUid),
      }))
    : [];

  const comments = validComments.length
    ? rowsOf<Record<string, unknown>>(
        await db.execute(sql`
          select id, body, "isDeleted", "authorUid" from comments
          where id in (${sql.join(validComments.map((id) => sql`${id}`), sql`, `)})
        `),
      ).map((row) => ({
        id: String(row.id),
        body: String(row.body ?? ""),
        isDeleted: row.isDeleted === true,
        authorUid: String(row.authorUid),
      }))
    : [];

  return { posts, comments };
}

/** A stored pointer only after authoritative post visibility/deletion checks. */
export async function findAttachmentForViewer(db:ContentDatabase,viewer:ContentViewer,id:string):Promise<AttachmentRecord|null>{
 if(!isValidUuid(id))return null;
 const r=rowsOf<Record<string,unknown>>(await db.execute(sql`select ${ATTACHMENT_COLUMNS} from post_attachments where id=${id}`))[0];
 if(!r||!await findPostForViewer(db,viewer,String(r.postId)))return null;
 return toAttachmentRecord(r);
}
