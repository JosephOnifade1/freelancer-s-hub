/** Real local PostgreSQL cross-domain security/integrity, not actual Neon. */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as c from "@/server/features/content/content-queries";
import * as b from "@/server/features/badges/badge-queries";
import * as t from "@/server/features/trust/trust-queries";
import { setFollow } from "@/server/features/social/social-queries";
const url = process.env.DATABASE_URL;
const A = "a8888888-0000-4000-8000-000000000001",
  B = "a8888888-0000-4000-8000-000000000002",
  S = "a8888888-0000-4000-8000-000000000003",
  CO = "a8888888-0000-4000-8000-000000000004";
let pool: Pool, db: ReturnType<typeof drizzle>;
const viewer = (
  uid: string | null = null,
  role = "member",
  memberIds: string[] = [],
) => ({ uid, role, memberIds, ownedIds: [], memberSlugs: [], ownedSlugs: [] });
async function cleanup() {
  await pool.query(
    `truncate posts,communities,follows,reports,notifications restart identity cascade`,
  );
  await pool.query(`delete from profiles where uid=any($1)`, [[A, B, S]]);
}
beforeAll(() => {
  if (url) {
    pool = new Pool({ connectionString: url, max: 12 });
    db = drizzle(pool);
  }
});
beforeEach(async () => {
  if (!url) return;
  await cleanup();
  for (const [i, uid] of [A, B, S].entries())
    await pool.query(
      `insert into profiles(uid,username,role) values($1,$2,$3)`,
      [uid, `integr_${i}`, uid === S ? "moderator" : "member"],
    );
  await pool.query(
    `insert into communities(id,slug,name,description) values($1,'private','Private','Private')`,
    [CO],
  );
});
afterAll(async () => {
  if (pool) {
    await cleanup();
    await pool.end();
  }
});
async function post(extra: Partial<Parameters<typeof c.createPost>[2]> = {}) {
  const r = await c.createPost(db, A, {
    title: "Private resource",
    body: "Private body",
    ...extra,
  });
  if (r.status !== "created") throw Error(r.status);
  return r.post.id;
}
const privatePost = () =>
  post({ type: "resource", visibility: "members", communitySlug: "private" });
