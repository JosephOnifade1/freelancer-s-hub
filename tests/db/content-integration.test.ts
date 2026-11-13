/**
 * Content domain — **local PostgreSQL 18** integration tests (Phase 2D).
 *
 * Runs the real query functions against a real PostgreSQL server with the real Drizzle
 * `node-postgres` driver, so constraints, the authorization `where` clause, transaction
 * atomicity and concurrency are actually exercised.
 *
 * It does **not** prove anything about Neon — see `docs/PHASE_2D_CONTENT_AND_INTERACTION_MIGRATION.md`
 * §"Real-Neon verification". In particular the pooler, TLS termination and cross-region
 * latency are untested here.
 *
 * Requires `DATABASE_URL` with both migrations applied. Skipped otherwise, so the suite
 * stays green without a database. Every test cleans up; no seed users are left behind.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { canViewPost, authorizationFilter, type ContentViewer } from "@/server/features/content/authorization";
import {
  castVote,
  createAttachment,
  createComment,
  createPost,
  findAttachmentsForViewer,
  findCommentsForViewer,
  findPollForViewer,
  findPostForViewer,
  findPosts,
  findSavedPostIds,
  findVoteValue,
  incrementPostViews,
  removeAttachment,
  setUserRole,
  setUserVerifiedPro,
  softDeleteComment,
  softDeletePost,
  toggleSavedPost,
  updateCommentBody,
  updatePostBody,
  votePollOption,
} from "@/server/features/content/content-queries";

const url = process.env.DATABASE_URL;
const ready = Boolean(url);

/** Deterministic ids so cleanup is a plain `delete ... where uid = any(...)`. */
const AUTHOR = "c0000000-1111-4111-8111-000000000001";
const VIEWER = "c0000000-1111-4111-8111-000000000002";
const MODERATOR = "c0000000-1111-4111-8111-000000000003";
const ADMIN = "c0000000-1111-4111-8111-000000000004";
const MEMBER = "c0000000-1111-4111-8111-000000000005";
const OWNER = "c0000000-1111-4111-8111-000000000006";

const ALL_UIDS = [AUTHOR, VIEWER, MODERATOR, ADMIN, MEMBER, OWNER];

let pool: Pool;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  if (!ready) return;
  pool = new Pool({ connectionString: url, max: 4 });
  db = drizzle(pool);
});

afterAll(async () => {
  // Leave the database as it was found. The identity suite asserts on *global* row
  // counts (`select count(*) from usernames`), so a fixture left behind here does not
  // merely look untidy — it makes an unrelated file fail depending on run order.
  if (ready) await cleanup();
  await pool?.end();
});

/**
 * Empties the content tables.
 *
 * `truncate ... cascade` rather than targeted deletes: a run that fails mid-test can
 * leave rows behind, and those rows then appear in the next test's feed and make an
 * unrelated assertion fail. This suite owns the database it runs against (it is
 * skipped without `DATABASE_URL`), so a clean slate is the honest starting state.
 *
 * `profiles` is truncated too, but *after* the content tables so the identity domain
 * tests can re-seed it; nothing here depends on pre-existing accounts.
 */
async function cleanup() {
  await pool.query(
    `truncate table posts, comments, votes, polls, poll_options, poll_votes,
       post_attachments, saved_posts, community_members, follows, communities restart identity cascade`,
  );
  await pool.query(`delete from usernames where uid = any($1)`, [ALL_UIDS]);
  await pool.query(`delete from profiles where uid = any($1)`, [ALL_UIDS]);
}

beforeEach(async () => {
  if (!ready) return;
  await cleanup();
  // `profiles` first: every content row references it.
  const rows = [
    [AUTHOR, "author", "member"],
    [VIEWER, "viewer", "member"],
    [MODERATOR, "moddy", "moderator"],
    [ADMIN, "adminny", "admin"],
    [MEMBER, "memberino", "member"],
    [OWNER, "ownerino", "member"],
  ];
  for (const [uid, username, role] of rows) {
    await pool.query(
      `insert into profiles (uid, username, "displayName", role) values ($1, $2, $3, $4)`,
      [uid, username, username, role],
    );
    await pool.query(`insert into usernames (username, uid) values ($1, $2)`, [username, uid]);
  }
  await pool.query(`insert into communities (slug,name,description) values ('writers','Writers','Test community')`);
});

/** Only seeds the profiles; used by the pure-predicate tests. */
function viewer(overrides: Partial<ContentViewer> = {}): ContentViewer {
  return { uid: VIEWER, role: "member", memberSlugs: [], ownedSlugs: [], ...overrides };
}

const anon = (): ContentViewer => ({ uid: null, role: "member", memberSlugs: [], ownedSlugs: [] });

async function makePost(
  overrides: Partial<Parameters<typeof createPost>[2]> = {},
  authorUid = AUTHOR,
) {
  const result = await createPost(db, authorUid, {
    title: "A post",
    body: "The body",
    ...overrides,
  });
  if (result.status !== "created") throw new Error(`post not created: ${result.status}`);
  return result.post;
}

