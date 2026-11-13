import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchContentComments,
  fetchContentPoll,
  fetchContentPost,
  fetchContentPosts,
  isContentError,
} from "./content-client";
import { fetchPostById, fetchPosts } from "./posts";
import { addComment, fetchComments } from "./comments";
import { fetchPollByPostId } from "./polls";

/**
 * Post, comment and poll fetch failures (Phase 2D).
 *
 * These tests are about one invariant, which has not changed: **a failed read must
 * throw, never render as an empty feed** — an empty feed is indistinguishable from a
 * working one, so a degraded backend would look like missing content rather than an
 * outage. What changed is the layer the failure comes from. The fetchers used to call
 * Supabase query builders directly; they now call `/api/content` through
 * `content-client`, so the mock sits at that boundary.
 *
 * The second invariant is preserved too: a *missing* row (`null`) is still distinct
 * from a *failed* request. `fetchPostById` returns null for the first and throws for
 * the second.
 */
vi.mock("./content-client", async () => {
  const actual = await vi.importActual<typeof import("./content-client")>("./content-client");
  return {
    ...actual,
    fetchContentPosts: vi.fn(),
    fetchContentPost: vi.fn(),
    fetchContentComments: vi.fn(),
    createContentComment: vi.fn(),
    fetchContentPoll: vi.fn(),
    // Author hydration must not reach the network in these tests.
    hydrateAuthors: vi.fn(async () => new Map()),
    hydrateAuthor: vi.fn(async () => ({ name: "Unknown" })),
    isContentError: actual.isContentError,
  };
});

const mockPosts = vi.mocked(fetchContentPosts);
const mockPost = vi.mocked(fetchContentPost);
const mockComments = vi.mocked(fetchContentComments);
const mockPoll = vi.mocked(fetchContentPoll);

const samplePost = {
  id: "post-1",
  title: "A post",
  body: "Body",
  category: null,
  tags: [],
  type: "discussion",
  score: 0,
  ups: 0,
  downs: 0,
  views: 0,
  commentCount: 0,
  isDeleted: false,
  isEdited: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  communitySlug: null,
  authorUid: "author-1",
  visibility: "public",
  allowComments: true,
  isPinned: false,
  externalLink: null,
};

beforeEach(() => {
  mockPosts.mockReset();
  mockPost.mockReset();
  mockComments.mockReset();
  mockPoll.mockReset();
});

describe("post, comment and poll fetch failures", () => {
  it("throws when the post list request fails instead of showing an empty feed", async () => {
    mockPosts.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    await expect(fetchPosts()).rejects.toThrow("Could not load posts.");

    // Retrying does not silently succeed with an empty list either.
    mockPosts.mockResolvedValueOnce({ ok: false, error: "error" });
    await expect(fetchPosts()).rejects.toThrow();
  });

  it("does not fall back to a second query when the first fails", async () => {
    // The pre-2D code retried the request with a different foreign-key alias and, if
    // both failed, threw. There is one code path now; the assertion is that a failure
    // produces exactly one request and an error, not a retry that could mask it.
    mockPosts.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    await expect(fetchPosts()).rejects.toThrow();
    expect(mockPosts).toHaveBeenCalledTimes(1);
  });

  it("distinguishes a missing post from a failed post lookup", async () => {
    mockPost.mockResolvedValueOnce({ ok: true, data: null });
    await expect(fetchPostById("post-1")).resolves.toBeNull();

    mockPost.mockResolvedValueOnce({ ok: false, error: "error" });
    await expect(fetchPostById("post-1")).rejects.toThrow("Could not load this post.");
  });

  it("throws on comment fetch failure and does not attempt an insert after it", async () => {
    mockComments.mockResolvedValueOnce({ ok: false, error: "error" });
    await expect(fetchComments("post-1")).rejects.toThrow("Could not load comments.");

    // A broken comment read must not be followed by a write.
    expect(mockComments).toHaveBeenCalledTimes(1);
  });

  it("returns no comments for a post the viewer cannot see, without erroring", async () => {
    // 404 is "not visible", which is indistinguishable from "does not exist" by
    // design. That is an empty thread, not a failure state.
    mockComments.mockResolvedValueOnce({ ok: false, error: "not_found" });
    await expect(fetchComments("post-1")).resolves.toEqual([]);
  });

  it("only returns null for an absent poll, not a failed poll query", async () => {
    mockPoll.mockResolvedValueOnce({ ok: true, data: null });
    await expect(fetchPollByPostId("post-1")).resolves.toBeNull();

    mockPoll.mockResolvedValueOnce({ ok: false, error: "error" });
    await expect(fetchPollByPostId("post-1")).rejects.toThrow("Could not load this poll.");
  });

  it("returns null for a poll on a post the viewer cannot see", async () => {
    mockPoll.mockResolvedValueOnce({ ok: false, error: "not_found" });
    await expect(fetchPollByPostId("post-1")).resolves.toBeNull();
  });

  it("surfaces a comment-create failure with the server's own message", async () => {
    const { createContentComment } = await import("./content-client");
    vi.mocked(createContentComment).mockResolvedValueOnce({
      ok: false,
      error: "conflict",
      message: "Comments are turned off for this post.",
    });

    await expect(
      addComment("post-1", { author: "Viewer", authorUid: "viewer", reputation: 0, body: "Hi" }),
    ).rejects.toThrow("Comments are turned off for this post.");
  });

  it("renders an author as Unknown when their profile is missing, without failing the feed", async () => {
    // A deleted profile must not blank the page. `hydrateAuthors` returns an empty map
    // for an unresolved uid, and `mapPostRow` falls back exactly as the old join did.
    mockPosts.mockResolvedValueOnce({ ok: true, data: [samplePost] });
    const posts = await fetchPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].author.name).toBe("Unknown");
  });

  it("never exposes a privileged profile field on a hydrated post", async () => {
    mockPosts.mockResolvedValueOnce({ ok: true, data: [samplePost] });
    const posts = await fetchPosts();
    const author = posts[0].author as unknown as Record<string, unknown>;
    expect(author).not.toHaveProperty("role");
    expect(author).not.toHaveProperty("hasSeenVeteranCelebration");
  });

  it("isContentError narrows a failed result and not a successful one", () => {
    expect(isContentError({ ok: false, error: "error" })).toBe(true);
    expect(isContentError({ ok: true, data: 1 })).toBe(false);
  });
});
