/**
 * Atomic username claiming (Phase 2B.3).
 *
 * The problem being replaced
 * --------------------------
 * `claimUsername` in `src/lib/users.ts` today is a check-then-write sequence
 * spread over four round trips:
 *
 *     select  usernames where username = $1        -- "is it free?"
 *     delete  usernames where username = $old      -- release the old one
 *     upsert  usernames (username, uid)
 *     update  profiles set username = $1 where uid = $uid
 *
 * Two users claiming the same free handle both pass the `select`, both write,
 * and the loser discovers the problem only when a unique constraint fires — by
 * which point the delete has already released their *previous* handle. The user
 * is left with no handle at all.
 *
 * The fix is to let the database decide the race. `usernames.username` is the
 * primary key, so a single `INSERT … ON CONFLICT DO NOTHING RETURNING` answers
 * "did I win?" atomically: one row back means this caller owns it, zero rows
 * means somebody else does.
 *
 * Why a transaction is still needed
 * ---------------------------------
 * The claim touches two tables (`usernames` and the denormalised
 * `profiles.username`) and must also release the claimant's previous handle.
 * Doing that without a transaction reintroduces a partial-failure window —
 * exactly the shape of the bug being fixed. So the whole thing runs in one
 * transaction, and the outcome is decided by the claim statement, not by a
 * preceding read.
 */
import { sql } from "drizzle-orm";

import { USERNAME_PATTERN, isValidUid, type ProvisioningDatabase } from "./provision-profile";

/**
 * Typed outcomes.
 *
 * These are returned, not thrown, because "taken" and "invalid" are ordinary
 * user-facing results — not exceptional conditions — and the route needs to map
 * them to status codes without inspecting error strings.
 */
export type ClaimUsernameOutcome =
  | { status: "claimed"; username: string }
  | { status: "invalid"; reason: string }
  | { status: "taken" }
  | { status: "same"; username: string }
  | { status: "profile_missing" }
  | { status: "failed" };

/** A transaction-capable database handle. Matches Drizzle's `db.transaction`. */
export interface ClaimDatabase {
  transaction: <T>(run: (tx: ProvisioningDatabase) => Promise<T>) => Promise<T>;
}

export interface ClaimUsernameInput {
  /** The verified Supabase Auth UUID. Never a value from the request body. */
  uid: string;
  /** The requested handle, as typed by the user. */
  desired: string;
}

/**
 * Normalises and validates a requested handle.
 *
 * Same rules as `USERNAME_RE` / `normalizeUsername` in `src/lib/auth.ts`:
 * lowercase, `[a-z0-9_]`, 3–15 characters. Returns `null` when invalid so the
 * caller produces a typed outcome rather than a thrown string.
 *
 * Note this does **not** silently repair input: it lowercases (because the
 * database stores lowercase and the app always has), but it rejects anything
 * else. Repairing a typo into a valid handle is how users end up with a name
 * they did not choose.
 */
export function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const candidate = input.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(candidate)) return null;
  return candidate;
}

/**
 * Claims a handle for an authenticated user.
 *
 * Order of operations, and why:
 *
 *  1. Validate the uid and the handle *before* touching the database. A bad
 *     UUID must never become a query.
 *  2. Read the current profile inside the transaction (locks nothing, but
 *     establishes whether the caller has a profile at all — claiming a handle
 *     for a nonexistent profile would create a registry row with no owner).
 *  3. If the requested handle is already the caller's, return `same` — a no-op,
 *     not an error. This keeps the settings form idempotent.
 *  4. **Release the old handle, then claim the new one.** The order matters and
 *     is forced by the schema: `usernames_uid_key` is UNIQUE (uid), so a user
 *     may own only one registry row. Claiming first would violate that key
 *     (found by the integration test in this phase, not by inspection).
 *
 *     The safety this ordering gives up — "never release a handle for a claim
 *     that fails" — is recovered by doing both inside **one transaction**: if
 *     the claim is taken, the transaction rolls back and the old handle is still
 *     there. Atomicity, not ordering, is what protects the user.
 *  5. Only after winning the claim, update the denormalised `profiles.username`.
 */
export async function claimUsername(
  db: ClaimDatabase,
  input: ClaimUsernameInput,
): Promise<ClaimUsernameOutcome> {
  if (!isValidUid(input.uid)) {
    return { status: "invalid", reason: "uid_must_be_a_uuid" };
  }

  const username = normalizeUsername(input.desired);
  if (!username) {
    return { status: "invalid", reason: "username_must_match_3_to_15_lowercase_alphanumeric_or_underscore" };
  }

  const uid = input.uid;

  try {
    return await db.transaction(async (tx) => {
      const profileRows = toRows<{ username: string }>(
        await tx.execute(sql`select username from profiles where uid = ${uid} limit 1`),
      );

      if (profileRows.length === 0) {
        return { status: "profile_missing" } as const;
      }

      const current = profileRows[0].username;
      if (current === username) {
        return { status: "same", username } as const;
      }

      // Release the caller's previous handle first: `usernames(uid)` is UNIQUE,
      // so holding two registry rows is impossible. Scoped by uid so it can only
      // ever touch the caller's own row.
      await tx.execute(sql`
        delete from usernames where username = ${current} and uid = ${uid}
      `);

      // The atomic claim. Exactly one concurrent caller receives a row.
      const claimed = toRows<{ username: string }>(
        await tx.execute(sql`
          insert into usernames (username, uid)
          values (${username}, ${uid})
          on conflict (username) do nothing
          returning username
        `),
      );

      if (claimed.length === 0) {
        // Taken. Throwing rolls back the delete above, so the caller keeps the
        // handle they started with — this is why the two statements share a
        // transaction.
        throw new UsernameTaken();
      }

      await tx.execute(sql`
        update profiles set username = ${username}, "updatedAt" = now() where uid = ${uid}
      `);

      return { status: "claimed", username } as const;
    });
  } catch (error) {
    if (error instanceof UsernameTaken) return { status: "taken" };
    // Driver errors can embed the connection string; never propagate them.
    return { status: "failed" };
  }
}

/** Internal control-flow signal for rolling back a lost race. */
class UsernameTaken extends Error {
  constructor() {
    super("username taken");
    this.name = "UsernameTaken";
  }
}

/** Normalises a driver result to rows (`pg` returns `{ rows }`). */
function toRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}