describe.skipIf(!ready)("authorization matrix (can_view_post parity)", () => {
  const post = (visibility: string, communitySlug: string | null = null, authorUid = AUTHOR) => ({
    authorUid,
    visibility,
    communitySlug,
  });

  it("public posts are visible to everyone, including anonymous visitors", () => {
    expect(canViewPost(post("public"), anon())).toBe(true);
    expect(canViewPost(post("public"), viewer())).toBe(true);
  });

  it("a restricted post is invisible to anonymous viewers", () => {
    expect(canViewPost(post("members", "writers"), anon())).toBe(false);
    expect(canViewPost(post("admins", "writers"), anon())).toBe(false);
  });

  it("the author always sees their own post", () => {
    expect(canViewPost(post("members", "writers", VIEWER), viewer())).toBe(true);
    expect(canViewPost(post("admins", "writers", VIEWER), viewer())).toBe(true);
  });

  it("staff see every post", () => {
    expect(canViewPost(post("members", "writers"), viewer({ role: "moderator" }))).toBe(true);
    expect(canViewPost(post("admins", "writers"), viewer({ role: "admin" }))).toBe(true);
  });

  it("membership grants 'members' visibility only", () => {
    const member = viewer({ memberSlugs: ["writers"] });
    expect(canViewPost(post("members", "writers"), member)).toBe(true);
    expect(canViewPost(post("admins", "writers"), member)).toBe(false);
  });

  it("ownership grants 'admins' visibility", () => {
    const owner = viewer({ ownedSlugs: ["writers"] });
    expect(canViewPost(post("admins", "writers"), owner)).toBe(true);
    // Ownership does not imply membership, so 'members' is not granted by it.
    expect(canViewPost(post("members", "writers"), owner)).toBe(false);
  });

  it("membership of a different community grants nothing", () => {
    expect(canViewPost(post("members", "writers"), viewer({ memberSlugs: ["other"] }))).toBe(false);
  });

  it("a restricted post with no community is author-and-staff only", () => {
    expect(canViewPost(post("members", null), viewer({ memberSlugs: ["writers"] }))).toBe(false);
    expect(canViewPost(post("members", null), viewer({ role: "admin" }))).toBe(true);
  });

  it("an unrecognised visibility fails closed", () => {
    expect(canViewPost(post("weird"), viewer())).toBe(false);
    expect(canViewPost(post("weird"), anon())).toBe(false);
  });
});

