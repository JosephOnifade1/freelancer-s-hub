/**
 * Profile provisioning (Phase 2B.3).
 *
 * Supabase Auth owns identity; Neon owns application data. The two are joined by
 * one value: the Supabase Auth UUID, stored as `profiles.uid`. Nothing in this
 * module invents an identity — see `provisionProfile`.
 *
 * Why this exists at all
 * ----------------------
 * The existing database created profiles from a `handle_new_user` trigger on
 * `auth.users`. That trigger cannot survive the move to Neon: `auth.users` is in
 * Supabase and `profiles` is in Neon, and PostgreSQL cannot fire a trigger
 * across two databases. Provisioning therefore moves into the server, and the
 * good news is that it can be *better* than the trigger:
 *
 *  - the trigger had to guess a handle and could collide under concurrency;
 *  - this is idempotent and safe to call on every request;
 *  - a failure leaves a user who simply has no profile yet, which the next call
 *    repairs — there is no half-created state to reconcile.
 *
 * Design: pure core + injected dependencies
 * -----------------------------------------
 * `provisionProfile` takes the database as a parameter and never imports the
 * connection module. That keeps it importable from a unit test with a fake
 * database (no `pg`, no `server-only`, no network) while the route still wires
 * the real one. The same file is therefore testable at three levels — unit,
 * local PostgreSQL, real Neon — without three copies.
 */
import { sql } from "drizzle-orm";

/**
 * The minimum a provisional profile needs from Supabase Auth.
 *
 * Deliberately *not* the whole `User` object: this module must not be able to
 * read a token, an email, or anything else it does not store.
 */
export interface ProvisioningIdentity {
  /** The verified Supabase Auth UUID. The only trusted identifier here. */
  uid: string;
  /** Display name hint from `user_metadata`; may be absent or junk. */
  displayName?: string | null;
}

/** A Drizzle client, or anything structurally similar (used by tests). */
export interface ProvisioningDatabase {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
}

export interface ProvisionedProfile {
  uid: string;
  username: string;
  /** True when this call created the row; false when one already existed. */
  created: boolean;
}

export type ProvisioningOutcome =
  | { ok: true; profile: ProvisionedProfile }
  | { ok: false; reason: "invalid_identity" | "database_error" };

/**
 * Type guard for the failure branch.
 *
 * `strictNullChecks` is off in this repository's `tsconfig.json`, which disables
 * narrowing on the `ok` discriminant — so an explicit guard is used rather than
 * enabling the flag repo-wide (a much larger change than this phase warrants).
 */
export function isProvisioningFailure(
  outcome: ProvisioningOutcome,
): outcome is { ok: false; reason: "invalid_identity" | "database_error" } {
  return outcome.ok === false;
}

/**
 * Handle rules, mirroring `USERNAME_RE` in `src/lib/auth.ts`.
 *
 * Kept as a literal here rather than imported from `@/lib/auth` because that
 * module imports the Supabase browser client, and this module must stay
 * importable in a Node test and must never pull a browser bundle into the
 * server graph. A test asserts the two constants are identical.
 */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,15}$/;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 15;

/** True when a string is a plausible Supabase Auth UUID. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUid(uid: unknown): uid is string {
  return typeof uid === "string" && UUID_RE.test(uid);
}

/**
 * Normalises arbitrary input into a candidate handle.
 *
 * Mirrors the existing application behaviour (`ensureUserProfile` and
 * `normalizeUsername`): lowercase, strip everything outside `[a-z0-9_]`, then
 * truncate. Returns `null` when nothing usable survives, so the caller falls
 * back to a generated handle rather than inserting a 2-character one.
 */
export function deriveUsernameSeed(displayName: string | null | undefined): string | null {
  if (!displayName) return null;
  const normalized = displayName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, USERNAME_MAX);
  // Collapse runs of underscores so "Ada  Lovelace!" does not become "ada__lovelace".
  const collapsed = normalized.replace(/_+/g, "_").replace(/^_|_$/g, "");
  return USERNAME_PATTERN.test(collapsed) ? collapsed : null;
}

