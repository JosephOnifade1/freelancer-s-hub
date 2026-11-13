/**
 * Content domain: `posts`, `comments`, `votes`, `polls`, `poll_options`,
 * `poll_votes`, `post_attachments`, `saved_posts` (Phase 2D).
 *
 * Derivation
 * ----------
 * As with `identity.ts`, the columns are reconciled against the columns the
 * **application actually reads and writes**, not copied from `supabase_schema.sql`
 * mechanically. Where the two disagree, the divergence is recorded below.
 *
 * Three deliberate divergences from the Supabase schema
 * -----------------------------------------------------
 *  1. **`polls."postId"` is unique here.** The SQL says "one-to-one with a post when
 *     post.type = 'poll'" in a comment but never constrains it, and `createPost` only
 *     ever inserts one poll. The product behaviour is one poll per post, so the
 *     constraint makes the intended invariant real rather than advisory. Nothing in
 *     the application inserts a second poll, so no behaviour changes.
 *
 *  2. **`posts."isDeleted"`, `allowComments`, `isPinned` are `notNull`.** The SQL
 *     allows NULL and the app treats NULL as `false`/`true` at every read
 *     (`p.isDeleted ?? false`, `allowComments ?? true`, `isPinned ?? false`). Making
 *     them NOT NULL with defaults removes a three-valued-logic branch from every
 *     authorization check, which matters because one of those checks is now the
 *     only thing standing between a viewer and a private post.
 *
 *  3. **Counters are NOT NULL.** `score`, `ups`, `downs`, `views`, `commentCount` are
 *     all `coalesce(x, 0)` in the vote RPC and the trigger. NOT NULL + default 0 is
 *     the same guarantee without the coalesce.
 *
 * No foreign key to `communities`
 * -------------------------------
 * `posts."communitySlug"` references a table that is still in Supabase. PostgreSQL
 * cannot enforce a reference across providers, so the column is plain `text` here
 * and the relationship is maintained by the server. This is the same trade-off
 * already documented for `profiles.uid`, and it is the reason `can_view_post` needs
 * the community lookup at request time rather than a join.
 *
 * `species` of deletion
 * ---------------------
 * Deletion is soft everywhere (`isDeleted`). Content is never hard-deleted by the
 * application; the moderation flow also only flips flags. Nothing in this schema
 * cascades a delete, which is why `onDelete: "cascade"` appears on the foreign keys
 * that *do* exist: account deletion is not implemented (2B.4 §11), so those cascades
 * are dormant safety, not an executed path.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { profiles } from "./identity";

/** The four post kinds the UI creates (`CreatePost.tsx`). */
export const POST_TYPES = ["discussion", "question", "resource", "poll"] as const;
export type PostType = (typeof POST_TYPES)[number];

/**
 * Visibility values, as enforced by `can_view_post`.
 *
 * `public` — anyone, including signed-out visitors.
 * `members` — signed-in members of the post's community.
 * `admins`  — the author, the community owner, platform staff.
 */
export const POST_VISIBILITIES = ["public", "members", "admins"] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

/** Mime types the attachment UI accepts (`attachments.ts` `MIME_BY_EXTENSION`). */
export const ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

/** Post documents: 10 MB, and at most 3 per post (both mirrored in `attachments.ts`). */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_POST = 3;