describe.skipIf(!ready)("authorization is applied inside the query, not after it", () => {
  it("a feed excludes posts the viewer may not see", async () => {
    await makePost({ title: "public one", visibility: "public" });
    const membersPost = await makePost({ title: "members only", visibility: "members", communitySlug: "writers" });

    const anonymous = await findPosts(db, anon(), {});
    expect(anonymous.map((p) => p.title)).toEqual(["public one"]);

    // A signed-in non-member still cannot see it.
    const outsider = await findPosts(db, viewer(), {});
    expect(outsider.map((p) => p.title)).toEqual(["public one"]);

    // A member can.
    const member = await findPosts(db, viewer({ memberSlugs: ["writers"] }), {});
    expect(member.map((p) => p.title).sort()).toEqual(["members only", "public one"]);
    expect(member.find((p) => p.id === membersPost.id)).toBeTruthy();
  });

  it("staff see restricted posts in the feed", async () => {
    await makePost({ title: "members only", visibility: "members", communitySlug: "writers" });
    const asMod = await findPosts(db, viewer({ role: "moderator" }), {});
    expect(asMod.map((p) => p.title)).toContain("members only");
  });

  it("deleted posts are excluded from the feed for everyone", async () => {
    const post = await makePost();
    await softDeletePost(db, viewer({ uid: AUTHOR }), post.id);
    expect(await findPosts(db, viewer({ uid: AUTHOR }), {})).toEqual([]);
  });

  it("findPostForViewer returns null rather than an unauthorized row", async () => {
    const post = await makePost({ visibility: "members", communitySlug: "writers" });
    expect(await findPostForViewer(db, anon(), post.id)).toBeNull();
    expect(await findPostForViewer(db, viewer(), post.id)).toBeNull();
    expect(await findPostForViewer(db, viewer({ memberSlugs: ["writers"] }), post.id)).not.toBeNull();
  });

  it("orders by newest first with a stable tiebreak", async () => {
    const a = await makePost({ title: "first" });
    const b = await makePost({ title: "second" });
    const feed = await findPosts(db, viewer(), {});
    expect(feed.map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it("paginates with keyset paging and does not repeat a row", async () => {
    const posts = [];
    for (let i = 0; i < 5; i++) posts.push(await makePost({ title: `post ${i}` }));

    const firstPage = await findPosts(db, viewer(), { limit: 2 });
    expect(firstPage).toHaveLength(2);

    const secondPage = await findPosts(db, viewer(), {
      limit: 2,
      before: firstPage[firstPage.length - 1].createdAt,
    });
    expect(secondPage).toHaveLength(2);
    const overlap = firstPage.filter((p) => secondPage.some((q) => q.id === p.id));
    expect(overlap).toEqual([]);
  });

  it("the SQL filter and the JS predicate agree on every matrix row", async () => {
    // This is the assertion that keeps the two implementations honest: a feed query
    // and a single-row check must never disagree about who may see what.
    const cases: { visibility: string; communitySlug: string | null }[] = [
      { visibility: "public", communitySlug: null },
      { visibility: "members", communitySlug: "writers" },
      { visibility: "admins", communitySlug: "writers" },
    ];
    for (const [index, spec] of cases.entries()) {
      await makePost({ ...spec, title: `case ${index}` });
    }

    const viewers: ContentViewer[] = [
      anon(),
      viewer(),
      viewer({ memberSlugs: ["writers"] }),
      viewer({ ownedSlugs: ["writers"] }),
      viewer({ role: "moderator" }),
    ];

    for (const [index, v] of viewers.entries()) {
      const viaSql = (await findPosts(db, v, {})).map((p) => p.id).sort();

      // The same decision, made row by row with the JS predicate.
      const allRows = await findPosts(db, viewer({ role: "admin" }), {});
      const viaPredicate = allRows
        .filter((p) =>
          canViewPost(
            { authorUid: p.authorUid, visibility: p.visibility, communitySlug: p.communitySlug },
            v,
          ),
        )
        .map((p) => p.id)
        .sort();

      expect(viaSql, `viewer ${index}`).toEqual(viaPredicate);
    }
  });

  it("authorizationFilter is not silently permissive for an anonymous viewer", () => {
    // The fragment is a SQL object, not a string: render its chunks the way drizzle
    // would, so the assertion is about the emitted SQL rather than `[object Object]`.
    // `authorizationFilter` returns a drizzle SQL object. Render its static chunks the
    // way the driver would: bind parameters are separate, so this inspects the SQL text.
    const fragment = authorizationFilter(anon()) as unknown as {
      queryChunks: { value?: string[]; constructor: { name: string } }[];
    };
    const rendered = fragment.queryChunks
      .filter((chunk) => Array.isArray(chunk?.value))
      .map((chunk) => (chunk.value as string[]).join(""))
      .join(" ");

    expect(rendered).toContain("visibility");
    expect(rendered).not.toMatch(/\btrue\b/);
  });
});

describe.skipIf(!ready)("posts: create, edit, delete, ownership", () => {
  it("records the calling author and derives initial", async () => {
    const post = await makePost({ title: "  Spaced title  " });
    expect(post.authorUid).toBe(AUTHOR);
    expect(post.title).toBe("Spaced title");
    expect(post.visibility).toBe("public");
    expect(post.commentCount).toBe(0);
    expect(post.score).toBe(0);
  });

  it("rejects an empty title or body", async () => {
    expect((await createPost(db, AUTHOR, { title: "  ", body: "x" })).status).toBe("invalid");
    expect((await createPost(db, AUTHOR, { title: "x", body: "  " })).status).toBe("invalid");
  });

  it("rejects a restricted post with no community", async () => {
    const result = await createPost(db, AUTHOR, {
      title: "x",
      body: "y",
      visibility: "members",
    });
    expect(result.status).toBe("invalid");
  });

  it("an author can edit their own post", async () => {
    const post = await makePost();
    const result = await updatePostBody(db, viewer({ uid: AUTHOR }), post.id, "New body");
    expect(result.status).toBe("updated");
    expect((await findPostForViewer(db, viewer({ uid: AUTHOR }), post.id))?.body).toBe("New body");
  });

  it("a non-author cannot edit, and the post is unchanged", async () => {
    const post = await makePost();
    const result = await updatePostBody(db, viewer({ uid: VIEWER }), post.id, "Hijacked");
    expect(result.status).toBe("not_found");

    const reloaded = await findPostForViewer(db, viewer({ uid: AUTHOR }), post.id);
    expect(reloaded?.body).toBe("The body");
  });

  it("a moderator cannot edit someone else's post", async () => {
    // Seeing and editing are different questions; the original RLS update policy was
    // `auth.uid() = "authorUid"`, with no staff override.
    const post = await makePost();
    const result = await updatePostBody(db, viewer({ uid: MODERATOR, role: "moderator" }), post.id, "Staff edit");
    expect(result.status).toBe("not_found");
  });

  it("a non-author cannot delete", async () => {
    const post = await makePost();
    expect((await softDeletePost(db, viewer({ uid: VIEWER }), post.id)).status).toBe("not_found");
    expect(await findPostForViewer(db, viewer({ uid: AUTHOR }), post.id)).not.toBeNull();
  });

  it("views increment atomically", async () => {
    const post = await makePost();
    await Promise.all(Array.from({ length: 5 }, () => incrementPostViews(db, post.id)));
    const reloaded = await findPostForViewer(db, viewer(), post.id);
    expect(reloaded?.views).toBe(5);
  });
});

describe.skipIf(!ready)("comments: threading, locking, counters", () => {
  it("a comment increments the post's counter in the same transaction", async () => {
    const post = await makePost();
    const result = await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "First" });
    expect(result.status).toBe("created");
    expect((await findPostForViewer(db, viewer(), post.id))?.commentCount).toBe(1);
  });

  it("a reply must have a parent on the same post", async () => {
    const postA = await makePost({ title: "A" });
    const postB = await makePost({ title: "B" });

    const parent = await createComment(db, viewer({ uid: VIEWER }), postA.id, { body: "Parent" });
    if (parent.status !== "created") throw new Error("parent not created");

    const good = await createComment(db, viewer({ uid: VIEWER }), postA.id, {
      body: "Reply",
      parentId: parent.comment.id,
    });
    expect(good.status).toBe("created");

    // A parent from another post would make the reply unreachable.
    const crossPost = await createComment(db, viewer({ uid: VIEWER }), postB.id, {
      body: "Wrong parent",
      parentId: parent.comment.id,
    });
    expect(crossPost.status).toBe("invalid");
  });

  it("refuses a comment when comments are closed", async () => {
    const post = await makePost({ allowComments: false });
    expect((await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "x" })).status).toBe(
      "comments_closed",
    );
    expect((await findPostForViewer(db, viewer(), post.id))?.commentCount).toBe(0);
  });

  it("refuses a comment on a removed post", async () => {
    const post = await makePost();
    await softDeletePost(db, viewer({ uid: AUTHOR }), post.id);
    expect((await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "x" })).status).toBe(
      "post_removed",
    );
  });

  it("refuses a comment on a post the viewer cannot see", async () => {
    const post = await makePost({ visibility: "members", communitySlug: "writers" });
    const result = await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "sneaky" });
    expect(result.status).toBe("not_found");
  });

  it("comments on a hidden post are not listable by an outsider", async () => {
    const post = await makePost({ visibility: "members", communitySlug: "writers" });
    await createComment(db, viewer({ uid: AUTHOR }), post.id, { body: "Insider only" });

    expect(await findCommentsForViewer(db, viewer(), post.id)).toEqual([]);
    expect(
      (await findCommentsForViewer(db, viewer({ memberSlugs: ["writers"] }), post.id)).length,
    ).toBe(1);
  });

  it("only the author may edit or delete a comment", async () => {
    const post = await makePost();
    const created = await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "Mine" });
    if (created.status !== "created") throw new Error("not created");
    const commentId = created.comment.id;

    expect((await updateCommentBody(db, viewer({ uid: AUTHOR }), commentId, "Hijack")).status).toBe(
      "not_found",
    );
    expect((await softDeleteComment(db, viewer({ uid: AUTHOR }), commentId)).status).toBe(
      "not_found",
    );

    expect((await updateCommentBody(db, viewer({ uid: VIEWER }), commentId, "Edited")).status).toBe(
      "updated",
    );
    expect((await softDeleteComment(db, viewer({ uid: VIEWER }), commentId)).status).toBe("updated");
    // The counter is decremented, not left drifted.
    expect((await findPostForViewer(db, viewer(), post.id))?.commentCount).toBe(0);
  });

  it("deleting twice does not drive the counter negative", async () => {
    const post = await makePost();
    const created = await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "Once" });
    if (created.status !== "created") throw new Error("not created");

    await softDeleteComment(db, viewer({ uid: VIEWER }), created.comment.id);
    const second = await softDeleteComment(db, viewer({ uid: VIEWER }), created.comment.id);
    expect(second.status).toBe("not_found");
    expect((await findPostForViewer(db, viewer(), post.id))?.commentCount).toBe(0);
  });
});

