/**
 * Profile domain queries (Phase 2C).
 *
 * The read/write core for profiles, in the same shape as the identity core from
 * 2B.3: **pure, dependency-injected, no `server-only` import**. The database
 * arrives as a parameter, so this file is unit-testable with a fake and
 * integration-testable against real PostgreSQL without a second copy of the SQL.
 * The `server-only` boundary lives in `./index.ts`, which is the only module that
 * imports the real connection.
 *
 * Why the whitelist matters
 * -------------------------
 * Supabase's `select("*")` cannot be reproduced against Neon without a decision
 * about which columns are public. That is not a convenience question: `role` is an
 * authorization input (`can_view_post` reads `profiles.role in ('admin',
 * 'moderator')`), so a "fetch the whole row" endpoint would ship every user's role
 * and verification status to any client. Every read below projects an explicit
 * column set, and the sets differ by audience.
 *
 * Ownership (Phase 2B.4 §5) is respected throughout: `email` is never selected
 * because it is not in this database; `avatarUrl` is a *reference* to a Supabase
 * Storage object, not the file.
 */
import { sql } from "drizzle-orm";

/** A Drizzle client, or anything structurally similar (used by tests). */
export interface ProfileDatabase {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}

/** Anything that can open a transaction (used by the write paths). */
export interface ProfileTransactionDatabase extends ProfileDatabase {
  transaction: <T>(run: (tx: ProfileDatabase) => Promise<T>) => Promise<T>;
}

/**
 * Drizzle's `node-postgres` driver returns `{ rows }`; a fake may return a bare
 * array. Both shapes are accepted so a test does not have to imitate the driver.
 */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const rows = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

// ─── Public projection ──────────────────────────────────────────────────────

/**
 * What any viewer may see about another user.
 *
 * Deliberately excludes `role` and `hasSeenVeteranCelebration` (internal), and
 * `reputation` is included only because the UI renders it publicly — it is not an
 * authorization input.
 */
export interface PublicProfile {
  uid: string;
  username: string;
  displayName: string | null;
  initial: string | null;
  bio: string;
  location: string;
  website: string;
  status: string;
  skills: string[];
  reputation: number;
  followers: number;
  following: number;
  avatarUrl: string | null;
  isVerifiedPro: boolean;
  createdAt: string | null;
  /**
   * The year the account joined, rendered as "Joined 2024" on the profile page.
   *
   * **Derived, not stored.** Supabase had a `profiles.joined text` column that
   * `ensureUserProfile` filled with the current year at creation; Phase 2B.2 did not
   * carry it into Neon. It is redundant with `createdAt`, so it is computed here rather
   * than added as a column: a second copy of the same fact is exactly the kind of
   * denormalisation that drifts. Rows created before this phase get the same value the
   * old column held, because that is what it was set to.
   */
  joined: string;
}

/**
 * What a viewer may see about **themselves**.
 *
 * Adds `role` and `hasSeenVeteranCelebration`: the first so the UI can show its own
 * admin affordances (it is still never *trusted* for authorization — that stays
 * server-side), the second because onboarding state belongs to the viewer.
 */
export interface OwnProfile extends PublicProfile {
  role: string;
  hasSeenVeteranCelebration: boolean;
  updatedAt: string | null;
}

/**
 * The columns of the public projection, in one place.
 *
 * `role` is absent on purpose. Adding it here would be a privilege leak: any
 * viewer could read whether an account is an admin.
 */
const PUBLIC_COLUMNS = sql`
  uid, username, "displayName", initial, bio, location, website, status,
  skills, reputation, followers, following, "avatarUrl", "isVerifiedPro", "createdAt"
`;

const OWN_COLUMNS = sql`
  uid, username, "displayName", initial, bio, location, website, status,
  skills, reputation, followers, following, "avatarUrl", "isVerifiedPro", "createdAt",
  role, "hasSeenVeteranCelebration", "updatedAt"
`;

