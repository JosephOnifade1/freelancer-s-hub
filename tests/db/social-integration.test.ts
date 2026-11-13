/** Phase 2E: real local PostgreSQL + Drizzle transactions. NOT real Neon.
 * Fixture accounts exist only inside this disposable integration database and are removed.
 */
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as q from "@/server/features/social/social-queries";
import { createPost, findPostForViewer, findPosts } from "@/server/features/content/content-queries";
const url = process.env.DATABASE_URL;
const A = "e0000000-0000-4000-8000-000000000001";
const B = "e0000000-0000-4000-8000-000000000002";
const C = "e0000000-0000-4000-8000-000000000003";
let pool: Pool;
let db: ReturnType<typeof drizzle>;
async function cleanup() {
  await pool.query(`truncate communities,community_members,follows,posts restart identity cascade`);
  await pool.query(`delete from profiles where uid=any($1)`, [[A,B,C]]);
}
beforeAll(() => { if (url) { pool = new Pool({ connectionString: url, max: 12 }); db = drizzle(pool); } });
beforeEach(async () => {
  if (!url) return;
  await cleanup();
  await pool.query(`insert into profiles (uid,username,role) values ($1,'social_a','member'),($2,'social_b','member'),($3,'social_admin','admin')`, [A,B,C]);
});
afterAll(async () => { if (pool) { await cleanup(); await pool.end(); } });
const input = { slug: "writers", name: "Writers", description: "For writers", topics: ["design"] };
const community = () => q.createCommunity(db, A, input);
const counts = async () => (await pool.query(`select uid,followers,following from profiles where uid=any($1) order by uid`, [[A,B,C]])).rows;
const viewer = async (uid: string | null) => ({ uid, role: "member", memberSlugs: [], ownedSlugs: [], ...(uid ? await q.communityFacts(db, uid) : { memberIds: [], ownedIds: [] }) });

describe.skipIf(!url)("communities: real PostgreSQL", () => {
  it("creates with stable id, one creator membership and count exactly one", async () => {
    const c = await community();
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.ownerId).toBe(A);
    expect(c.memberCount).toBe(1);
    expect(await q.userCommunities(db,A)).toEqual(["writers"]);
    expect((await q.listCommunities(db,"writers"))[0].id).toBe(c.id);
  });
  it("public discovery and member projection contain no role", async () => {
    await community();
    expect(await q.listCommunities(db)).toHaveLength(1);
    const members = await q.communityMembers(db,"writers");
    expect(members[0].uid).toBe(A);
    expect(members[0]).not.toHaveProperty("role");
  });
  it("missing community is not a successful empty member list", async () => {
    await expect(q.communityMembers(db,"missing")).rejects.toMatchObject({ status: 404 });
  });
  it("duplicate slug fails without extra memberships or counters", async () => {
    await community();
    await expect(q.createCommunity(db,B,input)).rejects.toMatchObject({ status: 409 });
    expect(await q.userCommunities(db,B)).toEqual([]);
    expect((await q.listCommunities(db))[0].memberCount).toBe(1);
  });
  it("concurrent creation has exactly one winner", async () => {
    const results = await Promise.allSettled([community(),q.createCommunity(db,B,input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await q.listCommunities(db))[0].memberCount).toBe(1);
  });
  it("rolls back the community when creator membership cannot reference a profile", async () => {
    await expect(q.createCommunity(db,"e0000000-0000-4000-8000-000000000099",input)).rejects.toThrow();
    expect(await q.listCommunities(db)).toEqual([]);
  });
  it("owner may edit and rename; arbitrary member may not", async () => {
    const c = await community();
    await expect(q.updateCommunity(db,B,"writers",{ name: "Stolen" })).rejects.toMatchObject({ status: 403 });
    const renamed = await q.updateCommunity(db,A,"writers",{ slug: "authors", name: "Authors" });
    expect(renamed.id).toBe(c.id);
    expect(await q.userCommunities(db,A)).toEqual(["authors"]);
  });
  it("admin may edit system-owned rows but cannot impersonate a system owner", async () => {
    await pool.query(`insert into communities (slug,name,description,"ownerId") values ('system-space','System','Real operator row','system')`);
    expect((await q.listCommunities(db,"system-space"))[0].ownerId).toBe("system");
    await expect(q.updateCommunity(db,A,"system-space",{ name: "Hijack" })).rejects.toMatchObject({ status: 403 });
    expect((await q.updateCommunity(db,C,"system-space",{ name: "Managed" })).ownerId).toBe("system");
  });
  it("moderator is not a community owner/admin", async () => {
    await community();
    await pool.query(`update profiles set role='moderator' where uid=$1`,[B]);
    await expect(q.updateCommunity(db,B,"writers",{ name: "Hijack" })).rejects.toMatchObject({ status: 403 });
  });
  it("duplicate rename rolls back without detaching memberships", async () => {
    await community();
    await q.createCommunity(db,B,{ ...input, slug: "other" });
    await expect(q.updateCommunity(db,A,"writers",{ slug: "other" })).rejects.toThrow();
    expect(await q.userCommunities(db,A)).toEqual(["writers"]);
  });
  it.each([null,"bad"])("rejects unauthenticated/invalid actor %s", async uid => {
    await expect(q.createCommunity(db,uid,input)).rejects.toBeInstanceOf(q.SocialError);
  });
  it("validates slug, category, name and topics", async () => {
    for (const patch of [{ slug: "../bad" },{ category: "invented" },{ name: "" },{ topics: [123] }]) {
      await expect(q.createCommunity(db,A,{ ...input,...patch } as q.CommunityInput)).rejects.toMatchObject({ status: 400 });
    }
    expect(await q.listCommunities(db)).toEqual([]);
  });
});

