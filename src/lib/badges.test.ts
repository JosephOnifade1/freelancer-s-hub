import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchBadges, fetchUserBadges, computeBadgeProgress } from "./badges";
const fetcher = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});
const inputs = {
  postCount: 1,
  resourceCount: 0,
  commentCount: 0,
  commentUpvotesReceived: 0,
  reputation: 0,
  streakDays: 0,
  longestStreakDays: 0,
  topPostCommentCount: 0,
};
describe("authoritative badge API", () => {
  it("reads public catalog without a mock Supabase table", async () => {
    expect(await fetchBadges()).toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/badges",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
  it("reads public earned projection with safely encoded subject", async () => {
    await fetchUserBadges("uid");
    expect(fetcher.mock.calls[0][0]).toBe("/api/badges?uid=uid");
  });
  it("empty subject does not call API", async () => {
    expect(await fetchUserBadges("")).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not fabricate badges or awards on database errors", async () => {
    fetcher.mockResolvedValue({ ok: false });
    await expect(computeBadgeProgress("uid", inputs)).rejects.toThrow();
  });
  it("preserves existing progress calculation and earned timestamp without writing awards", async () => {
    fetcher.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({
        data: url.includes("uid=")
          ? [{ badgeId: "first-post", earnedAt: "2026-01-01" }]
          : [{ id: "first-post", target: 1 }],
      }),
    }));
    expect(await computeBadgeProgress("uid", inputs)).toMatchObject([
      { current: 1, unlocked: true, earnedAt: "2026-01-01" },
    ]);
    expect(
      fetcher.mock.calls.every((c) => !c[1].method || c[1].method === "GET"),
    ).toBe(true);
  });
});
