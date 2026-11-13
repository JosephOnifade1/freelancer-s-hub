/**
 * Content server services — unit tests (Phase 2D).
 *
 * **Mocked.** The session, the database and the Supabase community client are stubs,
 * so this file proves **authorization policy**: that the viewer's identity and role
 * come from the server, that a failed permission lookup refuses rather than narrowing,
 * and that the moderation previews are staff-gated.
 *
 * It proves nothing about SQL. The predicates and transactions are covered against
 * real PostgreSQL in `content-integration.test.ts`, and the routes in
 * `content-routes.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
const isDatabaseConfigured = vi.fn();
const getDatabase = vi.fn();
const execute = vi.fn();

const communitySelect = vi.fn();
const createSupabaseServerClient = vi.fn();

vi.mock("@/lib/server-session", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/server/db", () => ({
  isDatabaseConfigured: () => isDatabaseConfigured(),
  getDatabase: () => getDatabase(),
}));
vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClient(),
}));

const { resolveViewer, getContentPreviews, isContentFailure } = await import(
  "@/server/features/content"
);

const UID = "11111111-1111-4111-8111-111111111111";

/** A Supabase stub whose two selects answer with the given rows. */
function supabaseStub(members: string[], owned: string[]) {
  communitySelect.mockImplementation((columns: string) => ({
    eq: () => ({
      // `communitySlug` for membership, `slug` for ownership — the shape the caller
      // passes decides which list comes back.
      then: (resolve: (value: unknown) => void) =>
        resolve({
          data: columns === "communitySlug" ? members.map((communitySlug) => ({ communitySlug })) : owned.map((slug) => ({ slug })),
          error: null,
        }),
    }),
  }));
  return { from: () => ({ select: communitySelect }) };
}

beforeEach(() => {
  getServerSession.mockReset();
  isDatabaseConfigured.mockReset();
  getDatabase.mockReset();
  execute.mockReset();
  communitySelect.mockReset();
  createSupabaseServerClient.mockReset();
  getDatabase.mockReturnValue({ execute });
  isDatabaseConfigured.mockReturnValue(true);
});