describe.skipIf(!url)("memberships: real PostgreSQL", () => {
  it("join, status, leave and repeated leave keep exact counts", async () => {
    await community();
    await q.setMembership(db,B,"writers",true);
    await q.setMembership(db,B,"writers",true);
    expect(await q.userCommunities(db,B)).toEqual(["writers"]);
    expect((await q.listCommunities(db))[0].memberCount).toBe(2);
    await q.setMembership(db,B,"writers",false);
    await q.setMembership(db,B,"writers",false);
    expect(await q.userCommunities(db,B)).toEqual([]);
    expect((await q.listCommunities(db))[0].memberCount).toBe(1);
  });
  it("10 concurrent joins produce one membership and one count increment", async () => {
    await community();
    await Promise.all(Array.from({ length: 10 },() => q.setMembership(db,B,"writers",true)));
    expect(await q.communityMembers(db,"writers")).toHaveLength(2);
    expect((await q.listCommunities(db))[0].memberCount).toBe(2);
  });
  it("concurrent join/leave retains count parity with actual rows", async () => {
    await community();
    await Promise.all(Array.from({ length: 20 },(_,i) => q.setMembership(db,B,"writers",i%2===0)));
    const members = await q.communityMembers(db,"writers");
    expect((await q.listCommunities(db))[0].memberCount).toBe(members.length);
  });
  it("a counter failure rolls back an inserted membership", async () => {
    await community();
    await pool.query(`alter table communities add constraint test_member_rollback check ("memberCount" <= 1)`);
    try { await expect(q.setMembership(db,B,"writers",true)).rejects.toThrow(); }
    finally { await pool.query(`alter table communities drop constraint test_member_rollback`); }
    expect(await q.userCommunities(db,B)).toEqual([]);
    expect((await q.listCommunities(db))[0].memberCount).toBe(1);
  });
  it("creator may leave, preserving ownership and zero member count", async () => {
    await community(); await q.setMembership(db,A,"writers",false);
    expect((await q.listCommunities(db))[0]).toMatchObject({ ownerId: A, memberCount: 0 });
  });
  it("refuses missing community, unauthenticated mutation and missing profile", async () => {
    await community();
    await expect(q.setMembership(db,B,"absent",true)).rejects.toMatchObject({ status: 404 });
    await expect(q.setMembership(db,null,"writers",true)).rejects.toMatchObject({ status: 401 });
    await expect(q.setMembership(db,"e0000000-0000-4000-8000-000000000099","writers",true)).rejects.toThrow();
    expect((await q.listCommunities(db))[0].memberCount).toBe(1);
  });
});

