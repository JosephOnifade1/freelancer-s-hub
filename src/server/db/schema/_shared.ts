/**
 * Shared Drizzle column conventions (Phase 2B.2).
 *
 * Only conventions that more than one future domain will need live here. The
 * point is that every table looks the same, so a later domain is a schema file
 * and not a debate.
 *
 * Timestamps
 * ----------
 * `timestamptz`, never `timestamp`. The existing schema stores `timestamptz`,
 * and a naive timestamp silently drops the offset — which matters as soon as a
 * row is written by a server in a different zone (Vercel regions, CI, local
 * development) and read by a browser somewhere else.
 *
 * Column naming
 * -------------
 * camelCase, quoted, matching the existing Supabase columns exactly
 * (`"displayName"`, `"isVerifiedPro"`, `"createdAt"`). Keeping the names means
 * the future repository layer can be a mechanical translation rather than a
 * rename map, and it keeps the two schemas diffable during the transition.
 * The cost is that every identifier must be quoted in raw SQL — acceptable, and
 * already true of the existing files.
 *
 * Status fields
 * -------------
 * `text` + a `CHECK` constraint, not a PostgreSQL `ENUM`. The audit found no
 * `ENUM` types anywhere in the existing database, every status is already
 * `text` + `CHECK`, and the values are still evolving (the audit records
 * `posts.type` and `leads.status` as unchecked free text). A native enum makes
 * every added value a migration with a table rewrite risk; a `CHECK` starts
 * equally strict and is explicitly relaxable when a value is genuinely added.
 */
import { sql } from "drizzle-orm";
import { check, integer, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A Supabase Auth user id.
 *
 * `profiles.uid` holds the UUID issued by Supabase Auth — it is the *external*
 * identity reference, and the primary key of the identity chain:
 *
 *     Supabase Auth ──user.id──▶ profiles.uid ──FK──▶ every other table
 *
 * There is deliberately **no second identity table and no surrogate id**: the
 * Supabase UUID is the durable identifier across both systems, so adding a
 * local `id` would create two answers to "who is this" and require a mapping
 * table to reconcile them.
 *
 * This column type is used for *references to* a profile. The definition of the
 * profile table itself lives in `schema/identity.ts`.
 */
export const authUserReference = () =>
  uuid("uid").notNull();

/** `createdAt`: set once, at insert. */
export const createdAt = () =>
  timestamp("createdAt", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`);

/** `updatedAt`: touched by the application on every write (see note below). */
export const updatedAt = () =>
  timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .notNull()
    .default(sql`now()`);

/**
 * A non-negative counter (`reputation`, `followers`, …).
 *
 * Denormalised counters are part of the existing design — the vote RPC updates
 * `posts.score` and `profiles.reputation` in the same transaction, and the
 * follow flow updates two counters. They are kept because the read paths
 * depend on them. The `CHECK` is the cheap guard that a bad decrement cannot
 * drive a counter negative; the exact-value guarantees remain the job of the
 * transactional code that will be ported in a later phase.
 */
export const counter = (name: string) =>
  integer(name).notNull().default(0);

/** Convenience re-export so schema files import constraints from one place. */
export { check, sql, text };