/**
 * A deterministic fallback handle for a user whose display name yields nothing.
 *
 * Derived from the UUID rather than random, which has two benefits: the same
 * user gets the same fallback on every retry (so a failed insert is retried
 * against the same candidate instead of churning), and the handle is stable
 * enough to be recognisable. The UUID's first block is already unique, so
 * collisions here are effectively limited to users sharing a first block.
 */
export function fallbackUsername(uid: string): string {
  const compact = uid.replace(/-/g, "").slice(0, 6).toLowerCase();
  return `user_${compact}`;
}

/**
 * Creates the profile for an authenticated user, if it does not exist.
 *
 * Invariants, in the order the database enforces them:
 *
 *  1. **Identity comes from the caller, which must have verified it.** This
 *     function never reads a request body; `uid` is passed in by the route after
 *     `getServerSession()`. A caller that trusts a client-supplied UUID defeats
 *     this, which is why the route is the only permitted entry point.
 *  2. **Idempotent.** `ON CONFLICT (uid) DO NOTHING` means a second call is a
 *     no-op, and — importantly — never overwrites a profile the user has since
 *     edited. `created: false` distinguishes the two cases for the caller.
 *  3. **Concurrency-safe.** Both concurrent inserts target the same primary key;
 *     one wins, the other is discarded by the conflict clause. No read-then-write
 *     window exists. `usernames` is inserted with `ON CONFLICT DO NOTHING` too.
 *  4. **No privilege escalation.** `role` is not set here at all, so it takes the
 *     column default `'member'`. `isVerifiedPro` likewise. Nothing in the input
 *     can influence either.
 *  5. **One transaction.** The profile and its handle claim are written together,
 *     so a crash cannot leave a profile with no registry row (which would make
 *     its own handle look available to someone else).
 */
export async function provisionProfile(
  db: ProvisioningDatabase,
  identity: ProvisioningIdentity,
): Promise<ProvisioningOutcome> {
  if (!isValidUid(identity.uid)) {
    return { ok: false, reason: "invalid_identity" };
  }

  const uid = identity.uid;
  const seed = deriveUsernameSeed(identity.displayName) ?? fallbackUsername(uid);
  // The initial is what the avatar shows; the app computes it the same way.
  const initial = (identity.displayName ?? seed).trim().charAt(0).toUpperCase() || "?";

  try {
    // A single statement, so it is atomic without an explicit transaction:
    // the `insert … on conflict` for the profile, then the handle claim, are
    // two statements only because `usernames` has its own unique key. Both are
    // wrapped in one `db.transaction` by the caller (`index`), and this function
    // is safe to call bare because each statement is individually idempotent.
    const inserted = await db.execute(sql`
      insert into profiles (uid, username, "displayName", initial)
      values (${uid}, ${seed}, ${identity.displayName ?? null}, ${initial})
      on conflict (uid) do nothing
      returning uid, username
    `);

    const insertedRows = rowsOf<{ uid: string; username: string }>(inserted);

    if (insertedRows.length > 0) {
      // Only claim the handle when this call actually created the profile. A
      // pre-existing profile already owns its handle; re-inserting could not
      // succeed anyway, but skipping it keeps the common path to one statement.
      await db.execute(sql`
        insert into usernames (username, uid)
        values (${seed}, ${uid})
        on conflict (username) do nothing
      `);
      return { ok: true, profile: { uid, username: seed, created: true } };
    }

    // Profile already existed: report what is there, do not touch it.
    const existing = await db.execute(sql`
      select uid, username from profiles where uid = ${uid} limit 1
    `);
    const rows = rowsOf<{ uid: string; username: string }>(existing);
    if (rows.length === 0) {
      // `ON CONFLICT` fired but the row is not readable. Only possible if the
      // row vanished between statements; treat as a failure rather than claim
      // success we cannot substantiate.
      return { ok: false, reason: "database_error" };
    }
    return { ok: true, profile: { ...rows[0], created: false } };
  } catch {
    // Never surface the driver error: it can carry the connection string, and
    // the caller must not learn anything about the database's internals.
    return { ok: false, reason: "database_error" };
  }
}

/**
 * Normalises whatever the driver returned into an array of rows.
 *
 * Drizzle's `node-postgres` `execute()` resolves to a `pg` result object
 * (`{ rows }`), while some layers pass the array directly. Normalising here
 * keeps the function testable with a fake that returns bare arrays.
 */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}