const hasSeenAt = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" }).notNull().default(sql`now()`);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    title: text("title").notNull(),
    body: text("body").notNull(),
    category: text("category"),

    /** Free-form labels rendered as tags; the UI filters on them client-side. */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    type: text("type").notNull().default("discussion"),

    /**
     * Denormalised vote counters, maintained by `castVote` in the same
     * transaction as the vote row. They are not derived on read: the feed sorts by
     * `score` and the card renders `ups`/`downs`, and recomputing from `votes` for
     * every feed row would be an aggregate over the whole table.
     */
    score: integer("score").notNull().default(0),
    ups: integer("ups").notNull().default(0),
    downs: integer("downs").notNull().default(0),
    views: integer("views").notNull().default(0),

    /** Maintained by `maintainCommentCount` inside the comment write transaction. */
    commentCount: integer("commentCount").notNull().default(0),

    isDeleted: boolean("isDeleted").notNull().default(false),
    isEdited: boolean("isEdited").notNull().default(false),

    createdAt: hasSeenAt("createdAt"),
    updatedAt: hasSeenAt("updatedAt"),

    authorUid: uuid("authorUid")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),

    /** No FK: `communities` lives in Supabase. See the file header. */
    communitySlug: text("communitySlug"),

    visibility: text("visibility").notNull().default("public"),
    allowComments: boolean("allowComments").notNull().default(true),
    isPinned: boolean("isPinned").notNull().default(false),

    externalLink: text("externalLink"),
  },
  (table) => [
    index("posts_created_at_idx").on(table.createdAt),
    index("posts_author_idx").on(table.authorUid),
    index("posts_community_idx").on(table.communitySlug),
    /** Supports the visibility-restricted feed scan. */
    index("posts_visibility_created_idx").on(table.visibility, table.createdAt),
    check("posts_type_check", sql`${table.type} in ('discussion', 'question', 'resource', 'poll')`),
    check(
      "posts_visibility_check",
      sql`${table.visibility} in ('public', 'members', 'admins')`,
    ),
    /**
     * `score` is `ups - downs` and is **signed**: a post with more downvotes than
     * upvotes is legitimately negative. The first version of this schema constrained
     * it to `>= 0`, copied from the profile counters, and the integration suite caught
     * it by switching a vote from +1 to -1 — the update failed with
     * `posts_score_non_negative`. The Supabase schema had no such check; neither does
     * this one.
     *
     * `ups` and `downs` are counts and cannot go negative. They are not separately
     * constrained here because the vote transaction is the only writer and it moves
     * them by a delta derived from a previous value it read under lock; a wrong delta
     * shows up as a wrong total in the tests rather than as a constraint violation.
     */
    check("posts_views_non_negative", sql`${table.views} >= 0`),
    check("posts_comment_count_non_negative", sql`${table.commentCount} >= 0`),
    /**
     * `members` / `admins` visibility is community-scoped by definition
     * (`can_view_post` returns false without a `communitySlug`). A restricted post
     * with no community would be visible to its author and staff only — a state the
     * UI cannot create and nobody intends, so it is rejected here rather than
     * silently authorised.
     */
    check(
      "posts_restricted_requires_community",
      sql`${table.visibility} = 'public' or ${table.communitySlug} is not null`,
    ),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    postId: uuid("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),

    /** One level of nesting is what the UI renders; the schema allows any tree. */
    parentId: uuid("parentId").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),

    authorUid: uuid("authorUid")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),

    body: text("body").notNull(),

    score: integer("score").notNull().default(0),
    ups: integer("ups").notNull().default(0),
    downs: integer("downs").notNull().default(0),

    isDeleted: boolean("isDeleted").notNull().default(false),
    isEdited: boolean("isEdited").notNull().default(false),

    createdAt: hasSeenAt("createdAt"),
  },
  (table) => [
    index("comments_post_idx").on(table.postId),
    index("comments_author_idx").on(table.authorUid),
    index("comments_parent_idx").on(table.parentId),
    // `score` is signed here too — same reasoning as `posts.score`.
  ],
);

/**
 * The unified vote model: one row per (voter, entity).
 *
 * `entityType` + `entityId` is a polymorphic reference — the original design, kept
 * because the vote RPC, the counter update and the reputation delta all branch on
 * `entityType` and there is no per-entity vote table to split into. The price is
 * that PostgreSQL cannot enforce `entityId` points at a real row; `castVote` checks
 * existence inside the transaction, which it had to do anyway to find the author.
 */