/** Normalises a timestamp column to an ISO string (or null) for the client. */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Shapes a raw row into the public projection, dropping anything not selected. */
function toPublicProfile(row: Record<string, unknown>): PublicProfile {
  return {
    uid: String(row.uid),
    username: String(row.username),
    displayName: (row.displayName as string | null) ?? null,
    initial: (row.initial as string | null) ?? null,
    bio: String(row.bio ?? ""),
    location: String(row.location ?? ""),
    website: String(row.website ?? ""),
    status: String(row.status ?? "Available"),
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    reputation: Number(row.reputation ?? 0),
    followers: Number(row.followers ?? 0),
    following: Number(row.following ?? 0),
    avatarUrl: (row.avatarUrl as string | null) ?? null,
    isVerifiedPro: Boolean(row.isVerifiedPro),
    createdAt: iso(row.createdAt),
    joined: joinedYear(row.createdAt),
  };
}

/** The join year, derived from `createdAt` (see `PublicProfile.joined`). */
function joinedYear(createdAt: unknown): string {
  const value = iso(createdAt);
  return value ? value.slice(0, 4) : "";
}

function toOwnProfile(row: Record<string, unknown>): OwnProfile {
  return {
    ...toPublicProfile(row),
    role: String(row.role ?? "member"),
    hasSeenVeteranCelebration: Boolean(row.hasSeenVeteranCelebration),
    updatedAt: iso(row.updatedAt),
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * Looks a profile up by uid or by handle.
 *
 * The Supabase version did up to four round-trips plus a `getSession()` and an
 * `ensureUserProfile()` fallback. That last part is the important difference: a
 * **read** used to be able to *create* a profile, which made a GET a write and made
 * concurrency behaviour depend on which page you visited first. Reading is now
 * read-only. Creation belongs to provisioning, which is idempotent and server-owned.
 *
 * `username` is matched with `lower()` rather than `ilike` because the column has a
 * lowercase `CHECK`; an index-friendly exact match on `lower()` is equivalent, and
 * `ilike` would treat `%` and `_` in user input as wildcards. The Supabase version
 * escaped them by hand; not doing pattern matching at all is stronger.
 */
export async function findProfileByIdentifier(
  db: ProfileDatabase,
  identifier: string,
): Promise<PublicProfile | null> {
  const clean = identifier.startsWith("@") ? identifier.slice(1).trim() : identifier.trim();
  if (!clean) return null;

  const isUuid = UUID_RE.test(clean);

  const query = isUuid
    ? sql`select ${PUBLIC_COLUMNS} from profiles where uid = ${clean} limit 1`
    : sql`select ${PUBLIC_COLUMNS} from profiles where username = lower(${clean}) limit 1`;

  const rows = rowsOf<Record<string, unknown>>(await db.execute(query));
  return rows.length > 0 ? toPublicProfile(rows[0]) : null;
}

/** The viewer's own profile, including fields only they may see. */
export async function findOwnProfile(db: ProfileDatabase, uid: string): Promise<OwnProfile | null> {
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`select ${OWN_COLUMNS} from profiles where uid = ${uid} limit 1`),
  );
  return rows.length > 0 ? toOwnProfile(rows[0]) : null;
}

/** A public projection for several uids at once. Used by list surfaces. */
export async function findProfilesByUids(
  db: ProfileDatabase,
  uids: string[],
): Promise<PublicProfile[]> {
  if (uids.length === 0) return [];
  // Deduplicated: the same author can appear many times in a feed, and asking the
  // database for the same row repeatedly is waste the old per-row loop accepted.
  const unique = [...new Set(uids)];
  // `sql.join` rather than `= any($1)`: drizzle-orm's `node-postgres` binding sends a
  // JS array as a JSON-ish parameter, and PostgreSQL rejects it with
  // "op ANY/ALL (array) requires array on right side" (SQLSTATE 42809). Discovered by
  // the integration test in this phase, not by inspection. A joined parameter list is
  // explicit, keeps every value bound, and works for any array length.
  const placeholders = sql.join(
    unique.map((uid) => sql`${uid}`),
    sql`, `,
  );
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`select ${PUBLIC_COLUMNS} from profiles where uid in (${placeholders})`),
  );
  return rows.map(toPublicProfile);
}

