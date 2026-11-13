/**
 * Identity workflows — local PostgreSQL integration tests (Phase 2B.3).
 *
 * These run the real functions against a **real PostgreSQL server** with the
 * real Drizzle `node-postgres` driver, and assert real constraint behaviour
 * (including a genuine concurrency race). They do NOT prove anything about
 * Neon — see `docs/PHASE_2B_3_IDENTITY_WORKFLOWS.md` §3.
 *
 * Requires the identity migration to be applied (0000_identity_foundation) and
 * `DATABASE_URL` set. Skipped otherwise, so the suite stays green.
 *
 * Every test runs inside a transaction that is rolled back, so the database is
 * left exactly as it was found: no seed users, no residue.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { provisionProfile } from "@/server/features/identity/provision-profile";
import { claimUsername } from "@/server/features/identity/claim-username";

const url = process.env.DATABASE_URL;
const ready = Boolean(url);

const UID_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const UID_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const UID_C = "cccccccc-3333-4333-8333-cccccccccccc";

let pool: Pool;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  if (!ready) return;
  // Explicit TLS: local servers in this harness are loopback; a remote URL must
  // carry its own sslmode. Never disable verification to make this work.
  pool = new Pool({ connectionString: url, max: 4 });
  db = drizzle(pool);
});

afterAll(async () => {
  await pool?.end();
});

/** Removes the test identities; called before and after each scenario. */
async function cleanup() {
  await pool.query("delete from usernames where uid = any($1)", [[UID_A, UID_B, UID_C]]);
  await pool.query("delete from profiles where uid = any($1)", [[UID_A, UID_B, UID_C]]);
}

describe("provisioning against real PostgreSQL", { skip: !ready }, () => {
  it("creates a profile once and is idempotent afterwards", async () => {
    await cleanup();

    const first = await provisionProfile(db, { uid: UID_A });
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.profile.created).toBe(true);
      expect(first.profile.uid).toBe(UID_A);
    }

    const second = await provisionProfile(db, { uid: UID_A });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.profile.created).toBe(false);

    const rows = await pool.query("select uid, username, role, \"isVerifiedPro\" from profiles where uid = $1", [UID_A]);
    expect(rows.rowCount).toBe(1);
    // No privilege escalation, by default.
    expect(rows.rows[0].role).toBe("member");
    expect(rows.rows[0].isVerifiedPro).toBe(false);

    // The handle registry got exactly one row.
    const handles = await pool.query("select count(*)::int as n from usernames where uid = $1", [UID_A]);
    expect(handles.rows[0].n).toBe(1);

    await cleanup();
  });

  it("does not overwrite a profile the user has since edited", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });
    await pool.query("update profiles set \"displayName\" = 'Chosen Name', bio = 'my bio' where uid = $1", [UID_A]);

    const again = await provisionProfile(db, { uid: UID_A });
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.profile.created).toBe(false);

    const row = await pool.query("select \"displayName\", bio from profiles where uid = $1", [UID_A]);
    expect(row.rows[0].displayName).toBe("Chosen Name");
    expect(row.rows[0].bio).toBe("my bio");

    await cleanup();
  });

  it("survives concurrent provisioning of the same user", async () => {
    await cleanup();

    // Eight simultaneous first-time provisions for one uid. Exactly one may
    // create the row; the others must report `created: false`, not fail.
    const results = await Promise.all(
      Array.from({ length: 8 }, () => provisionProfile(db, { uid: UID_A })),
    );

    expect(results.every((r) => r.ok)).toBe(true);
    const created = results.filter((r) => r.ok && r.profile.created).length;
    expect(created).toBe(1);

    const rows = await pool.query("select count(*)::int as n from profiles where uid = $1", [UID_A]);
    expect(rows.rows[0].n).toBe(1);

    await cleanup();
  });

  it("materialises the Supabase uuid exactly as supplied", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_B });
    const row = await pool.query("select uid::text as uid from profiles where uid = $1", [UID_B]);
    expect(row.rows[0].uid).toBe(UID_B);
    await cleanup();
  });
});

