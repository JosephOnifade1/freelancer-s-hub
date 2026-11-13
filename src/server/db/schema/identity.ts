/**
 * Identity domain: `profiles` and `usernames` (Phase 2B.2).
 *
 * This is the anchor of the whole schema. Every other table in the audited
 * database references `profiles.uid`, so getting this right constrains
 * everything that follows.
 *
 * Derivation
 * ----------
 * The columns here were not copied from `supabase_schema.sql`. They were
 * reconciled against the *running application code* in this repository, because
 * the SQL and the app disagree in two places:
 *
 *  1. The SQL declares `profiles.favoriteTopics` — it does not exist. The field
 *     is only in the TypeScript `UserProfile` type (`src/lib/users.ts`) and is
 *     never written or read. **Not added** (no speculative fields).
 *  2. The SQL's `handle_new_user` inserts default literals
 *     (`bio = 'New to Borynx!'`, `location = 'Earth'`), while
 *     `src/lib/users.ts` writes `'New freelancer on Borynx!'` and `'Earth'` and
 *     `supabase_profile_defaults_migration.sql` resets both to `''`. The column
 *     *defaults* are therefore `''` here, matching the migration and the
 *     settings page (which treats empty as "not set").
 *
 * Fields confirmed as load-bearing by the app and kept: `username`,
 * `displayName`, `initial` (rendered in `AppLayout` and `UserHoverCard`),
 * `bio`, `location`, `website`, `status` (`AppLayout` treats `'Available'` as
 * "open to work"), `skills`, `reputation` (leaderboard + vote RPC delta),
 * `followers`/`following` (follow flow), `avatarUrl`, `isVerifiedPro`, `role`
 * (authorization: `posts.ts` checks `admin`/`moderator`),
 * `hasSeenVeteranCelebration` (onboarding), `createdAt`.
 *
 * Deliberately dropped: `communitiesList` (jsonb). The audit recorded it as dead
 * — membership lives in `community_members`, and Phase 2A lists it as risk R12.
 * Carrying a duplicate, unenforced membership list into a clean database would
 * import a known inconsistency. This is a deliberate divergence, recorded in
 * docs/PHASE_2B_2_DATABASE_FOUNDATION.md §6.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** The three roles the application understands (`src/lib/reports.ts`). */
