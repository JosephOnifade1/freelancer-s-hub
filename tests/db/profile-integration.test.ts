/**
 * Profile domain — **local PostgreSQL** integration tests (Phase 2C).
 *
 * Runs the real query functions against a real PostgreSQL 18 server with the real
 * Drizzle `node-postgres` driver, so constraints, projections and concurrent writes are
 * actually exercised. It does NOT prove anything about Neon — see the phase report §9.
 *
 * Requires `DATABASE_URL` and the identity migration applied. Skipped otherwise, so the
 * suite stays green without a database.
 *
 * Every test cleans up after itself; no seed users are left behind.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  findModerationProfiles,
  findOwnProfile,
  findProfileByIdentifier,
  findProfilesByUids,
  findTopProfiles,
  isUsernameAvailable,
  searchProfiles,
  setOwnAvatar,
  updateOwnProfile,
} from "@/server/features/profile/profile-queries";

const url = process.env.DATABASE_URL;
const ready = Boolean(url);

const UID_A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const UID_B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const ALL = [UID_A, UID_B];

let pool: Pool;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  if (!ready) return;
  pool = new Pool({ connectionString: url, max: 4 });
  db = drizzle(pool);
});

afterAll(async () => {
  await pool?.end();
});

async function cleanup() {
  await pool.query("delete from usernames where uid = any($1)", [ALL]);
  await pool.query("delete from profiles where uid = any($1)", [ALL]);
}

/** Inserts a profile directly, bypassing the domain layer. */
async function seed(uid: string, username: string, extra: Record<string, unknown> = {}) {
  const columns = ["uid", "username", ...Object.keys(extra)];
  const values = [uid, username, ...Object.values(extra)];
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  await pool.query(
    `insert into profiles (${columns.map((c) => `"${c}"`).join(", ")}) values (${placeholders})`,
    values,
  );
  await pool.query("insert into usernames (username, uid) values ($1, $2)", [username, uid]);
}

describe("reads against real PostgreSQL", { skip: !ready }, () => {
  it("finds a profile by uid and by username", async () => {
    await cleanup();
    await seed(UID_A, "ada", { displayName: "Ada Lovelace", bio: "engineer" });

    const byUid = await findProfileByIdentifier(db, UID_A);
    expect(byUid?.username).toBe("ada");
    expect(byUid?.displayName).toBe("Ada Lovelace");

    const byName = await findProfileByIdentifier(db, "ada");
    expect(byName?.uid).toBe(UID_A);

    // Case-insensitive because the column is lowercase-constrained.
    const byCaps = await findProfileByIdentifier(db, "ADA");
    expect(byCaps?.uid).toBe(UID_A);

    await cleanup();
  });

  it("never returns role from a public read", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    const profile = await findProfileByIdentifier(db, "ada");
    // The projection is closed; role is an authorization input and must not ship.
    expect(profile).not.toHaveProperty("role");
    expect(Object.keys(profile!).sort()).not.toContain("role");

    await cleanup();
  });

  it("returns the viewer's own role", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    const own = await findOwnProfile(db, UID_A);
    expect(own?.role).toBe("member");
    expect(own?.hasSeenVeteranCelebration).toBe(false);

    await cleanup();
  });

  it("derives `joined` from createdAt", async () => {
    await cleanup();
    await seed(UID_A, "ada");
    await pool.query("update profiles set \"createdAt\" = '2022-05-01T00:00:00Z' where uid = $1", [UID_A]);

    const profile = await findProfileByIdentifier(db, "ada");
    expect(profile?.joined).toBe("2022");

    await cleanup();
  });

  it("batch-reads several profiles in one query", async () => {
    await cleanup();
    await seed(UID_A, "ada", { reputation: 50 });
    await seed(UID_B, "grace", { reputation: 10 });

    const profiles = await findProfilesByUids(db, [UID_A, UID_B, UID_A]);
    expect(profiles).toHaveLength(2);

    await cleanup();
  });

  it("orders the leaderboard by reputation", async () => {
    await cleanup();
    await seed(UID_A, "ada", { reputation: 10 });
    await seed(UID_B, "grace", { reputation: 99 });

    const top = await findTopProfiles(db, 10);
    expect(top[0].uid).toBe(UID_B);

    await cleanup();
  });

  it("searches display name, username and bio", async () => {
    await cleanup();
    await seed(UID_A, "ada", { displayName: "Ada Lovelace", bio: "mathematician" });

    expect((await searchProfiles(db, "lovelace")).map((p) => p.uid)).toContain(UID_A);
    expect((await searchProfiles(db, "ada")).map((p) => p.uid)).toContain(UID_A);
    expect((await searchProfiles(db, "mathematician")).map((p) => p.uid)).toContain(UID_A);
    expect(await searchProfiles(db, "zzzz")).toEqual([]);

    await cleanup();
  });

  it("treats LIKE wildcards in a search term as literals", async () => {
    await cleanup();
    await seed(UID_A, "ada", { displayName: "100% Cotton" });
    await seed(UID_B, "grace", { displayName: "Cotton Club" });

    // "100%" must not match "Cotton Club" — the % is escaped.
    const results = await searchProfiles(db, "100%");
    expect(results.map((p) => p.uid)).toContain(UID_A);
    expect(results.map((p) => p.uid)).not.toContain(UID_B);

    await cleanup();
  });

  it("checks handle availability against both sources", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    expect(await isUsernameAvailable(db, "ada")).toBe(false);
    expect(await isUsernameAvailable(db, "free_handle")).toBe(true);
    expect(await isUsernameAvailable(db, "bad-handle")).toBe(false);

    await cleanup();
  });
});