describe.skipIf(!ready)("votes: the cast_vote state machine", () => {
  it("applies an upvote and moves the counters and the author's reputation", async () => {
    const post = await makePost();
    const result = await castVote(db, viewer({ uid: VIEWER }), {
      entityType: "post",
      entityId: post.id,
      voteValue: 1,
    });

    expect(result.status).toBe("applied");
    const reloaded = await findPostForViewer(db, viewer(), post.id);
    expect(reloaded?.score).toBe(1);
    expect(reloaded?.ups).toBe(1);
    expect(reloaded?.downs).toBe(0);

    const reputation = await pool.query(`select reputation from profiles where uid = $1`, [AUTHOR]);
    expect(reputation.rows[0].reputation).toBe(1);
  });

  it("switches an upvote to a downvote with the correct deltas", async () => {
    const post = await makePost();
    await castVote(db, viewer({ uid: VIEWER }), { entityType: "post", entityId: post.id, voteValue: 1 });
    await castVote(db, viewer({ uid: VIEWER }), { entityType: "post", entityId: post.id, voteValue: -1 });

    const reloaded = await findPostForViewer(db, viewer(), post.id);
    expect(reloaded?.score).toBe(-1);
    expect(reloaded?.ups).toBe(0);
    expect(reloaded?.downs).toBe(1);

    const reputation = await pool.query(`select reputation from profiles where uid = $1`, [AUTHOR]);
    expect(reputation.rows[0].reputation).toBe(0);
  });

  it("removes a vote, leaving the counters at zero", async () => {
    const post = await makePost();
    await castVote(db, viewer({ uid: VIEWER }), { entityType: "post", entityId: post.id, voteValue: 1 });
    const removal = await castVote(db, viewer({ uid: VIEWER }), {
      entityType: "post",
      entityId: post.id,
      voteValue: 0,
    });

    expect(removal.status).toBe("applied");
    const reloaded = await findPostForViewer(db, viewer(), post.id);
    expect(reloaded?.score).toBe(0);
    expect(reloaded?.ups).toBe(0);
    expect(await findVoteValue(db, VIEWER, "post", post.id)).toBe(0);
  });

  it("is a no-op when the vote does not change", async () => {
    const post = await makePost();
    await castVote(db, viewer({ uid: VIEWER }), { entityType: "post", entityId: post.id, voteValue: 1 });
    const repeat = await castVote(db, viewer({ uid: VIEWER }), {
      entityType: "post",
      entityId: post.id,
      voteValue: 1,
    });

    expect(repeat.status).toBe("unchanged");
    const reloaded = await findPostForViewer(db, viewer(), post.id);
    expect(reloaded?.score).toBe(1);
    expect(reloaded?.ups).toBe(1);
  });

  it("rejects a self-vote", async () => {
    const post = await makePost();
    const result = await castVote(db, viewer({ uid: AUTHOR }), {
      entityType: "post",
      entityId: post.id,
      voteValue: 1,
    });
    expect(result.status).toBe("self_vote");
    expect((await findPostForViewer(db, viewer(), post.id))?.score).toBe(0);
  });

  it("rejects a vote on deleted content", async () => {
    const post = await makePost();
    await softDeletePost(db, viewer({ uid: AUTHOR }), post.id);
    const result = await castVote(db, viewer({ uid: VIEWER }), {
      entityType: "post",
      entityId: post.id,
      voteValue: 1,
    });
    expect(result.status).toBe("deleted_content");
  });

  it("rejects a vote on content the voter cannot see", async () => {
    const post = await makePost({ visibility: "members", communitySlug: "writers" });
    const result = await castVote(db, viewer({ uid: VIEWER }), {
      entityType: "post",
      entityId: post.id,
      voteValue: 1,
    });
    expect(result.status).toBe("not_found");
  });

  it("rejects an invalid vote value and an unknown entity", async () => {
    const post = await makePost();
    expect(
      (
        await castVote(db, viewer({ uid: VIEWER }), {
          entityType: "post",
          entityId: post.id,
          voteValue: 2,
        })
      ).status,
    ).toBe("invalid");

    expect(
      (
        await castVote(db, viewer({ uid: VIEWER }), {
          entityType: "post",
          entityId: "00000000-0000-4000-8000-000000000000",
          voteValue: 1,
        })
      ).status,
    ).toBe("not_found");
  });

  it("votes on a comment also move the parent post's author reputation", async () => {
    const post = await makePost();
    const comment = await createComment(db, viewer({ uid: AUTHOR }), post.id, { body: "Author's reply" });
    if (comment.status !== "created") throw new Error("not created");

    const result = await castVote(db, viewer({ uid: VIEWER }), {
      entityType: "comment",
      entityId: comment.comment.id,
      voteValue: 1,
    });
    expect(result.status).toBe("applied");

    const reputation = await pool.query(`select reputation from profiles where uid = $1`, [AUTHOR]);
    expect(reputation.rows[0].reputation).toBe(1);
  });

  it("concurrent identical votes from one voter apply exactly one delta", async () => {
    // The advisory lock is what makes this true: without it both calls read "no
    // previous vote" and the delta lands twice.
    const post = await makePost();
    const voter = viewer({ uid: VIEWER });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        castVote(db, voter, { entityType: "post", entityId: post.id, voteValue: 1 }),
      ),
    );

    expect(results.filter((r) => r.status === "applied")).toHaveLength(1);
    const reloaded = await findPostForViewer(db, viewer(), post.id);
    expect(reloaded?.score).toBe(1);
    expect(reloaded?.ups).toBe(1);
  });

  it("concurrent votes from different voters each land once", async () => {
    const post = await makePost();
    const voters = [VIEWER, MEMBER, MODERATOR];

    await Promise.all(
      voters.map((uid) =>
        castVote(db, viewer({ uid }), { entityType: "post", entityId: post.id, voteValue: 1 }),
      ),
    );

    const reloaded = await findPostForViewer(db, viewer({ role: "admin" }), post.id);
    expect(reloaded?.score).toBe(3);
    expect(reloaded?.ups).toBe(3);
  });
});

