import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "./supabase";
import { fetchPostById, fetchPosts } from "./posts";
import { addComment, fetchComments } from "./comments";
import { fetchPollByPostId } from "./polls";

vi.mock("./supabase", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn() } },
}));

// Supabase query builders are awaitable and also support .select/.eq/.order
// before being awaited. This small stub lets the test exercise our fetchers'
// error handling rather than just mocking the fetchers themselves.
const query = (data: unknown, message?: string) => {
  const result = Promise.resolve({ data, error: message ? { message } : null });
  const builder = Object.assign(result, {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: () => result,
  });
  return builder;
};

const from = vi.mocked(supabase.from);

describe("post, comment and poll fetch failures", () => {
  beforeEach(() => from.mockReset());

  it("throws when both post list joins fail instead of showing an empty feed", async () => {
    from.mockReturnValueOnce(query(null, "Backend unavailable") as never)
      .mockReturnValueOnce(query(null, "Backend unavailable") as never);
    await expect(fetchPosts()).rejects.toThrow("Backend unavailable");
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("distinguishes a missing post from a failed post lookup", async () => {
    from.mockReturnValueOnce(query(null) as never);
    await expect(fetchPostById("post-1")).resolves.toBeNull();
    from.mockReturnValueOnce(query(null, "Post query failed") as never);
    await expect(fetchPostById("post-1")).rejects.toThrow("Post query failed");
  });

  it("throws on comment fetch failure and doesn't attempt an insert after a failed post preflight", async () => {
    from.mockReturnValueOnce(query(null, "Comment query failed") as never);
    await expect(fetchComments("post-1")).rejects.toThrow("Comment query failed");
    from.mockReturnValueOnce(query(null, "Post preflight failed") as never);
    await expect(addComment("post-1", {
      author: "Viewer", authorUid: "viewer", reputation: 0, body: "A comment",
    })).rejects.toThrow("Post preflight failed");
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("only returns null for an absent poll, not a failed poll query", async () => {
    from.mockReturnValueOnce(query(null) as never);
    await expect(fetchPollByPostId("post-1")).resolves.toBeNull();
    from.mockReturnValueOnce(query(null, "Poll query failed") as never);
    await expect(fetchPollByPostId("post-1")).rejects.toThrow("Poll query failed");
  });

  it("surfaces failures from poll options and vote reads", async () => {
    from.mockReturnValueOnce(query({ id: "poll-1" }) as never)
      .mockReturnValueOnce(query(null, "Options query failed") as never);
    await expect(fetchPollByPostId("post-1")).rejects.toThrow("Options query failed");
    from.mockReturnValueOnce(query({ id: "poll-1" }) as never)
      .mockReturnValueOnce(query([{ id: "opt-1", label: "First" }]) as never)
      .mockReturnValueOnce(query(null, "Votes query failed") as never);
    await expect(fetchPollByPostId("post-1")).rejects.toThrow("Votes query failed");
  });
});