describe("viewer resolution", () => {
  it("returns an anonymous viewer with no session, and never touches the database", async () => {
    getServerSession.mockResolvedValue(null);

    const viewer = await resolveViewer();

    expect(viewer).toEqual({ uid: null, role: "member", memberSlugs: [], ownedSlugs: [] });
    expect(getDatabase).not.toHaveBeenCalled();
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("reads the role from Neon and the community facts from Supabase", async () => {
    getServerSession.mockResolvedValue({ uid: UID });
    execute.mockResolvedValue({ rows: [{ role: "moderator" }] });
    createSupabaseServerClient.mockResolvedValue(supabaseStub(["writers"], ["designers"]));

    const viewer = await resolveViewer();

    expect(viewer.uid).toBe(UID);
    expect(viewer.role).toBe("moderator");
    expect(viewer.memberSlugs).toEqual(["writers"]);
    expect(viewer.ownedSlugs).toEqual(["designers"]);
  });

  it("treats a not-yet-provisioned user as a member with no communities", async () => {
    // Signing in before the profile row exists must not fail every content read. Such
    // a user has no community facts anyway, so this is the signed-out view of the
    // world plus an identity.
    getServerSession.mockResolvedValue({ uid: UID });
    execute.mockResolvedValue({ rows: [] });
    createSupabaseServerClient.mockResolvedValue(supabaseStub([], []));

    const viewer = await resolveViewer();
    expect(viewer).toEqual({ uid: UID, role: "member", memberSlugs: [], ownedSlugs: [] });
  });

  it("throws rather than defaulting when the community lookup fails", async () => {
    // `memberSlugs: []` is a valid answer (in no communities) and must not be confused
    // with "we could not find out" — silently narrowing visibility would hide posts
    // the user is entitled to see.
    getServerSession.mockResolvedValue({ uid: UID });
    execute.mockResolvedValue({ rows: [{ role: "member" }] });
    createSupabaseServerClient.mockResolvedValue({
      from: () => ({ select: () => ({ eq: () => ({ then: (r: (v: unknown) => void) => r({ data: null, error: { message: "boom" } }) }) }) }),
    });

    await expect(resolveViewer()).rejects.toThrow("Could not load your permissions.");
  });

  it("throws rather than demoting when the community client is unavailable", async () => {
    getServerSession.mockResolvedValue({ uid: UID });
    execute.mockResolvedValue({ rows: [{ role: "admin" }] });
    createSupabaseServerClient.mockResolvedValue(null);

    await expect(resolveViewer()).rejects.toThrow("Could not load your permissions.");
  });
});

describe("moderation previews are staff-gated", () => {
  it("refuses without a session", async () => {
    getServerSession.mockResolvedValue(null);

    const result = await getContentPreviews(["post-1"], []);
    expect(isContentFailure(result)).toBe(true);
    if (isContentFailure(result)) expect(result.reason).toBe("unauthenticated");
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a member", async () => {
    getServerSession.mockResolvedValue({ uid: UID });
    execute.mockResolvedValue({ rows: [{ role: "member" }] });
    createSupabaseServerClient.mockResolvedValue(supabaseStub([], []));

    const result = await getContentPreviews(["post-1"], []);
    expect(isContentFailure(result)).toBe(true);
    if (isContentFailure(result)) expect(result.reason).toBe("forbidden");
  });

  it("allows a moderator", async () => {
    getServerSession.mockResolvedValue({ uid: UID });
    // Role read, then the two preview queries.
    execute
      .mockResolvedValueOnce({ rows: [{ role: "moderator" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    createSupabaseServerClient.mockResolvedValue(supabaseStub([], []));

    const result = await getContentPreviews([], []);
    expect(isContentFailure(result)).toBe(false);
  });

  it("allows an admin", async () => {
    getServerSession.mockResolvedValue({ uid: UID });
    execute
      .mockResolvedValueOnce({ rows: [{ role: "admin" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    createSupabaseServerClient.mockResolvedValue(supabaseStub([], []));

    const result = await getContentPreviews([], []);
    expect(isContentFailure(result)).toBe(false);
  });

  it("reports an unconfigured database before touching it", async () => {
    isDatabaseConfigured.mockReturnValue(false);

    const result = await getContentPreviews([], []);
    expect(isContentFailure(result)).toBe(true);
    if (isContentFailure(result)) expect(result.reason).toBe("database_not_configured");
    expect(getDatabase).not.toHaveBeenCalled();
  });
});

describe("write services take no target identity", () => {
  it("createPostForCurrentUser accepts exactly one argument", async () => {
    const { createPostForCurrentUser } = await import("@/server/features/content");
    // The arity *is* the security property: there is no author parameter to forge.
    expect(createPostForCurrentUser.length).toBe(1);
  });

  it("castVoteForCurrentUser takes entity and value but no voter", async () => {
    const { castVoteForCurrentUser } = await import("@/server/features/content");
    expect(castVoteForCurrentUser.length).toBe(3); // (entityType, entityId, voteValue)
  });

  it("getSavedPostIds takes no uid at all", async () => {
    const { getSavedPostIds } = await import("@/server/features/content");
    expect(getSavedPostIds.length).toBe(0);
  });

  it("createCommentForCurrentUser takes the post and body, not an author", async () => {
    const { createCommentForCurrentUser } = await import("@/server/features/content");
    expect(createCommentForCurrentUser.length).toBe(2); // (postId, input)
  });
});

describe("unauthenticated writes short-circuit before the database", () => {
  it("refuses a post with no session", async () => {
    getServerSession.mockResolvedValue(null);
    const { createPostForCurrentUser } = await import("@/server/features/content");

    const result = await createPostForCurrentUser({ title: "t", body: "b" });
    expect(isContentFailure(result)).toBe(true);
    if (isContentFailure(result)) expect(result.reason).toBe("unauthenticated");
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a vote with no session", async () => {
    getServerSession.mockResolvedValue(null);
    const { castVoteForCurrentUser } = await import("@/server/features/content");

    const result = await castVoteForCurrentUser("post", "22222222-2222-4222-8222-222222222222", 1);
    expect(isContentFailure(result)).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a bookmark toggle with no session", async () => {
    getServerSession.mockResolvedValue(null);
    const { toggleSavedPostForCurrentUser } = await import("@/server/features/content");

    const result = await toggleSavedPostForCurrentUser("22222222-2222-4222-8222-222222222222");
    expect(isContentFailure(result)).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("role and verification services pass the actor from the session", () => {
  it("setUserRoleByCurrentUser takes the target, and the actor comes from the session", async () => {
    getServerSession.mockResolvedValue({ uid: UID });
    execute
      .mockResolvedValueOnce({ rows: [{ role: "admin" }] }) // resolveViewer's role read
      .mockResolvedValueOnce({ rows: [{ role: "admin" }] }) // setUserRole's actor check
      .mockResolvedValueOnce({ rows: [{ uid: "target" }] }); // the update
    createSupabaseServerClient.mockResolvedValue(supabaseStub([], []));

    const { setUserRoleByCurrentUser } = await import("@/server/features/content");
    const result = await setUserRoleByCurrentUser("22222222-2222-4222-8222-222222222222", "moderator");

    expect(isContentFailure(result)).toBe(false);
    // The signature cannot express "act as somebody else": 2 parameters, target + role.
    expect(setUserRoleByCurrentUser.length).toBe(2);
  });
});