describe.skipIf(!ready)("polls", () => {
  async function makePoll() {
    const post = await makePost({
      title: "Pick one",
      type: "poll",
      pollOptions: ["Alpha", "Beta"],
    });
    const poll = await findPollForViewer(db, viewer(), post.id);
    if (!poll) throw new Error("poll not created");
    return { post, poll };
  }

  it("creates the poll and its options atomically", async () => {
    const { poll } = await makePoll();
    expect(poll.options.map((o) => o.label)).toEqual(["Alpha", "Beta"]);
    expect(poll.totalVotes).toBe(0);
    expect(poll.viewerOptionId).toBeNull();
  });

  it("refuses a poll with fewer than two options", async () => {
    const result = await createPost(db, AUTHOR, {
      title: "Bad poll",
      body: "body",
      type: "poll",
      pollOptions: ["Only one"],
    });
    expect(result.status).toBe("invalid");
  });

  it("enforces one poll per post at the database level", async () => {
    const { post } = await makePoll();
    await expect(
      pool.query(`insert into polls ("postId") values ($1)`, [post.id]),
    ).rejects.toThrow(/polls_post_key|duplicate key/);
  });

  it("records a vote and reports the viewer's choice", async () => {
    const { post, poll } = await makePoll();
    const chosen = poll.options[1];

    const result = await votePollOption(db, viewer({ uid: VIEWER }), poll.id, chosen.id);
    expect(result.status).toBe("voted");

    const reloaded = await findPollForViewer(db, viewer({ uid: VIEWER }), post.id);
    expect(reloaded?.viewerOptionId).toBe(chosen.id);
    expect(reloaded?.totalVotes).toBe(1);
    expect(reloaded?.options.find((o) => o.id === chosen.id)?.votes).toBe(1);
  });

  it("prevents a duplicate vote", async () => {
    const { poll } = await makePoll();
    const chosen = poll.options[0];

    await votePollOption(db, viewer({ uid: VIEWER }), poll.id, chosen.id);
    const second = await votePollOption(db, viewer({ uid: VIEWER }), poll.id, poll.options[1].id);
    expect(second.status).toBe("already_voted");
  });

  it("survives concurrent duplicate votes without double counting", async () => {
    const { post, poll } = await makePoll();
    const chosen = poll.options[0];

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        votePollOption(db, viewer({ uid: VIEWER }), poll.id, chosen.id),
      ),
    );
    expect(results.filter((r) => r.status === "voted")).toHaveLength(1);

    const reloaded = await findPollForViewer(db, viewer({ uid: VIEWER }), post.id);
    expect(reloaded?.totalVotes).toBe(1);
  });

  it("rejects an option that belongs to a different poll", async () => {
    const first = await makePoll();
    // A second poll needs a second post, since one poll per post is enforced.
    const otherPost = await makePost({ title: "Another", type: "poll", pollOptions: ["X", "Y"] });
    const otherPoll = await findPollForViewer(db, viewer(), otherPost.id);
    if (!otherPoll) throw new Error("poll missing");

    const result = await votePollOption(db, viewer({ uid: VIEWER }), first.poll.id, otherPoll.options[0].id);
    expect(result.status).toBe("invalid");
  });

  it("hides a poll on a post the viewer cannot see", async () => {
    const post = await makePost({
      title: "Private poll",
      type: "poll",
      pollOptions: ["A", "B"],
      visibility: "members",
      communitySlug: "writers",
    });
    expect(await findPollForViewer(db, viewer(), post.id)).toBeNull();
    expect(await findPollForViewer(db, viewer({ memberSlugs: ["writers"] }), post.id)).not.toBeNull();
  });

  it("refuses a vote on a poll the voter cannot see", async () => {
    const post = await makePost({
      title: "Private poll",
      type: "poll",
      pollOptions: ["A", "B"],
      visibility: "members",
      communitySlug: "writers",
    });
    const poll = await findPollForViewer(db, viewer({ memberSlugs: ["writers"] }), post.id);
    if (!poll) throw new Error("poll missing");

    const result = await votePollOption(db, viewer({ uid: VIEWER }), poll.id, poll.options[0].id);
    expect(result.status).toBe("not_found");
  });
});