const since = new Date("2000-01-01");
describe.skipIf(!url)("Phase 2H cross-domain SQL", () => {
  it("migrates the exact existing catalog, no user/award seed", async () => {
    expect((await b.listBadges(db)).map((r) => r.id).sort()).toEqual(
      [
        "first-post",
        "rising-voice",
        "helper",
        "trusted-voice",
        "consistent",
        "generous",
        "veteran",
        "convo-starter",
      ].sort(),
    );
    expect(await b.listUserBadges(db, A)).toEqual([]);
  });
  it("earned projection is public, FK-backed, stable, duplicate-safe", async () => {
    await pool.query(
      `insert into user_badges("userUid","badgeId") values($1,'first-post')`,
      [A],
    );
    expect(await b.listUserBadges(db, A)).toMatchObject([
      { userUid: A, badgeId: "first-post" },
    ]);
    expect(await b.listUserBadges(db, B)).toEqual([]);
    await expect(
      pool.query(
        `insert into user_badges("userUid","badgeId") values($1,'first-post')`,
        [A],
      ),
    ).rejects.toThrow();
    await expect(
      pool.query(
        `insert into user_badges("userUid","badgeId") values($1,'missing')`,
        [B],
      ),
    ).rejects.toThrow();
    await expect(b.listUserBadges(db, "bad")).rejects.toThrow("invalid_uid");
  });
  it("rejects a poll vote using another poll's valid option even through SQL", async () => {
    const first = await post({ type: "poll", pollOptions: ["A", "B"] }),
      second = await post({ type: "poll", pollOptions: ["C", "D"] });
    const p = (
      await pool.query(`select id from polls where "postId"=$1`, [first])
    ).rows[0].id;
    const option = (
      await pool.query(
        `select o.id from poll_options o join polls p on p.id=o."pollId" where p."postId"=$1`,
        [second],
      )
    ).rows[0].id;
    await expect(
      pool.query(
        `insert into poll_votes("pollId","pollOptionId","userId") values($1,$2,$3)`,
        [p, option, B],
      ),
    ).rejects.toMatchObject({ constraint: "poll_votes_option_poll_fk" });
    expect((await pool.query(`select * from poll_votes`)).rows).toEqual([]);
  });
  it("valid poll relations and concurrent one-vote identity remain enforced", async () => {
    const p = await post({ type: "poll", pollOptions: ["A", "B"] });
    const poll = (
      await pool.query(`select id from polls where "postId"=$1`, [p])
    ).rows[0].id;
    const option = (
      await pool.query(`select id from poll_options where "pollId"=$1`, [poll])
    ).rows[0].id;
    await Promise.all(
      Array.from({ length: 8 }, () =>
        c.votePollOption(db, viewer(B), poll, option),
      ),
    );
    expect((await pool.query(`select * from poll_votes`)).rows).toHaveLength(1);
  });
  it("private posts/comments contribute no dates/counts/IDs to anonymous stats", async () => {
    const p = await privatePost();
    await c.createComment(db, viewer(A), p, { body: "Private reply" });
    expect(await c.countResourcesByAuthor(db, A)).toBe(0);
    expect(await c.findContributionDates(db, A, since)).toEqual([]);
    expect(await c.findRecentContributors(db, since)).toEqual([]);
    expect(await c.findCommunityHealthInputs(db)).toEqual({
      postCount: 0,
      postsWithReplies: 0,
      responses: [],
    });
  });
  it("private activity is visible only to author/member/staff, including parent check", async () => {
    await privatePost();
    for (const v of [
      viewer(A),
      viewer(B, "member", [CO]),
      viewer(S, "moderator"),
    ]) {
      expect(await c.countResourcesByAuthor(db, A, v)).toBe(1);
      expect(await c.findContributionDates(db, A, since, v)).toHaveLength(1);
    }
    expect(await c.findContributionDates(db, A, since, viewer(B))).toEqual([]);
  });
  it("deleted parent hides otherwise active comments in all public activity stats", async () => {
    const p = await post();
    await c.createComment(db, viewer(B), p, { body: "Reply" });
    await c.softDeletePost(db, viewer(A), p);
    expect(await c.findContributionDates(db, B, since)).toEqual([]);
    expect(await c.findRecentContributors(db, since)).toEqual([]);
  });
  it.each(["posts", "comments"])(
    "%s counters reject inconsistent or negative values",
    async (table) => {
      const p = await post();
      let id = p;
      if (table === "comments") {
        const r = await c.createComment(db, viewer(B), p, { body: "R" });
        if (r.status !== "created") throw Error(r.status);
        id = r.comment.id;
      }
      await expect(
        pool.query(`update ${table} set ups=-1 where id=$1`, [id]),
      ).rejects.toThrow();
      await expect(
        pool.query(`update ${table} set score=3 where id=$1`, [id]),
      ).rejects.toThrow();
    },
  );
  it("votes across multiple posts serialize profile increments without lost reputation", async () => {
    const ids = await Promise.all(Array.from({ length: 8 }, () => post()));
    await Promise.all(
      ids.map((entityId) =>
        c.castVote(db, viewer(B), {
          entityType: "post",
          entityId,
          voteValue: 1,
        }),
      ),
    );
    expect(
      (await pool.query(`select reputation from profiles where uid=$1`, [A]))
        .rows[0].reputation,
    ).toBe(8);
    expect(
      (await pool.query(`select sum(score)::int as n from posts`)).rows[0].n,
    ).toBe(8);
    expect(await t.unreadCount(db, A)).toBe(8);
  });
  it("concurrent follow/unfollow desired-state retries preserve both cached counts", async () => {
    for (const following of [true, false, true, false])
      await Promise.all(
        Array.from({ length: 8 }, () => setFollow(db, B, A, following)),
      );
    const p = (
      await pool.query(
        `select uid,followers,following from profiles where uid=any($1)`,
        [[A, B]],
      )
    ).rows;
    expect(p.every((r) => r.followers === 0 && r.following === 0)).toBe(true);
    expect((await pool.query(`select * from follows`)).rows).toEqual([]);
  });
  it("report keyset pages return all equal-timestamp rows without duplicates or owner leak", async () => {
    await pool.query(
      `insert into reports("reporterUid","entityType","entityId",reason,"createdAt") select $1,'profile',$2,'spam','2026-01-01' from generate_series(1,205)`,
      [B, A],
    );
    const one = await t.listReports(db, S),
      two = await t.listReports(db, S, false, undefined, one[99].id),
      three = await t.listReports(db, S, false, undefined, two[99].id);
    expect([one.length, two.length, three.length]).toEqual([100, 100, 5]);
    expect(new Set([...one, ...two, ...three].map((r) => r.id)).size).toBe(205);
    expect(await t.listReports(db, A, true, undefined, one[99].id)).toEqual([]);
    await expect(t.listReports(db, B)).rejects.toMatchObject({ status: 403 });
  });
  it("badge failure does not silently return a mock catalog", async () => {
    await expect(
      b.listBadges({
        execute: async () => {
          throw Error("DB unavailable");
        },
      }),
    ).rejects.toThrow("DB unavailable");
  });
});