describe.skipIf(!url)("follows: real PostgreSQL", () => {
  it("follow, hydrate, repeated follow, unfollow and repeated unfollow keep both counts", async () => {
    await q.setFollow(db,A,B,true); await q.setFollow(db,A,B,true);
    expect((await counts()).slice(0,2)).toEqual([{ uid:A,followers:0,following:1 },{ uid:B,followers:1,following:0 }]);
    const followers = await q.followList(db,B,"followers");
    expect(followers[0]).toMatchObject({ uid:A,username:"social_a" });
    expect(followers[0]).not.toHaveProperty("role");
    expect((await q.followList(db,A,"following"))[0].uid).toBe(B);
    await q.setFollow(db,A,B,false); await q.setFollow(db,A,B,false);
    expect((await counts()).every(r => r.followers===0 && r.following===0)).toBe(true);
  });
  it("self follow rejected server-side and at the database constraint", async () => {
    await expect(q.setFollow(db,A,A,true)).rejects.toMatchObject({ message:"self_follow" });
    await expect(pool.query(`insert into follows values ($1,$1)`,[A])).rejects.toThrow();
  });
  it("10 concurrent follows are idempotent", async () => {
    await Promise.all(Array.from({ length:10 },() => q.setFollow(db,A,B,true)));
    expect((await counts())[0].following).toBe(1);
    expect((await counts())[1].followers).toBe(1);
  });
  it("concurrent toggles preserve exact parity", async () => {
    await Promise.all(Array.from({ length:10 },() => q.setFollow(db,A,B,"toggle")));
    expect(await q.followList(db,A,"following")).toEqual([]);
    expect((await counts()).every(r => r.followers===0 && r.following===0)).toBe(true);
  });
  it("opposite-direction follows do not deadlock", async () => {
    await Promise.all([q.setFollow(db,A,B,true),q.setFollow(db,B,A,true)]);
    expect((await counts()).slice(0,2).every(r => r.followers===1 && r.following===1)).toBe(true);
  });
  it("mixed concurrent follow/unfollow counts equal relationship totals", async () => {
    await Promise.all(Array.from({ length:16 },(_,i) => q.setFollow(db,A,B,i%2===0)));
    const n = (await q.followList(db,A,"following")).length;
    expect((await counts())[0].following).toBe(n);
    expect((await counts())[1].followers).toBe(n);
  });
  it("unknown target and unauthenticated actor do not change either counter", async () => {
    await expect(q.setFollow(db,A,"e0000000-0000-4000-8000-000000000099",true)).rejects.toMatchObject({ status:404 });
    await expect(q.setFollow(db,null,B,true)).rejects.toMatchObject({ status:401 });
    expect((await counts()).every(r => r.followers===0 && r.following===0)).toBe(true);
  });
  it("a failure on the second counter rolls back relationship and first counter", async () => {
    // Induce failure without modifying application SQL or leaving a trigger behind.
    await pool.query(`alter table profiles add constraint test_social_rollback check (uid <> '${B}' or followers=0)`);
    try { await expect(q.setFollow(db,A,B,true)).rejects.toThrow(); }
    finally { await pool.query(`alter table profiles drop constraint test_social_rollback`); }
    expect(await q.followList(db,A,"following")).toEqual([]);
    expect((await counts())[0].following).toBe(0);
  });
});

describe.skipIf(!url)("stable community/content integration", () => {
  it("rename preserves post ID relation, URLs project new slug, permissions remain stable", async () => {
    const c = await community();
    const made = await createPost(db,A,{ title:"Members post",body:"body",visibility:"members",communitySlug:"writers" });
    if (made.status !== "created") throw new Error("post creation failed");
    await q.setMembership(db,B,"writers",true);
    const stale = await viewer(B);
    expect(await findPostForViewer(db,await viewer(null),made.post.id)).toBeNull();
    expect(await findPostForViewer(db,await viewer(B),made.post.id)).not.toBeNull();
    await q.updateCommunity(db,A,"writers",{ slug:"authors" });
    expect(await findPostForViewer(db,stale,made.post.id)).toMatchObject({ communitySlug:"authors",communityId:c.id });
    expect(await findPosts(db,await viewer(B),{ communitySlug:"authors" })).toHaveLength(1);
    expect(await findPosts(db,await viewer(B),{ communitySlug:"writers" })).toHaveLength(0);
    await expect(pool.query(`delete from communities where id=$1`,[c.id])).rejects.toThrow();
  });
  it("reusing an old slug does not grant access to a different community", async () => {
    await community(); await q.setMembership(db,B,"writers",true);
    const stale = await viewer(B);
    await q.updateCommunity(db,A,"writers",{ slug:"authors" });
    await q.createCommunity(db,C,input);
    const made = await createPost(db,C,{ title:"Other",body:"body",visibility:"members",communitySlug:"writers" });
    if (made.status !== "created") throw new Error("post creation failed");
    expect(await findPostForViewer(db,stale,made.post.id)).toBeNull();
    expect(await findPosts(db,stale)).toHaveLength(0);
  });
  it("the legacy migration guard refuses to discard community-scoped rows", async () => {
    const { readFileSync } = await import("node:fs");
    const migration = readFileSync("src/server/db/migrations/0003_community_social_graph.sql", "utf8");
    const guard = migration.slice(0,migration.indexOf("--> statement-breakpoint"));
    const client = await pool.connect();
    try {
      await client.query("begin");
      // A transaction-local old-shape table shadows posts only for this connection.
      await client.query(`create temp table posts ("communitySlug" text) on commit drop`);
      await client.query(`insert into posts values ('real-legacy-community')`);
      await expect(client.query(guard)).rejects.toThrow(/explicit disposition/);
    } finally { await client.query("rollback"); client.release(); }
  });
  it("unknown slug cannot silently create a detached public post", async () => {
    expect(await createPost(db,A,{ title:"Post",body:"body",communitySlug:"missing" })).toMatchObject({ status:"invalid" });
    expect((await pool.query(`select id from posts`)).rows).toHaveLength(0);
  });
});