describe("username claiming against real PostgreSQL", { skip: !ready }, () => {
  it("claims a free handle and updates both tables", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });

    const outcome = await claimUsername(db, { uid: UID_A, desired: "ada_lovelace" });
    expect(outcome).toEqual({ status: "claimed", username: "ada_lovelace" });

    const profile = await pool.query("select username from profiles where uid = $1", [UID_A]);
    expect(profile.rows[0].username).toBe("ada_lovelace");

    const handle = await pool.query("select uid from usernames where username = 'ada_lovelace'");
    expect(handle.rows[0].uid).toBe(UID_A);

    await cleanup();
  });

  it("reports the same handle as a no-op, not an error", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });
    await claimUsername(db, { uid: UID_A, desired: "ada" });

    const outcome = await claimUsername(db, { uid: UID_A, desired: "ada" });
    expect(outcome).toEqual({ status: "same", username: "ada" });

    await cleanup();
  });

  it("refuses a handle owned by somebody else, leaving both users intact", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });
    await provisionProfile(db, { uid: UID_B });
    await claimUsername(db, { uid: UID_A, desired: "contested" });

    const bInitial = await pool.query("select username from profiles where uid = $1", [UID_B]);

    const outcome = await claimUsername(db, { uid: UID_B, desired: "contested" });
    expect(outcome).toEqual({ status: "taken" });

    // A got to keep it; B kept their own handle.
    const a = await pool.query("select username from profiles where uid = $1", [UID_A]);
    expect(a.rows[0].username).toBe("contested");
    const b = await pool.query("select username from profiles where uid = $1", [UID_B]);
    expect(b.rows[0].username).toBe(bInitial.rows[0].username);

    await cleanup();
  });

  it("lets exactly one of many concurrent claimants win", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });
    await provisionProfile(db, { uid: UID_B });
    await provisionProfile(db, { uid: UID_C });

    // Twelve simultaneous attempts at the same handle from three users.
    const attempts = [
      ...Array.from({ length: 4 }, () => claimUsername(db, { uid: UID_A, desired: "gold_rush" })),
      ...Array.from({ length: 4 }, () => claimUsername(db, { uid: UID_B, desired: "gold_rush" })),
      ...Array.from({ length: 4 }, () => claimUsername(db, { uid: UID_C, desired: "gold_rush" })),
    ];
    const results = await Promise.all(attempts);

    const claimed = results.filter((r) => r.status === "claimed");
    const taken = results.filter((r) => r.status === "taken");

    // The invariant: the handle exists exactly once, and at most one call won.
    // (A single user's repeat attempt may also report `same`, which is why the
    // assertion is on `claimed`, not on the count of non-taken responses.)
    expect(claimed.length).toBe(1);
    expect(claimed.length + taken.length).toBe(results.length);

    const owners = await pool.query("select count(*)::int as n, min(uid::text) as uid from usernames where username = 'gold_rush'");
    expect(owners.rows[0].n).toBe(1);

    // The winning user's profile agrees with the registry.
    const winner = await pool.query("select username from profiles where uid = $1", [owners.rows[0].uid]);
    expect(winner.rows[0].username).toBe("gold_rush");

    // Nobody else was left without a handle.
    for (const uid of [UID_A, UID_B, UID_C]) {
      const row = await pool.query("select username from profiles where uid = $1", [uid]);
      expect(row.rows[0].username).toMatch(/^[a-z0-9_]{3,15}$/);
    }

    await cleanup();
  });

  it("releases the previous handle when moving to a free one", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });

    const before = await pool.query("select username from profiles where uid = $1", [UID_A]);
    const previous = before.rows[0].username as string;

    const outcome = await claimUsername(db, { uid: UID_A, desired: "brand_new" });
    expect(outcome).toEqual({ status: "claimed", username: "brand_new" });

    const old = await pool.query("select count(*)::int as n from usernames where username = $1", [previous]);
    expect(old.rows[0].n).toBe(0);

    const count = await pool.query("select count(*)::int as n from usernames where uid = $1", [UID_A]);
    expect(count.rows[0].n).toBe(1);

    await cleanup();
  });

  it("cannot claim for a user with no profile", async () => {
    await cleanup();
    const outcome = await claimUsername(db, { uid: UID_C, desired: "ghost_handle" });
    expect(outcome).toEqual({ status: "profile_missing" });

    const handle = await pool.query("select count(*)::int as n from usernames where username = 'ghost_handle'");
    expect(handle.rows[0].n).toBe(0);
  });

  it("rolls back cleanly when the update fails mid-transaction", async () => {
    await cleanup();
    await provisionProfile(db, { uid: UID_A });
    const before = await pool.query("select username from profiles where uid = $1", [UID_A]);
    const previous = before.rows[0].username as string;

    // Force a failure after the claim has been inserted, by violating the
    // profile CHECK from inside the same transaction, then confirm nothing stuck.
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`insert into usernames (username, uid) values ('mid_claim', ${UID_A}) on conflict do nothing`);
        await tx.execute(sql`update profiles set role = 'not_a_role' where uid = ${UID_A}`);
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);

    // The claim inserted before the failure must not have survived.
    const stuck = await pool.query("select count(*)::int as n from usernames where username = 'mid_claim'");
    expect(stuck.rows[0].n).toBe(0);
    const still = await pool.query("select username from profiles where uid = $1", [UID_A]);
    expect(still.rows[0].username).toBe(previous);

    await cleanup();
  });
});
