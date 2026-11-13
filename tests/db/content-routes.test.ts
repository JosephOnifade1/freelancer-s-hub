/**
 * Content route handlers — unit tests (Phase 2D).
 *
 * **Mocked.** The service layer is stubbed, so these prove the HTTP contract: status
 * codes, the shape of a body, and — the part that matters — that a visibility refusal
 * is a `404` indistinguishable from "no such post", while an authorization refusal on a
 * *known* resource is a `403`.
 *
 * The SQL is covered in `content-integration.test.ts`; the policy in
 * `content-services.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const services = {
  getPosts: vi.fn(),
  createPostForCurrentUser: vi.fn(),
  getPost: vi.fn(),
  updatePostForCurrentUser: vi.fn(),
  deletePostForCurrentUser: vi.fn(),
  recordPostView: vi.fn(),
  getComments: vi.fn(),
  getCommentsByAuthor: vi.fn(),
  createCommentForCurrentUser: vi.fn(),
  updateCommentForCurrentUser: vi.fn(),
  deleteCommentForCurrentUser: vi.fn(),
  getOwnVote: vi.fn(),
  castVoteForCurrentUser: vi.fn(),
  getPoll: vi.fn(),
  votePollForCurrentUser: vi.fn(),
  getAttachments: vi.fn(),
  createAttachmentForCurrentUser: vi.fn(),
  removeAttachmentForCurrentUser: vi.fn(),
  getSavedPostIds: vi.fn(),
  toggleSavedPostForCurrentUser: vi.fn(),
  setUserRoleByCurrentUser: vi.fn(),
  setUserVerifiedProByCurrentUser: vi.fn(),
  isContentFailure: (result: { ok: boolean }) => result.ok === false,
};

vi.mock("@/server/features/content", () => services);

const { GET: getPosts, POST: createPost } = await import("@/app/api/content/posts/route");
const { GET: getPost, PATCH: patchPost, DELETE: deletePost, POST: postView } = await import(
  "@/app/api/content/posts/[id]/route"
);
const { GET: getComments, POST: postComment } = await import(
  "@/app/api/content/posts/[id]/comments/route"
);
const { GET: getVotes, POST: castVote } = await import("@/app/api/content/votes/route");
const { GET: getPoll } = await import("@/app/api/content/polls/route");
const { POST: pollVote } = await import("@/app/api/content/polls/vote/route");
const { GET: getAttachments, POST: createAttachment } = await import(
  "@/app/api/content/attachments/route"
);
const { DELETE: deleteAttachment } = await import("@/app/api/content/attachments/[id]/route");
const { GET: savedList } = await import("@/app/api/content/saved/route");
const { POST: toggleSaved } = await import("@/app/api/content/saved/[postId]/route");
const { POST: setRole } = await import("@/app/api/admin/roles/route");
const { POST: setVerification } = await import("@/app/api/admin/verification/route");

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/content/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const POST = { id: "post-1", title: "T", authorUid: "uid-1" };

beforeEach(() => {
  for (const fn of Object.values(services)) {
    if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  }
});

describe("GET /api/content/posts", () => {
  it("returns the feed and forwards the query parameters", async () => {
    services.getPosts.mockResolvedValue({ ok: true, data: [POST] });

    const response = await getPosts(
      new Request("http://localhost/api/content/posts?limit=10&community=writers&q=react"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ posts: [POST] });
    expect(services.getPosts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, communitySlug: "writers", search: "react" }),
    );
  });

  it("clamps a hostile limit and ignores a non-numeric one", async () => {
    services.getPosts.mockResolvedValue({ ok: true, data: [] });

    await getPosts(new Request("http://localhost/api/content/posts?limit=99999"));
    expect(services.getPosts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100 }));

    await getPosts(new Request("http://localhost/api/content/posts?limit=abc"));
    expect(services.getPosts).toHaveBeenLastCalledWith(expect.objectContaining({ limit: undefined }));
  });

  it("serves anonymous visitors", async () => {
    // Public posts are readable without a session; that is not an error path.
    services.getPosts.mockResolvedValue({ ok: true, data: [POST] });
    const response = await getPosts(new Request("http://localhost/api/content/posts"));
    expect(response.status).toBe(200);
  });

  it("maps an unavailable database to 503", async () => {
    services.getPosts.mockResolvedValue({ ok: false, reason: "database_not_configured" });
    expect((await getPosts(new Request("http://localhost/api/content/posts"))).status).toBe(503);
  });
});

describe("POST /api/content/posts", () => {
  it("creates a post and never forwards an author from the body", async () => {
    services.createPostForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "created", post: POST },
    });

    const response = await createPost(
      jsonRequest({
        title: "Hello",
        body: "World",
        // A caller trying to post as someone else: the field must be ignored.
        authorUid: "someone-else",
        author: { uid: "someone-else" },
      }),
    );

    expect(response.status).toBe(201);
    const forwarded = services.createPostForCurrentUser.mock.calls[0][0];
    expect(forwarded).not.toHaveProperty("authorUid");
    expect(forwarded).not.toHaveProperty("author");
    expect(forwarded.title).toBe("Hello");
  });

  it("returns 401 without a session", async () => {
    services.createPostForCurrentUser.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const response = await createPost(jsonRequest({ title: "x", body: "y" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid input", async () => {
    services.createPostForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "invalid" },
    });
    const response = await createPost(jsonRequest({ title: "", body: "" }));
    expect(response.status).toBe(400);
  });

  it("survives a malformed JSON body", async () => {
    services.createPostForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "invalid" },
    });
    const response = await createPost(
      new Request("http://localhost/api/content/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/content/posts/[id]", () => {
  it("returns the post", async () => {
    services.getPost.mockResolvedValue({ ok: true, data: POST });
    const response = await getPost(new Request("http://localhost/x"), params({ id: "post-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ post: POST });
  });

  it("returns 404 for a post the viewer may not see, identical to a missing one", async () => {
    // The service returns `null` for both. The status must not distinguish them, or a
    // `403` would confirm that a hidden post exists.
    services.getPost.mockResolvedValue({ ok: true, data: null });
    const response = await getPost(new Request("http://localhost/x"), params({ id: "post-1" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});

describe("PATCH / DELETE /api/content/posts/[id]", () => {
  it("reports a successful edit", async () => {
    services.updatePostForCurrentUser.mockResolvedValue({ ok: true, data: { status: "updated" } });
    const response = await patchPost(jsonRequest({ body: "New" }), params({ id: "post-1" }));
    expect(response.status).toBe(200);
  });

  it("reports a non-author's edit as 404, not 403", async () => {
    // The update is scoped `where id = $1 and authorUid = $2`, so a non-author matches
    // no row. That is reported exactly like a missing post.
    services.updatePostForCurrentUser.mockResolvedValue({ ok: true, data: { status: "not_found" } });
    const response = await patchPost(jsonRequest({ body: "Hijack" }), params({ id: "post-1" }));
    expect(response.status).toBe(404);
  });

  it("requires a session to edit", async () => {
    services.updatePostForCurrentUser.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    expect((await patchPost(jsonRequest({ body: "x" }), params({ id: "post-1" }))).status).toBe(401);
  });

  it("soft-deletes and reports 404 when nothing was removable", async () => {
    services.deletePostForCurrentUser.mockResolvedValue({ ok: true, data: { status: "updated" } });
    expect((await deletePost(new Request("http://localhost/x"), params({ id: "post-1" }))).status).toBe(200);

    services.deletePostForCurrentUser.mockResolvedValue({ ok: true, data: { status: "not_found" } });
    expect((await deletePost(new Request("http://localhost/x"), params({ id: "post-1" }))).status).toBe(404);
  });

  it("records a view without exposing an error", async () => {
    services.recordPostView.mockResolvedValue(undefined);
    const response = await postView(new Request("http://localhost/x"), params({ id: "post-1" }));
    expect(response.status).toBe(200);
    expect(services.recordPostView).toHaveBeenCalledWith("post-1");
  });
});

describe("comments", () => {
  it("lists comments for a post", async () => {
    services.getComments.mockResolvedValue({ ok: true, data: [] });
    const response = await getComments(new Request("http://localhost/x"), params({ id: "post-1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ comments: [] });
  });

  it("creates a comment and forwards the parent", async () => {
    services.createCommentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "created", comment: { id: "c1" } },
    });

    const response = await postComment(
      jsonRequest({ body: "Hi", parentId: "parent-1" }),
      params({ id: "post-1" }),
    );

    // A created row is a 201, which is the same convention `POST /posts` uses.
    expect(response.status).toBe(201);
    expect(services.createCommentForCurrentUser).toHaveBeenCalledWith("post-1", {
      body: "Hi",
      parentId: "parent-1",
    });
  });

  it("maps closed comments to 409 with the server's message", async () => {
    services.createCommentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "comments_closed" },
    });
    const response = await postComment(jsonRequest({ body: "Hi" }), params({ id: "post-1" }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe("comments_closed");
  });

  it("maps a removed post to 409", async () => {
    services.createCommentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "post_removed" },
    });
    const response = await postComment(jsonRequest({ body: "Hi" }), params({ id: "post-1" }));
    expect(response.status).toBe(409);
  });

  it("maps a hidden post to 404", async () => {
    services.createCommentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "not_found" },
    });
    const response = await postComment(jsonRequest({ body: "Hi" }), params({ id: "post-1" }));
    expect(response.status).toBe(404);
  });
});

describe("votes", () => {
  it("returns the caller's own vote", async () => {
    services.getOwnVote.mockResolvedValue({ ok: true, data: 1 });
    const response = await getVotes(
      new Request("http://localhost/api/content/votes?entityType=post&entityId=p1"),
    );
    expect(await response.json()).toEqual({ voteValue: 1 });
  });

  it("requires an entity id", async () => {
    const response = await getVotes(new Request("http://localhost/api/content/votes"));
    expect(response.status).toBe(400);
  });

  it("casts a vote without accepting a voter from the body", async () => {
    services.castVoteForCurrentUser.mockResolvedValue({ ok: true, data: { status: "applied" } });

    await castVote(
      jsonRequest({ entityType: "post", entityId: "p1", voteValue: 1, userId: "someone-else" }),
    );

    expect(services.castVoteForCurrentUser).toHaveBeenCalledWith("post", "p1", 1);
    const forwarded = services.castVoteForCurrentUser.mock.calls[0];
    expect(forwarded).toHaveLength(3); // no fourth argument could smuggle a voter
  });

  it("rejects an out-of-range vote value", async () => {
    for (const voteValue of [2, -2, 0.5, "up"]) {
      const response = await castVote(jsonRequest({ entityType: "post", entityId: "p1", voteValue }));
      expect(response.status).toBe(400);
    }
    expect(services.castVoteForCurrentUser).not.toHaveBeenCalled();
  });

  it("maps a self-vote to 403 with an explanation", async () => {
    services.castVoteForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "self_vote" },
    });
    const response = await castVote(jsonRequest({ entityType: "post", entityId: "p1", voteValue: 1 }));
    expect(response.status).toBe(403);
    expect((await response.json()).message).toMatch(/your own content/i);
  });

  it("maps a vote on deleted content to 409", async () => {
    services.castVoteForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "deleted_content" },
    });
    const response = await castVote(jsonRequest({ entityType: "post", entityId: "p1", voteValue: 1 }));
    expect(response.status).toBe(409);
  });

  it("requires a session to vote", async () => {
    services.castVoteForCurrentUser.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const response = await castVote(jsonRequest({ entityType: "post", entityId: "p1", voteValue: 1 }));
    expect(response.status).toBe(401);
  });
});

describe("polls", () => {
  it("returns null when the post has no poll", async () => {
    services.getPoll.mockResolvedValue({ ok: true, data: null });
    const response = await getPoll(new Request("http://localhost/api/content/polls?postId=p1"));
    expect(await response.json()).toEqual({ poll: null });
  });

  it("requires a post id", async () => {
    expect((await getPoll(new Request("http://localhost/api/content/polls"))).status).toBe(400);
  });

  it("casts a poll vote and reports a duplicate as 409", async () => {
    services.votePollForCurrentUser.mockResolvedValue({ ok: true, data: { status: "voted" } });
    expect((await pollVote(jsonRequest({ pollId: "pl1", pollOptionId: "o1" }))).status).toBe(200);

    services.votePollForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "already_voted" },
    });
    const duplicate = await pollVote(jsonRequest({ pollId: "pl1", pollOptionId: "o1" }));
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).message).toMatch(/already voted/i);
  });
});

describe("attachments", () => {
  it("lists attachments for a post", async () => {
    services.getAttachments.mockResolvedValue({ ok: true, data: [] });
    const response = await getAttachments(
      new Request("http://localhost/api/content/attachments?postId=p1"),
    );
    expect(response.status).toBe(200);
  });

  it("registers metadata without an uploader from the body", async () => {
    services.createAttachmentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "created", attachment: { id: "a1" } },
    });

    await createAttachment(
      jsonRequest({
        postId: "p1",
        storagePath: "uid/p1/doc.pdf",
        fileName: "doc.pdf",
        mimeType: "application/pdf",
        fileSize: 10,
        uploaderUid: "someone-else",
      }),
    );

    const forwarded = services.createAttachmentForCurrentUser.mock.calls[0][1];
    expect(forwarded).not.toHaveProperty("uploaderUid");
  });

  it("maps the document limit to 409", async () => {
    services.createAttachmentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "limit_reached" },
    });
    const response = await createAttachment(
      jsonRequest({ postId: "p1", storagePath: "p1/a", fileName: "a", mimeType: "text/plain", fileSize: 1 }),
    );
    expect(response.status).toBe(409);
  });

  it("removes an attachment and reports a foreign one as 404", async () => {
    services.removeAttachmentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "removed" },
    });
    expect((await deleteAttachment(new Request("http://localhost/x"), params({ id: "a1" }))).status).toBe(200);

    services.removeAttachmentForCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "not_found" },
    });
    expect((await deleteAttachment(new Request("http://localhost/x"), params({ id: "a1" }))).status).toBe(404);
  });
});

describe("saved posts", () => {
  it("lists the caller's bookmarks", async () => {
    services.getSavedPostIds.mockResolvedValue({ ok: true, data: ["p1"] });
    const response = await savedList();
    expect(await response.json()).toEqual({ postIds: ["p1"] });
  });

  it("requires a session to list bookmarks", async () => {
    services.getSavedPostIds.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    expect((await savedList()).status).toBe(401);
  });

  it("toggles a bookmark", async () => {
    services.toggleSavedPostForCurrentUser.mockResolvedValue({ ok: true, data: { status: "saved" } });
    const response = await toggleSaved(new Request("http://localhost/x"), params({ postId: "p1" }));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("saved");
  });
});

describe("admin routes", () => {
  it("rejects a role change with no session", async () => {
    services.setUserRoleByCurrentUser.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const response = await setRole(jsonRequest({ uid: "target", role: "admin" }));
    expect(response.status).toBe(401);
  });

  it("rejects a non-admin's role change", async () => {
    services.setUserRoleByCurrentUser.mockResolvedValue({ ok: true, data: { status: "forbidden" } });
    const response = await setRole(jsonRequest({ uid: "target", role: "admin" }));
    expect(response.status).toBe(403);
  });

  it("reports a self-demotion as 409", async () => {
    services.setUserRoleByCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "self_demotion" },
    });
    const response = await setRole(jsonRequest({ uid: "self", role: "member" }));
    expect(response.status).toBe(409);
    expect((await response.json()).message).toMatch(/demote themselves/i);
  });

  it("sends only the target and the role, never an actor", async () => {
    services.setUserRoleByCurrentUser.mockResolvedValue({ ok: true, data: { status: "updated" } });
    await setRole(jsonRequest({ uid: "target", role: "moderator", actorUid: "spoofed" }));
    expect(services.setUserRoleByCurrentUser).toHaveBeenCalledWith("target", "moderator");
  });

  it("requires a boolean for verification", async () => {
    const response = await setVerification(jsonRequest({ uid: "target", verified: "yes" }));
    expect(response.status).toBe(400);
    expect(services.setUserVerifiedProByCurrentUser).not.toHaveBeenCalled();
  });

  it("sets verification for an admin", async () => {
    services.setUserVerifiedProByCurrentUser.mockResolvedValue({ ok: true, data: { status: "updated" } });
    const response = await setVerification(jsonRequest({ uid: "target", verified: true }));
    expect(response.status).toBe(200);
    expect(services.setUserVerifiedProByCurrentUser).toHaveBeenCalledWith("target", true);
  });

  it("rejects a non-admin's verification change", async () => {
    services.setUserVerifiedProByCurrentUser.mockResolvedValue({
      ok: true,
      data: { status: "forbidden" },
    });
    const response = await setVerification(jsonRequest({ uid: "target", verified: true }));
    expect(response.status).toBe(403);
  });
});

describe("every content route is dynamic", () => {
  it("declares force-dynamic so a cached response cannot serve another viewer's data", async () => {
    const routes = await Promise.all([
      import("@/app/api/content/posts/route"),
      import("@/app/api/content/posts/[id]/route"),
      import("@/app/api/content/comments/route"),
      import("@/app/api/content/votes/route"),
      import("@/app/api/content/polls/route"),
      import("@/app/api/content/attachments/route"),
      import("@/app/api/content/saved/route"),
      import("@/app/api/admin/roles/route"),
    ]);
    for (const route of routes) {
      expect((route as { dynamic?: string }).dynamic).toBe("force-dynamic");
    }
  });
});