/** Top profiles by reputation — the leaderboard/contributors surface. */
export async function findTopProfiles(db: ProfileDatabase, limit: number): Promise<PublicProfile[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit) || 5, 1), 50);
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(
      sql`select ${PUBLIC_COLUMNS} from profiles order by reputation desc limit ${bounded}`,
    ),
  );
  return rows.map(toPublicProfile);
}

/**
 * Free-text profile search.
 *
 * Uses `ilike` deliberately here — this *is* a pattern search — with the term
 * escaped so a user typing `%` searches for a literal percent sign.
 */
export async function searchProfiles(
  db: ProfileDatabase,
  term: string,
  limit = 10,
): Promise<PublicProfile[]> {
  const trimmed = term.trim();
  if (!trimmed) return [];
  const escaped = trimmed.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;
  const bounded = Math.min(Math.max(Math.trunc(limit) || 10, 1), 50);

  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select ${PUBLIC_COLUMNS} from profiles
      where "displayName" ilike ${pattern}
         or username ilike ${pattern}
         or bio ilike ${pattern}
      order by reputation desc
      limit ${bounded}
    `),
  );
  return rows.map(toPublicProfile);
}

/**
 * Whether a handle is free.
 *
 * Two sources must both be clear, exactly as before: the `usernames` registry is
 * the atomic authority, and `profiles.username` carries the unique index that
 * actually fails at insert time. They can drift, and a check that consults only one
 * of them reintroduces the race the 2B.3 claim was built to remove.
 */
export async function isUsernameAvailable(db: ProfileDatabase, username: string): Promise<boolean> {
  const clean = username.toLowerCase();
  if (!USERNAME_PATTERN.test(clean)) return false;

  const rows = rowsOf<{ taken: boolean }>(
    await db.execute(sql`
      select exists(
        select 1 from usernames where username = ${clean}
        union all
        select 1 from profiles where username = ${clean}
      ) as taken
    `),
  );
  return !rows[0]?.taken;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Fields a user may change about themselves.
 *
 * A closed set, and that is the authorization boundary for writes. `role`,
 * `isVerifiedPro`, `reputation`, `followers` and `following` are **not** here, so no
 * request shape can reach them — the same structural approach as
 * `claimUsernameForCurrentUser` having no uid parameter. Adding one of them later
 * must be a deliberate act, not an accident of spreading a request body into SQL.
 */
export interface EditableProfileFields {
  displayName?: string | null;
  bio?: string;
  location?: string;
  website?: string;
  status?: "Available" | "Busy";
  skills?: string[];
  avatarUrl?: string | null;
  hasSeenVeteranCelebration?: boolean;
}

const MAX_TEXT_LENGTH = 5000;
const MAX_SKILLS = 50;
const MAX_SKILL_LENGTH = 40;

/**
 * Trims and bounds a text field.
 *
 * The database has no length limits beyond `text`, so an unbounded bio is a
 * storage and rendering problem. This is validation, not sanitisation — React
 * escapes on render, and text never becomes SQL.
 */
function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function cleanSkills(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().slice(0, MAX_SKILL_LENGTH))
    .filter((s) => s.length > 0)
    .slice(0, MAX_SKILLS);
  return [...new Set(cleaned)];
}

/** The `UserProfile.status` values the schema allows. Anything else is ignored. */
function cleanStatus(value: unknown): "Available" | "Busy" | undefined {
  return value === "Available" || value === "Busy" ? value : undefined;
}

/**
 * Builds the `set` list for an update, one fragment per supplied field.
 *
 * Only fields that were actually supplied appear, so a partial update cannot blank
 * a column the caller did not mention. `updatedAt` is always bumped.
 */
function buildUpdateSet(fields: EditableProfileFields): ReturnType<typeof sql>[] | null {
  const set: ReturnType<typeof sql>[] = [];

  if ("displayName" in fields) {
    const value = cleanText(fields.displayName);
    set.push(sql`"displayName" = ${value ?? null}`);
    // `initial` is a single capital derived from the display name, rendered on
    // avatars. It used to be computed by each caller (Onboarding wrote
    // `displayName.charAt(0).toUpperCase()`); doing it here means the two columns
    // cannot disagree, and no caller has to remember.
    const initial = value && value.length > 0 ? value.charAt(0).toUpperCase() : null;
    set.push(sql`initial = ${initial}`);
  }
  if ("bio" in fields) set.push(sql`bio = ${cleanText(fields.bio) ?? ""}`);
  if ("location" in fields) set.push(sql`location = ${cleanText(fields.location) ?? ""}`);
  if ("website" in fields) set.push(sql`website = ${cleanText(fields.website) ?? ""}`);
  if ("avatarUrl" in fields) {
    const value = cleanText(fields.avatarUrl);
    set.push(sql`"avatarUrl" = ${value && value.length > 0 ? value : null}`);
  }

  const status = cleanStatus(fields.status);
  if (status) set.push(sql`status = ${status}`);

  const skills = cleanSkills(fields.skills);
  if (skills) set.push(sql`skills = ${skills}`);

  if (typeof fields.hasSeenVeteranCelebration === "boolean") {
    set.push(sql`"hasSeenVeteranCelebration" = ${fields.hasSeenVeteranCelebration}`);
  }

  if (set.length === 0) return null;
  set.push(sql`"updatedAt" = now()`);
  return set;
}

export type ProfileUpdateOutcome =
  | { status: "updated"; profile: OwnProfile }
  | { status: "profile_missing" }
  | { status: "invalid" }
  | { status: "failed" };

/**
 * Updates the caller's own profile.
 *
 * `uid` is passed in by the caller, which on the server means the verified session
 * uid — never a request body. The `where uid = …` clause is the ownership check.
 *
 * Returns `profile_missing` rather than silently affecting zero rows, so a client
 * can distinguish "your profile does not exist yet" (provisioning has not landed)
 * from "the write failed". The old `Settings` code inferred this from
 * `data.length === 0` after a `.select("uid")`, which was the right instinct —
 * PostgREST does not error on a zero-row update either.
 */
export async function updateOwnProfile(
  db: ProfileDatabase,
  uid: string,
  fields: EditableProfileFields,
): Promise<ProfileUpdateOutcome> {
  if (!isValidUid(uid)) return { status: "invalid" };

  const set = buildUpdateSet(fields);
  if (!set) return { status: "invalid" };

  try {
    const rows = rowsOf<Record<string, unknown>>(
      await db.execute(sql`
        update profiles
        set ${sql.join(set, sql`, `)}
        where uid = ${uid}
        returning ${OWN_COLUMNS}
      `),
    );

    if (rows.length === 0) return { status: "profile_missing" };
    return { status: "updated", profile: toOwnProfile(rows[0]) };
  } catch {
    // Driver messages embed the connection string; never let one escape.
    return { status: "failed" };
  }
}

/**
 * Sets the avatar reference for the caller's own profile.
 *
 * Separated from `updateOwnProfile` because it is the one write whose *value* is
 * produced by another service: the URL comes from Supabase Storage. Ownership of
 * the file stays with Storage (2B.4 §5); this only records the pointer.
 *
 * The URL is validated as http(s) rather than stored on trust. A `javascript:` or
 * `data:` URL in `avatarUrl` would be rendered straight into an `<img src>` by the
 * client; rejecting it here is the only place the check can be enforced for every
 * caller.
 */
export async function setOwnAvatar(
  db: ProfileDatabase,
  uid: string,
  url: string,
): Promise<ProfileUpdateOutcome> {
  if (!isValidUid(uid)) return { status: "invalid" };
  if (!isHttpUrl(url)) return { status: "invalid" };
  return updateOwnProfile(db, uid, { avatarUrl: url });
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Recomputes `reputation` from a caller-supplied total.
 *
 * Kept narrow on purpose. Reputation is *derived* from posts and comments, which
 * still live in Supabase, so the computation stays where those tables are and only
 * the result is written here. This is a deliberate seam: when posts and votes move,
 * the sum must move with them rather than being trusted from the client.
 *
 * Guarded to non-negative integers because the column has a `CHECK`, and a negative
 * reputation would be a bug surfacing as a constraint violation.
 */
export async function setReputation(
  db: ProfileDatabase,
  uid: string,
  total: number,
): Promise<{ status: "updated" | "invalid" | "profile_missing" | "failed" }> {
  if (!isValidUid(uid)) return { status: "invalid" };
  if (!Number.isFinite(total) || total < 0) return { status: "invalid" };

  try {
    const rows = rowsOf<{ uid: string }>(
      await db.execute(sql`
        update profiles set reputation = ${Math.trunc(total)}, "updatedAt" = now()
        where uid = ${uid} returning uid
      `),
    );
    return rows.length > 0 ? { status: "updated" } : { status: "profile_missing" };
  } catch {
    return { status: "failed" };
  }
}

/**
 * Adjusts `followers` / `following` counters.
 *
 * Replaces the `increment_followers` / `decrement_followers` RPCs. The `where`
 * clauses mirror them: a counter is bounded at zero, so a decrement that would go
 * negative simply does not apply. `follows` itself stays in Supabase for now, so
 * this is called with the same arguments the RPC received.
 */
export type CounterField = "followers" | "following";

export async function adjustProfileCounter(
  db: ProfileDatabase,
  uid: string,
  field: CounterField,
  delta: 1 | -1,
): Promise<{ status: "updated" | "invalid" | "failed" }> {
  if (!isValidUid(uid)) return { status: "invalid" };
  if (field !== "followers" && field !== "following") return { status: "invalid" };

  const column = sql.raw(field);
  const expression =
    delta === 1
      ? sql`${column} + 1`
      : sql`case when ${column} > 0 then ${column} - 1 else 0 end`;

  try {
    await db.execute(sql`update profiles set ${column} = ${expression}, "updatedAt" = now() where uid = ${uid}`);
    return { status: "updated" };
  } catch {
    return { status: "failed" };
  }
}

// ─── Shared validation ──────────────────────────────────────────────────────

/** Mirrors `USERNAME_PATTERN` in `provision-profile.ts` and the database CHECK. */
const USERNAME_PATTERN = /^[a-z0-9_]{3,15}$/;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUid(uid: unknown): uid is string {
  return typeof uid === "string" && UUID_RE.test(uid);
}

// ─── Moderation projection ──────────────────────────────────────────────────

/** A profile row that includes `role`. Moderation/admin surfaces only. */
export interface ModerationProfile {
  uid: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  reputation: number;
  isVerifiedPro: boolean;
  role: string;
}

/**
 * Profiles for the moderation queue, **including `role`**.
 *
 * The only query in this module that selects `role` for other users, which is why it
 * is not reachable from any public route: the route that calls it verifies the
 * caller's own role first (`/api/profiles/moderation`). Keeping it here rather than
 * widening `findTopProfiles` means the public projection can never accidentally carry
 * the column — the leak would have to be a deliberate edit to this function.
 */
export async function findModerationProfiles(
  db: ProfileDatabase,
  limit: number,
): Promise<ModerationProfile[]> {
  const bounded = Math.min(Math.max(Math.trunc(limit) || 50, 1), 200);
  const rows = rowsOf<Record<string, unknown>>(
    await db.execute(sql`
      select uid, username, "displayName", "avatarUrl", reputation, "isVerifiedPro", role
      from profiles
      order by reputation desc
      limit ${bounded}
    `),
  );

  return rows.map((row) => ({
    uid: String(row.uid),
    username: String(row.username),
    displayName: (row.displayName as string | null) ?? null,
    avatarUrl: (row.avatarUrl as string | null) ?? null,
    reputation: Number(row.reputation ?? 0),
    isVerifiedPro: Boolean(row.isVerifiedPro),
    role: String(row.role ?? "member"),
  }));
}
