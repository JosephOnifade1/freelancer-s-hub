import { beforeEach, describe, expect, it } from "vitest";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";
import { getErrorMessage } from "./utils";

const readRows = <T,>(table: string): T[] =>
  JSON.parse(localStorage.getItem(`mock_supabase_${table}`) || "[]") as T[];

const writeRows = (table: string, rows: unknown[]) =>
  localStorage.setItem(`mock_supabase_${table}`, JSON.stringify(rows));

const signInAs = (uid: string) => {
  localStorage.setItem("mock_supabase_session", JSON.stringify({ user: { id: uid } }));
};

const seedMinimal = () => {
  writeRows("posts", [
    { id: "p1", authorUid: "author", visibility: "public", allowComments: true, isDeleted: false, score: 0, ups: 0, downs: 0, commentCount: 0 },
    { id: "p2", authorUid: "author", visibility: "public", allowComments: true, isDeleted: false, score: 0, ups: 0, downs: 0, commentCount: 0 },
  ]);
  writeRows("comments", []);
  writeRows("profiles", [
    { uid: "author", role: "member", reputation: 0 },
    { uid: "voter", role: "member", reputation: 0 },
    { uid: "other", role: "member", reputation: 0 },
  ]);
  writeRows("votes", []);
};

type PostRow = { id: string; score: number; ups: number; downs: number; commentCount: number; visibility?: string; isDeleted?: boolean; allowComments?: boolean };
type CommentRow = { id: string; postId: string; isDeleted?: boolean; score?: number; authorUid?: string };
type ProfileRow = { uid: string; reputation: number };

const post = (id = "p1") => readRows<PostRow>("posts").find((row) => row.id === id)!;
const profile = (uid = "author") => readRows<ProfileRow>("profiles").find((row) => row.uid === uid)!;

const updateLocalPost = (id: string, patch: Partial<PostRow>) =>
  writeRows("posts", readRows<PostRow>("posts").map((row) => row.id === id ? { ...row, ...patch } : row));

const cast = (client: MockSupabaseClient, entityId: string, entityType: string, voterUid: string, newVote: number) =>
  client.rpc("cast_vote", { entity_id: entityId, entity_type: entityType, voter_uid: voterUid, new_vote: newVote });