describe.skipIf(!ready)("attachments", () => {
  const path = (postId: string, uid = AUTHOR, name = "doc.pdf") => `${uid}/${postId}/${name}`;

  it("records an attachment owned by the post's author", async () => {
    const post = await makePost();
    const result = await createAttachment(db, viewer({ uid: AUTHOR }), post.id, {
      storagePath: path(post.id),
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });

    expect(result.status).toBe("created");
    if (result.status !== "created") return;
    expect(result.attachment.uploaderUid).toBe(AUTHOR);
    expect(result.attachment.storagePath).toBe(path(post.id));
  });

  it("refuses an attachment on someone else's post", async () => {
    const post = await makePost();
    const result = await createAttachment(db, viewer({ uid: VIEWER }), post.id, {
      storagePath: path(post.id, VIEWER),
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });
    expect(result.status).toBe("forbidden");
  });

  it("refuses a storage path outside the uploader's own folder", async () => {
    const post = await makePost();
    const result = await createAttachment(db, viewer({ uid: AUTHOR }), post.id, {
      // Claims a path in another user's folder for this post.
      storagePath: `${VIEWER}/${post.id}/sneaky.pdf`,
      fileName: "sneaky.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });
    expect(result.status).toBe("invalid");
  });

  it("enforces the three-document limit, including under concurrency", async () => {
    const post = await makePost();
    const upload = (name: string) =>
      createAttachment(db, viewer({ uid: AUTHOR }), post.id, {
        storagePath: path(post.id, AUTHOR, name),
        fileName: name,
        mimeType: "application/pdf",
        fileSize: 10,
      });

    await upload("one.pdf");
    await upload("two.pdf");
    await upload("three.pdf");
    expect((await upload("four.pdf")).status).toBe("limit_reached");

    // A fresh post: four concurrent inserts must not all succeed.
    const other = await makePost({ title: "Concurrent" });
    const results = await Promise.all(
      ["a.pdf", "b.pdf", "c.pdf", "d.pdf"].map((name) =>
        createAttachment(db, viewer({ uid: AUTHOR }), other.id, {
          storagePath: path(other.id, AUTHOR, name),
          fileName: name,
          mimeType: "application/pdf",
          fileSize: 10,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "created")).toHaveLength(3);
  });

  it("only the uploader can remove an attachment", async () => {
    const post = await makePost();
    const created = await createAttachment(db, viewer({ uid: AUTHOR }), post.id, {
      storagePath: path(post.id),
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });
    if (created.status !== "created") throw new Error("not created");

    expect(
      (await removeAttachment(db, viewer({ uid: VIEWER }), created.attachment.id)).status,
    ).toBe("not_found");
    expect((await removeAttachment(db, viewer({ uid: AUTHOR }), created.attachment.id)).status).toBe(
      "removed",
    );
  });

  it("hides attachments for a post the viewer cannot see, and for a removed post", async () => {
    const hidden = await makePost({ visibility: "members", communitySlug: "writers" });
    await createAttachment(db, viewer({ uid: AUTHOR }), hidden.id, {
      storagePath: path(hidden.id),
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });
    expect(await findAttachmentsForViewer(db, viewer(), hidden.id)).toEqual([]);
    expect(
      (await findAttachmentsForViewer(db, viewer({ memberSlugs: ["writers"] }), hidden.id)).length,
    ).toBe(1);

    const removed = await makePost({ title: "Removed" });
    await createAttachment(db, viewer({ uid: AUTHOR }), removed.id, {
      storagePath: path(removed.id),
      fileName: "gone.pdf",
      mimeType: "application/pdf",
      fileSize: 10,
    });
    await softDeletePost(db, viewer({ uid: AUTHOR }), removed.id);
    expect(await findAttachmentsForViewer(db, viewer({ uid: AUTHOR }), removed.id)).toEqual([]);
  });

  it("rejects a file path whose second segment is not the post", async () => {
    const post = await makePost();
    const other = await makePost({ title: "Other" });
    const result = await createAttachment(db, viewer({ uid: AUTHOR }), post.id, {
      storagePath: `${AUTHOR}/${other.id}/mismatch.pdf`,
      fileName: "mismatch.pdf",
      mimeType: "application/pdf",
      fileSize: 10,
    });
    expect(result.status).toBe("invalid");
  });
});

describe.skipIf(!ready)("saved posts", () => {
  it("toggles on and off", async () => {
    const post = await makePost();

    expect((await toggleSavedPost(db, viewer({ uid: VIEWER }), post.id)).status).toBe("saved");
    expect(await findSavedPostIds(db, viewer({ uid: VIEWER }))).toEqual([post.id]);

    expect((await toggleSavedPost(db, viewer({ uid: VIEWER }), post.id)).status).toBe("removed");
    expect(await findSavedPostIds(db, viewer({ uid: VIEWER }))).toEqual([]);
  });

  it("keeps each user's bookmarks private", async () => {
    const post = await makePost();
    await toggleSavedPost(db, viewer({ uid: VIEWER }), post.id);

    // Taking no uid is the guarantee: `findSavedPostIds` can only ever answer for the
    // viewer, so "another user's bookmarks" is not an expressible call.
    expect(await findSavedPostIds(db, viewer({ uid: MEMBER }))).toEqual([]);
    expect(findSavedPostIds.length).toBe(2); // (db, viewer) — no uid parameter
  });

  it("refuses to save a post the viewer cannot see", async () => {
    const post = await makePost({ visibility: "members", communitySlug: "writers" });
    expect((await toggleSavedPost(db, viewer({ uid: VIEWER }), post.id)).status).toBe("not_found");
  });

  it("rejects an unauthenticated save", async () => {
    const post = await makePost();
    expect((await toggleSavedPost(db, anon(), post.id)).status).toBe("forbidden");
  });

  it("survives concurrent double-toggles without a duplicate key error", async () => {
    const post = await makePost();
    const voter = viewer({ uid: VIEWER });

    // A double click: one of these saves, the other removes. Neither may throw.
    const results = await Promise.all([
      toggleSavedPost(db, voter, post.id),
      toggleSavedPost(db, voter, post.id),
    ]);
    expect(results.every((r) => r.status === "saved" || r.status === "removed")).toBe(true);

    // Whatever the interleaving, the row count is 0 or 1 — never 2.
    const count = await pool.query(
      `select count(*)::int as n from saved_posts where "userId" = $1 and "postId" = $2`,
      [VIEWER, post.id],
    );
    expect(count.rows[0].n).toBeLessThanOrEqual(1);
  });
});

describe.skipIf(!ready)("roles and verification (Phase 2D §7)", () => {
  it("an admin can promote a member", async () => {
    const result = await setUserRole(db, ADMIN, MEMBER, "moderator");
    expect(result.status).toBe("updated");

    const row = await pool.query(`select role from profiles where uid = $1`, [MEMBER]);
    expect(row.rows[0].role).toBe("moderator");
  });

  it("a normal user cannot change anyone's role, including their own", async () => {
    expect((await setUserRole(db, MEMBER, MEMBER, "admin")).status).toBe("forbidden");

    const self = await pool.query(`select role from profiles where uid = $1`, [MEMBER]);
    expect(self.rows[0].role).toBe("member");
  });

  it("a moderator cannot grant roles", async () => {
    // `is_admin` tested for exactly 'admin'; a moderator is not enough.
    expect((await setUserRole(db, MODERATOR, MEMBER, "admin")).status).toBe("forbidden");
  });

  it("an admin cannot demote themselves", async () => {
    expect((await setUserRole(db, ADMIN, ADMIN, "member")).status).toBe("self_demotion");

    const row = await pool.query(`select role from profiles where uid = $1`, [ADMIN]);
    expect(row.rows[0].role).toBe("admin");
  });

  it("an admin can rename their own role to admin (no-op, but allowed)", async () => {
    expect((await setUserRole(db, ADMIN, ADMIN, "admin")).status).toBe("updated");
  });

  it("rejects an invalid role value", async () => {
    expect((await setUserRole(db, ADMIN, MEMBER, "superuser")).status).toBe("invalid");
  });

  it("reports a missing target rather than creating one", async () => {
    const ghost = "00000000-0000-4000-8000-00000000dead";
    expect((await setUserRole(db, ADMIN, ghost, "member")).status).toBe("not_found");
    const rows = await pool.query(`select uid from profiles where uid = $1`, [ghost]);
    expect(rows.rows).toEqual([]);
  });

  it("only an admin can set Verified Pro", async () => {
    expect((await setUserVerifiedPro(db, MEMBER, MEMBER, true)).status).toBe("forbidden");
    expect((await setUserVerifiedPro(db, MODERATOR, MEMBER, true)).status).toBe("forbidden");

    const denied = await pool.query(`select "isVerifiedPro" from profiles where uid = $1`, [MEMBER]);
    expect(denied.rows[0].isVerifiedPro).toBe(false);
  });

  it("an admin can grant and revoke Verified Pro", async () => {
    expect((await setUserVerifiedPro(db, ADMIN, MEMBER, true)).status).toBe("updated");
    let row = await pool.query(`select "isVerifiedPro" from profiles where uid = $1`, [MEMBER]);
    expect(row.rows[0].isVerifiedPro).toBe(true);

    expect((await setUserVerifiedPro(db, ADMIN, MEMBER, false)).status).toBe("updated");
    row = await pool.query(`select "isVerifiedPro" from profiles where uid = $1`, [MEMBER]);
    expect(row.rows[0].isVerifiedPro).toBe(false);
  });

  it("a demoted admin immediately loses the ability to grant roles", async () => {
    // Role checks read the actor's row at the time of the call, not a cached identity.
    await pool.query(`update profiles set role = 'member' where uid = $1`, [ADMIN]);
    expect((await setUserRole(db, ADMIN, MEMBER, "admin")).status).toBe("forbidden");
  });
});

describe.skipIf(!ready)("schema invariants", () => {
  it("rejects an unknown visibility", async () => {
    await expect(
      pool.query(
        `insert into posts (title, body, "authorUid", visibility) values ('t', 'b', $1, 'secret')`,
        [AUTHOR],
      ),
    ).rejects.toThrow(/violates check constraint/);
  });

  it("rejects a restricted post with no community", async () => {
    await expect(
      pool.query(
        `insert into posts (title, body, "authorUid", visibility, "communityId") values ('t', 'b', $1, 'members', null)`,
        [AUTHOR],
      ),
    ).rejects.toThrow(/posts_restricted_requires_community/);
  });

  it("rejects a vote value outside ±1", async () => {
    const post = await makePost();
    await expect(
      pool.query(
        `insert into votes ("userId", "entityType", "entityId", "voteValue") values ($1, 'post', $2, 5)`,
        [VIEWER, post.id],
      ),
    ).rejects.toThrow(/votes_value_check/);
  });

  it("enforces one vote per user per entity", async () => {
    const post = await makePost();
    await pool.query(
      `insert into votes ("userId", "entityType", "entityId", "voteValue") values ($1, 'post', $2, 1)`,
      [VIEWER, post.id],
    );
    await expect(
      pool.query(
        `insert into votes ("userId", "entityType", "entityId", "voteValue") values ($1, 'post', $2, 1)`,
        [VIEWER, post.id],
      ),
    ).rejects.toThrow(/votes_identity_key|duplicate key/);
  });

  it("enforces one saved post per user per post", async () => {
    const post = await makePost();
    await pool.query(`insert into saved_posts ("userId", "postId") values ($1, $2)`, [VIEWER, post.id]);
    await expect(
      pool.query(`insert into saved_posts ("userId", "postId") values ($1, $2)`, [VIEWER, post.id]),
    ).rejects.toThrow(/duplicate key|saved_posts_pkey/);
  });

  it("rejects an attachment path that does not match its owner and post", async () => {
    const post = await makePost();
    await expect(
      pool.query(
        `insert into post_attachments ("postId", "uploaderUid", "storagePath", "fileName", "mimeType", "fileSize")
         values ($1, $2, $3, 'x.pdf', 'application/pdf', 10)`,
        [post.id, AUTHOR, `${VIEWER}/${post.id}/x.pdf`],
      ),
    ).rejects.toThrow(/attachment_path_owned/);
  });

  it("rejects an unsupported mime type", async () => {
    const post = await makePost();
    await expect(
      pool.query(
        `insert into post_attachments ("postId", "uploaderUid", "storagePath", "fileName", "mimeType", "fileSize")
         values ($1, $2, $3, 'program', 'application/x-msdownload', 10)`,
        [post.id, AUTHOR, `${AUTHOR}/${post.id}/x.exe`],
      ),
    ).rejects.toThrow(/post_attachments_mime_type_check/);
  });

  it("cascades comments, polls and attachments when a post is hard-deleted", async () => {
    // The application soft-deletes, so this is about the FK actions being correct
    // rather than an executed path.
    const post = await makePost({ title: "Poll", type: "poll", pollOptions: ["A", "B"] });
    await createComment(db, viewer({ uid: VIEWER }), post.id, { body: "x" });
    await createAttachment(db, viewer({ uid: AUTHOR }), post.id, {
      storagePath: `${AUTHOR}/${post.id}/doc.pdf`,
      fileName: "doc.pdf",
      mimeType: "application/pdf",
      fileSize: 10,
    });
    await toggleSavedPost(db, viewer({ uid: VIEWER }), post.id);

    await pool.query(`delete from posts where id = $1`, [post.id]);

    expect((await pool.query(`select id from comments where "postId" = $1`, [post.id])).rows).toEqual([]);
    expect((await pool.query(`select id from polls where "postId" = $1`, [post.id])).rows).toEqual([]);
    expect(
      (await pool.query(`select id from post_attachments where "postId" = $1`, [post.id])).rows,
    ).toEqual([]);
    expect(
      // `saved_posts` has a composite primary key and no surrogate `id`.
      (await pool.query(`select "postId" from saved_posts where "postId" = $1`, [post.id])).rows,
    ).toEqual([]);
  });

  it("creates the poll and its options in the same transaction as the post", async () => {
    // The Supabase version inserted the poll after the post and ignored the failure,
    // which could leave a `type: 'poll'` post with nothing to vote on. Now a failure
    // rolls the post back too, so a poll post either has options or does not exist.
    const post = await makePost({ type: "poll", pollOptions: ["Alpha", "Beta", "Gamma"] });

    const polls = await pool.query(`select id from polls where "postId" = $1`, [post.id]);
    expect(polls.rows).toHaveLength(1);

    const options = await pool.query(
      `select label, position from poll_options where "pollId" = $1 order by position`,
      [polls.rows[0].id],
    );
    expect(options.rows).toEqual([
      { label: "Alpha", position: 0 },
      { label: "Beta", position: 1 },
      { label: "Gamma", position: 2 },
    ]);
  });

  it("cannot leave a poll post without a poll", async () => {
    // A poll with fewer than two options is rejected outright, so the inconsistent
    // state is unreachable from the service layer.
    await expect(
      createPost(db, AUTHOR, { title: "Half poll", body: "b", type: "poll", pollOptions: ["Only"] }),
    ).resolves.toEqual({ status: "invalid" });

    const posts = await pool.query(`select id from posts where title = 'Half poll'`);
    expect(posts.rows).toEqual([]);
  });

  it("votes do NOT cascade on post deletion, because entityId has no foreign key", async () => {
    // `votes."entityId"` is a polymorphic reference (`entityType` + `entityId`), so
    // PostgreSQL cannot constrain it and cannot cascade it. This is a real property of
    // the unified vote model, carried over from the Supabase schema rather than
    // introduced here — recorded as a test so nobody assumes otherwise.
    const post = await makePost();
    await castVote(db, viewer({ uid: VIEWER }), { entityType: "post", entityId: post.id, voteValue: 1 });
    await pool.query(`delete from posts where id = $1`, [post.id]);

    const votes = await pool.query(`select id from votes where "entityId" = $1`, [post.id]);
    expect(votes.rows).toHaveLength(1);

    // Clean up the orphan explicitly so the next test starts clean.
    await pool.query(`delete from votes where "entityId" = $1`, [post.id]);
  });
});