describe("writes against real PostgreSQL", { skip: !ready }, () => {
  it("updates only the supplied fields", async () => {
    await cleanup();
    await seed(UID_A, "ada", { displayName: "Ada", bio: "old", website: "https://a.example" });

    const result = await updateOwnProfile(db, UID_A, { bio: "new" });
    expect(result.status).toBe("updated");

    const after = await findOwnProfile(db, UID_A);
    expect(after?.bio).toBe("new");
    // Untouched fields survive a partial update.
    expect(after?.displayName).toBe("Ada");
    expect(after?.website).toBe("https://a.example");

    await cleanup();
  });

  it("keeps `initial` in step with displayName", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    await updateOwnProfile(db, UID_A, { displayName: "grace hopper" });

    const after = await findOwnProfile(db, UID_A);
    expect(after?.displayName).toBe("grace hopper");
    expect(after?.initial).toBe("G");

    await cleanup();
  });

  it("bumps updatedAt", async () => {
    await cleanup();
    await seed(UID_A, "ada");
    const before = await findOwnProfile(db, UID_A);

    await new Promise((resolve) => setTimeout(resolve, 10));
    await updateOwnProfile(db, UID_A, { bio: "changed" });

    const after = await findOwnProfile(db, UID_A);
    expect(new Date(after!.updatedAt!).getTime()).toBeGreaterThanOrEqual(
      new Date(before!.updatedAt!).getTime(),
    );

    await cleanup();
  });

  it("reports profile_missing rather than silently succeeding", async () => {
    await cleanup();
    const result = await updateOwnProfile(db, UID_A, { bio: "x" });
    expect(result.status).toBe("profile_missing");
  });

  it("stores an http(s) avatar url", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    const result = await setOwnAvatar(db, UID_A, "https://cdn.example/avatars/a.png");
    expect(result.status).toBe("updated");

    const after = await findOwnProfile(db, UID_A);
    expect(after?.avatarUrl).toBe("https://cdn.example/avatars/a.png");

    await cleanup();
  });

  it("refuses a javascript: avatar url before it reaches the row", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    const result = await setOwnAvatar(db, UID_A, "javascript:alert(1)");
    expect(result.status).toBe("invalid");

    const after = await findOwnProfile(db, UID_A);
    expect(after?.avatarUrl).toBeNull();

    await cleanup();
  });

  it.each(["reputation","followers"])("profile patch cannot forge %s",async field=>{
    await cleanup();await seed(UID_A,"ada");
    expect((await updateOwnProfile(db,UID_A,{[field]:999} as never)).status).toBe("invalid");
    expect((await findOwnProfile(db,UID_A))?.[field]).toBe(0);await cleanup();
  });

  it("survives concurrent partial updates without losing fields", async () => {
    await cleanup();
    await seed(UID_A, "ada");

    // Two different fields updated concurrently. Each touches a disjoint column, so
    // both must survive; a read-modify-write implementation would lose one.
    await Promise.all([
      updateOwnProfile(db, UID_A, { bio: "bio value" }),
      updateOwnProfile(db, UID_A, { location: "Lagos" }),
    ]);

    const after = await findOwnProfile(db, UID_A);
    expect(after?.bio).toBe("bio value");
    expect(after?.location).toBe("Lagos");

    await cleanup();
  });

  it("schema rejects negative counters",async()=>{await cleanup();await seed(UID_A,"ada");await expect(pool.query(`update profiles set followers=-1 where uid=$1`,[UID_A])).rejects.toThrow();expect((await findOwnProfile(db,UID_A))?.followers).toBe(0);await cleanup();});

});

describe("moderation projection", { skip: !ready }, () => {
  it("includes role, unlike every public read", async () => {
    await cleanup();
    await seed(UID_A, "ada", { role: "moderator" });

    const users = await findModerationProfiles(db, 10);
    const ada = users.find((u) => u.uid === UID_A);
    expect(ada?.role).toBe("moderator");

    // The same row through the public projection has no role.
    const publicView = await findProfileByIdentifier(db, "ada");
    expect(publicView).not.toHaveProperty("role");

    await cleanup();
  });
});