describe("demo post interaction parity", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMinimal();
    signInAs("voter");
  });

  it("serially applies the previous-vote delta and never double-counts a repeated vote", async () => {
    const client = new MockSupabaseClient();
    expect((await cast(client, "p1", "post", "voter", 1)).error).toBeNull();
    expect([post().score, post().ups, post().downs, profile().reputation]).toEqual([1, 1, 0, 1]);
    expect((await cast(client, "p1", "post", "voter", 1)).error).toBeNull();
    expect([post().score, post().ups, post().downs, profile().reputation]).toEqual([1, 1, 0, 1]);
    expect(readRows("votes")).toHaveLength(1);

    expect((await cast(client, "p1", "post", "voter", -1)).error).toBeNull();
    expect([post().score, post().ups, post().downs, profile().reputation]).toEqual([-1, 0, 1, -1]);
    expect((await cast(client, "p1", "post", "voter", 0)).error).toBeNull();
    expect([post().score, post().ups, post().downs, profile().reputation]).toEqual([0, 0, 0, 0]);
    expect(readRows("votes")).toHaveLength(0);
  });

  it("rejects unauthenticated, forged, invalid, deleted and self votes without changing aggregates", async () => {
    const client = new MockSupabaseClient();
    const errors = [
      await cast(client, "p1", "post", "author", 1),
      await cast(client, "p1", "post", "voter", 2),
      await cast(client, "p1", "unknown", "voter", 1),
    ];
    expect(errors.every((result) => result.error)).toBe(true);

    signInAs("author");
    expect(getErrorMessage((await cast(client, "p1", "post", "author", 1)).error, "")).toMatch(/own content/);
    localStorage.removeItem("mock_supabase_session");
    expect(getErrorMessage((await cast(client, "p1", "post", "voter", 1)).error, "")).toMatch(/Not authorized/);

    signInAs("voter");
    updateLocalPost("p1", { isDeleted: true });
    expect(getErrorMessage((await cast(client, "p1", "post", "voter", 1)).error, "")).toMatch(/deleted/);
    writeRows("comments", [{ id: "c1", postId: "p1", authorUid: "other", isDeleted: false }]);
    expect(getErrorMessage((await cast(client, "c1", "comment", "voter", 1)).error, "")).toMatch(/deleted/);
    updateLocalPost("p1", { isDeleted: false });
    writeRows("comments", [{ id: "c1", postId: "p1", authorUid: "other", isDeleted: true }]);
    expect(getErrorMessage((await cast(client, "c1", "comment", "voter", 1)).error, "")).toMatch(/deleted/);

    expect([post().score, post().ups, post().downs, profile().reputation]).toEqual([0, 0, 0, 0]);
    expect(readRows("votes")).toHaveLength(0);
  });

  it("enforces private-post visibility for post and comment votes", async () => {
    const client = new MockSupabaseClient();
    updateLocalPost("p1", { visibility: "members" });
    writeRows("comments", [{ id: "c1", postId: "p1", authorUid: "other", score: 0, isDeleted: false }]);

    expect(getErrorMessage((await cast(client, "p1", "post", "voter", 1)).error, "")).toMatch(/Not authorized/);
    expect(getErrorMessage((await cast(client, "c1", "comment", "voter", 1)).error, "")).toMatch(/Not authorized/);
    writeRows("community_members", [{ userId: "voter", communitySlug: "space" }]);
    updateLocalPost("p1", { communitySlug: "space" } as Partial<PostRow>);
    expect((await cast(client, "c1", "comment", "voter", 1)).error).toBeNull();
    expect(readRows<CommentRow>("comments")[0].score).toBe(1);

    updateLocalPost("p1", { visibility: "admins" });
    expect(getErrorMessage((await cast(client, "p1", "post", "voter", 1)).error, "")).toMatch(/Not authorized/);
    writeRows("communities", [{ slug: "space", ownerId: "voter" }]);
    expect((await cast(client, "p1", "post", "voter", 1)).error).toBeNull();
  });

  it("maintains active comment counts on insert, soft-delete, restore and hard-delete", async () => {
    const client = new MockSupabaseClient();
    const first = await client.from("comments").insert({ id: "c1", postId: "p1", authorUid: "voter", body: "First", isDeleted: false }).select("id").single();
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ id: "c1" });
    expect(post().commentCount).toBe(1);

    const reply = await client.from("comments").insert({ id: "c2", postId: "p1", authorUid: "voter", parentId: "c1", body: "Reply", isDeleted: false }).select("id").single();
    expect(reply.error).toBeNull();
    expect(post().commentCount).toBe(2);

    await client.from("comments").update({ isDeleted: true }).eq("id", "c1");
    expect(post().commentCount).toBe(1);
    await client.from("comments").update({ isDeleted: true }).eq("id", "c1");
    expect(post().commentCount).toBe(1);
    await client.from("comments").update({ isDeleted: false }).eq("id", "c1");
    expect(post().commentCount).toBe(2);
    await client.from("comments").delete().eq("id", "c2");
    expect(post().commentCount).toBe(1);
    updateLocalPost("p2", { allowComments: false });
    expect((await client.from("comments").update({ postId: "p2" }).eq("id", "c1")).error?.message).toMatch(/closed/);
    expect([post().commentCount, post("p2").commentCount]).toEqual([1, 0]);
    updateLocalPost("p2", { allowComments: true });
    await client.from("comments").update({ postId: "p2" }).eq("id", "c1");
    expect([post().commentCount, post("p2").commentCount]).toEqual([0, 1]);
  });

  it("blocks new comments on closed/deleted/private posts and cross-post replies", async () => {
    const client = new MockSupabaseClient();
    const insert = (id: string, postId = "p1", parentId?: string) => client.from("comments")
      .insert({ id, postId, parentId, authorUid: "voter", body: "Test" }).select("id").single();

    updateLocalPost("p1", { allowComments: false });
    expect(getErrorMessage((await insert("c1")).error, "")).toMatch(/turned off/);
    updateLocalPost("p1", { allowComments: true, isDeleted: true });
    expect(getErrorMessage((await insert("c1")).error, "")).toMatch(/turned off/);
    updateLocalPost("p1", { isDeleted: false, visibility: "admins" });
    expect(getErrorMessage((await insert("c1")).error, "")).toMatch(/Not authorized/);
    updateLocalPost("p1", { visibility: "public" });
    expect((await insert("c1")).error).toBeNull();
    expect(getErrorMessage((await insert("c2", "p2", "c1")).error, "")).toMatch(/different post/);
    expect([post().commentCount, post("p2").commentCount]).toEqual([1, 0]);
  });

  it("updates the counter once when moderation soft-deletes a comment", async () => {
    const client = new MockSupabaseClient();
    writeRows("comments", [{ id: "c1", postId: "p1", authorUid: "other", isDeleted: false }]);
    updateLocalPost("p1", { commentCount: 1 });
    writeRows("reports", [{ id: "r1", entityType: "comment", entityId: "c1", status: "open" }]);
    writeRows("profiles", [...readRows("profiles"), { uid: "moderator", role: "moderator" }]);
    signInAs("moderator");

    const args = { report_id: "r1", remove_content: true, new_status: "resolved" };
    expect((await client.rpc("moderate_report", args)).error).toBeNull();
    expect(readRows<CommentRow>("comments")[0].isDeleted).toBe(true);
    expect(post().commentCount).toBe(0);
    expect((await client.rpc("moderate_report", args)).error).toBeNull();
    expect(post().commentCount).toBe(0);
  });

  it("backfills legacy demo counters to the number of active comments", () => {
    localStorage.clear();
    seedMockData();
    expect([post("1").commentCount, post("2").commentCount, post("3").commentCount, post("5").commentCount]).toEqual([0, 1, 1, 1]);

    const stale = readRows<PostRow>("posts");
    stale[0].commentCount = 99;
    writeRows("posts", stale);
    localStorage.removeItem("mock_post_comment_count_reconciled_v1");
    seedMockData();
    expect(post("1").commentCount).toBe(0);
  });
});