export const PROFILE_ROLES = ["admin", "moderator", "member"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

/**
 * Work-availability values.
 *
 * Only two are ever written (`AppLayout` toggles `'Available'` ⟷ `'Busy'`), and
 * `'Available'` is the column default. The check is intentionally a superset the
 * app does not yet use — see the note in `docs/PHASE_2B_2_DATABASE_FOUNDATION.md
 * §6` — because a `CHECK` that rejects a value the UI can produce is a worse
 * failure than a slightly wider set.
 */
export const PROFILE_STATUSES = ["Available", "Busy"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/** Handle format, identical to `USERNAME_RE` in `src/lib/auth.ts`. */
export const USERNAME_PATTERN = "^[a-z0-9_]{3,15}$";

/**
 * Application profiles — one row per Supabase Auth user.
 *
 * `uid` is the Supabase Auth UUID and the primary key. It is a plain `uuid`
 * column with **no** foreign key: `auth.users` lives in a different database
 * (and, for now, a different provider), and PostgreSQL cannot enforce a
 * reference across that boundary. The link is maintained by the server-side
 * account lifecycle, not by the schema — see the report §8.
 */
export const profiles = pgTable(
  "profiles",
  {
    uid: uuid("uid").primaryKey(),

    /**
     * The handle, always stored lowercase.
     *
     * Kept on `profiles` as well as in `usernames` because the application reads
     * it directly in ~20 join sites (`profiles!posts_authorUid_fkey (username,
     * displayName, …)`) and nearly every query selects it. `usernames` is the
     * authoritative registry that makes a handle claim atomic; `profiles.username`
     * is the denormalised copy those reads use.
     *
     * Lowercase-only storage is enforced by the `CHECK` below, which is what
     * makes the UNIQUE index effectively case-insensitive without `citext`.
     * The application already lowercases at every entry point
     * (`claimUsername`, `checkUsernameAvailability`, `ensureUserProfile`), so
     * this constraint formalises existing behaviour rather than adding a rule.
     */
    username: text("username").notNull(),

    displayName: text("displayName"),
    /** Single uppercase letter shown on avatars; written by the app, not derived in SQL. */
    initial: text("initial"),
    bio: text("bio").notNull().default(""),
    location: text("location").notNull().default(""),
    website: text("website").notNull().default(""),
    status: text("status").notNull().default("Available"),

    skills: text("skills")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    reputation: integer("reputation").notNull().default(0),
    followers: integer("followers").notNull().default(0),
    following: integer("following").notNull().default(0),

    avatarUrl: text("avatarUrl"),
    isVerifiedPro: boolean("isVerifiedPro").notNull().default(false),
    hasSeenVeteranCelebration: boolean("hasSeenVeteranCelebration")
      .notNull()
      .default(false),
    role: text("role").notNull().default("member"),

    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("profiles_username_key").on(table.username),
    index("profiles_role_idx").on(table.role),
    index("profiles_reputation_idx").on(table.reputation),
    check(
      "profiles_role_check",
      sql`${table.role} in ('admin', 'moderator', 'member')`,
    ),
    check("profiles_status_check", sql`${table.status} in ('Available', 'Busy')`),
    check("profiles_username_lowercase_check", sql`${table.username} = lower(${table.username})`),
    check("profiles_username_format_check", sql`${table.username} ~ '${sql.raw(USERNAME_PATTERN)}'`),
    check("profiles_reputation_non_negative", sql`${table.reputation} >= 0`),
    check("profiles_followers_non_negative", sql`${table.followers} >= 0`),
    check("profiles_following_non_negative", sql`${table.following} >= 0`),
  ],
);

/**
 * The authoritative handle registry.
 *
 * Why a second table when `profiles.username` is already unique: claiming a
 * handle has to be atomic *across* two facts — "this handle is not taken" and
 * "this user now owns it". Without a single unique key to insert against, two
 * concurrent claims both read "available" and both write, and the loser's
 * `profiles.username` update fails with a constraint error after the sidebar
 * already said it succeeded.
 *
 * With this table, claiming is one statement:
 *
 *     insert into usernames (username, uid) values ($1, $2)
 *     on conflict (username) do nothing returning username;
 *
 * A returned row means the claim succeeded; no row means it was taken. The
 * database decides the race, not the application. This is the same role the
 * table plays today (`claimUsername` in `src/lib/users.ts`), but as a real
 * constraint rather than a check-then-write sequence.
 *
 * `usernames.username` is the PRIMARY KEY, so uniqueness is case-sensitive at
 * the storage level — made case-insensitive by the lowercase `CHECK`, exactly
 * as on `profiles`. `citext` was considered and rejected: it hides case folding
 * inside the type (so `where username = $1` silently becomes case-insensitive,
 * including for partial-index and collation reasoning), needs an extension, and
 * buys nothing here because the application normalises on every write path
 * already.
 */
export const usernames = pgTable(
  "usernames",
  {
    username: text("username").primaryKey(),
    /**
     * The owning profile. A real FK *inside* Neon, so deleting a profile
     * releases its handle automatically.
     *
     * Nullable only because a domain could reserve a handle before a profile
     * exists (none does today); existing behaviour always inserts both.
     */
    uid: uuid("uid").references(() => profiles.uid, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    uniqueIndex("usernames_uid_key").on(table.uid),
    check("usernames_username_lowercase_check", sql`${table.username} = lower(${table.username})`),
    check("usernames_username_format_check", sql`${table.username} ~ '${sql.raw(USERNAME_PATTERN)}'`),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Username = typeof usernames.$inferSelect;
export type NewUsername = typeof usernames.$inferInsert;