export const votes = pgTable(
  "votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("userId")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),

    entityType: text("entityType").notNull(),
    entityId: uuid("entityId").notNull(),

    /** `1` upvote, `-1` downvote. A removed vote is a deleted row, never a `0`. */
    voteValue: integer("voteValue").notNull(),

    createdAt: hasSeenAt("createdAt"),
  },
  (table) => [
    unique("votes_identity_key").on(table.userId, table.entityType, table.entityId),
    index("votes_entity_idx").on(table.entityType, table.entityId),
    check("votes_entity_type_check", sql`${table.entityType} in ('post', 'comment')`),
    check("votes_value_check", sql`${table.voteValue} in (1, -1)`),
  ],
);

export const polls = pgTable(
  "polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: hasSeenAt("createdAt"),
  },
  (table) => [
    /** One poll per post — the invariant the Supabase schema only documented. */
    unique("polls_post_key").on(table.postId),
  ],
);

export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("pollId")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    index("poll_options_poll_idx").on(table.pollId),
    /** Stable option order, and no two options can claim the same slot. */
    unique("poll_options_position_key").on(table.pollId, table.position),
    check("poll_options_label_check", sql`length(btrim(${table.label})) > 0`),
  ],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    pollId: uuid("pollId")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),

    pollOptionId: uuid("pollOptionId")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),

    userId: uuid("userId")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),

    createdAt: hasSeenAt("createdAt"),
  },
  (table) => [
    /** One vote per user per poll (`votePollOption` surfaces 23505 as a message). */
    unique("poll_votes_poll_user_key").on(table.pollId, table.userId),
    index("poll_votes_option_idx").on(table.pollOptionId),
  ],
);

/**
 * Document references. The bytes stay in Supabase Storage; this table owns the
 * pointer and the metadata.
 *
 * `attachment_path_owned` is carried over from the Supabase schema verbatim: the
 * storage path must begin `<uploaderUid>/<postId>/`, so a row cannot claim a file
 * belonging to someone else's folder. That check is the schema half of the
 * Storage-folder rule; the Storage policies are the other half and are unchanged.
 */
export const postAttachments = pgTable(
  "post_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    postId: uuid("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),

    uploaderUid: uuid("uploaderUid")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),

    storagePath: text("storagePath").notNull(),

    fileName: text("fileName").notNull(),
    mimeType: text("mimeType").notNull(),
    fileSize: integer("fileSize").notNull(),

    createdAt: hasSeenAt("createdAt"),
  },
  (table) => [
    unique("post_attachments_storage_path_key").on(table.storagePath),
    index("post_attachments_post_idx").on(table.postId),
    check("post_attachments_file_name_check", sql`length(${table.fileName}) between 1 and 255`),
    check(
      "post_attachments_mime_type_check",
      sql`${table.mimeType} in (
        'application/pdf', 'text/plain', 'text/csv', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )`,
    ),
    check(
      "post_attachments_file_size_check",
      sql`${table.fileSize} between 1 and ${sql.raw(String(MAX_ATTACHMENT_SIZE))}`,
    ),
    check(
      "attachment_path_owned",
      sql`split_part(${table.storagePath}, '/', 1) = ${table.uploaderUid}::text
          and split_part(${table.storagePath}, '/', 2) = ${table.postId}::text`,
    ),
  ],
);

/**
 * Bookmarks. The composite primary key *is* the duplicate rule: bookmarking twice
 * is a no-op insert conflict, and the earlier `select`-then-`insert` in
 * `toggleBookmark` becomes a single atomic statement.
 */
export const savedPosts = pgTable(
  "saved_posts",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),
    postId: uuid("postId")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: hasSeenAt("createdAt"),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.postId] }),
    index("saved_posts_post_idx").on(table.postId),
  ],
);

export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Poll = typeof polls.$inferSelect;
export type PollOption = typeof pollOptions.$inferSelect;
export type PollVote = typeof pollVotes.$inferSelect;
export type PostAttachmentRow = typeof postAttachments.$inferSelect;
export type SavedPost = typeof savedPosts.$inferSelect;
