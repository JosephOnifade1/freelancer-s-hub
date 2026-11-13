/**
 * Profile server services — unit tests (Phase 2C).
 *
 * Mocks the session and the database, so these prove **authorization policy**: that the
 * uid always comes from the verified session, that writes cannot name a target, and that
 * the moderation gate refuses non-staff. The SQL itself is covered by
 * `profile-queries.test.ts` (fake DB) and `profile-integration.test.ts` (local PG).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getServerSession = vi.fn();
const isDatabaseConfigured = vi.fn();
const getDatabase = vi.fn();

vi.mock("@/lib/server-session", () => ({ getServerSession: () => getServerSession() }));
vi.mock("@/server/db", () => ({
  isDatabaseConfigured: () => isDatabaseConfigured(),
  getDatabase: () => getDatabase(),
}));

const {
  checkUsernameAvailability,
  getCurrentProfile,
  getModerationProfiles,
  getPublicProfile,
  getPublicProfiles,
  isOwnProfileFailure,
  isProfileFailure,
  isMutationFailure,
  markVeteranCelebrationSeen,
  searchPublicProfiles,
  setCurrentAvatar,
  updateCurrentProfile,
} = await import("@/server/features/profile");

const UID = "11111111-1111-4111-8111-111111111111";

function row(overrides: Record<string, unknown> = {}) {
  return {
    uid: UID,
    username: "ada",
    displayName: "Ada",
    initial: "A",
    bio: "",
    location: "",
    website: "",
    status: "Available",
    skills: [],
    reputation: 0,
    followers: 0,
    following: 0,
    avatarUrl: null,
    isVerifiedPro: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    role: "member",
    hasSeenVeteranCelebration: false,
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A fake database answering successive `execute` calls from a script. */
function dbStub(responses: unknown[][]) {
  let index = 0;
  return { execute: vi.fn(async () => ({ rows: responses[index++] ?? [] })) };
}

beforeEach(() => {
  getServerSession.mockReset();
  isDatabaseConfigured.mockReset();
  getDatabase.mockReset();
});

describe("identity boundary", () => {
  it("reads use the session uid, never a caller-supplied one", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: "a@b.c", emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    const db = dbStub([[row()]]);
    getDatabase.mockReturnValue(db);

    const result = await getCurrentProfile();

    expect(isOwnProfileFailure(result)).toBe(false);
    // The query is bound to the session's uid.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstCall = (db.execute.mock.calls as any[])[0];
    const statement = String((firstCall[0] as { queryChunks?: unknown[] }).queryChunks);
    expect(statement).toContain(UID);
  });

  it("is unauthenticated without a session, and does not touch the database", async () => {
    getServerSession.mockResolvedValue(null);

    const result = await getCurrentProfile();

    expect(isOwnProfileFailure(result)).toBe(true);
    if (isOwnProfileFailure(result)) expect(result.reason).toBe("unauthenticated");
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("distinguishes an unconfigured database from a missing session", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(false);

    const result = await getCurrentProfile();

    expect(isOwnProfileFailure(result)).toBe(true);
    if (isOwnProfileFailure(result)) expect(result.reason).toBe("database_not_configured");
  });

  it("reports a missing profile row as invalid_identity, not an error", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[]]));

    const result = await getCurrentProfile();

    expect(isOwnProfileFailure(result)).toBe(true);
    if (isOwnProfileFailure(result)) expect(result.reason).toBe("invalid_identity");
  });
});

describe("write functions take no target", () => {
  it("updateCurrentProfile accepts exactly one argument", () => {
    // The arity *is* the security property: there is no uid parameter to forge.
    expect(updateCurrentProfile.length).toBe(1);
  });

  it("setCurrentAvatar accepts exactly one argument", () => {
    expect(setCurrentAvatar.length).toBe(1);
  });

  it.each(["setCurrentReputation","adjustCurrentFollowing"])("does not expose competing writer %s",async name=>{expect(await import("@/server/features/profile")).not.toHaveProperty(name);});

  it("markVeteranCelebrationSeen accepts none", () => {
    expect(markVeteranCelebrationSeen.length).toBe(0);
  });

  it("the browser client never puts a uid in a request body", async () => {
    // Guards against a future edit that "helpfully" adds one. Only `body:` payloads
    // matter — `uid` legitimately appears in response *types*.
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/lib/profile-client.ts", "utf8"),
    );
    const bodies = source.match(/JSON\.stringify\([^)]*\)/g) ?? [];
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toMatch(/uid/i);
    }
  });
});

describe("updates", () => {
  it("updates the caller's own row", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[row({ bio: "new" })]]));

    const result = await updateCurrentProfile({ bio: "new" });

    expect(isMutationFailure(result)).toBe(false);
    if (!isMutationFailure(result)) expect(result.outcome.status).toBe("updated");
  });

  it("reports profile_missing when provisioning has not landed", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[]]));

    const result = await updateCurrentProfile({ bio: "new" });

    expect(isMutationFailure(result)).toBe(false);
    if (!isMutationFailure(result)) expect(result.outcome.status).toBe("profile_missing");
  });

  it("surfaces a driver failure as a typed status, not a throw", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue({
      execute: async () => {
        throw new Error("postgres://u:p@host/db");
      },
    });

    const result = await updateCurrentProfile({ bio: "new" });
    expect(JSON.stringify(result)).not.toContain("postgres://");
  });
});

describe("public reads", () => {
  it("do not require a session", async () => {
    // A profile page is public; AuthGate handles the private pages.
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[row()]]));

    const result = await getPublicProfile("ada");

    expect(isProfileFailure(result)).toBe(false);
    expect(getServerSession).not.toHaveBeenCalled();
  });

  it("batch reads return a list", async () => {
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[row()]]));

    const result = await getPublicProfiles([UID]);
    expect(isProfileFailure(result)).toBe(false);
    if (!isProfileFailure(result)) expect(result.data).toHaveLength(1);
  });

  it("handle availability needs no session", async () => {
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[{ taken: false }]]));

    const result = await checkUsernameAvailability("ada");
    expect(isProfileFailure(result)).toBe(false);
    if (!isProfileFailure(result)) expect(result.data).toBe(true);
  });

  it("search needs no session", async () => {
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[row()]]));

    const result = await searchPublicProfiles("ada");
    expect(isProfileFailure(result)).toBe(false);
  });

  it("report database_not_configured rather than throwing", async () => {
    isDatabaseConfigured.mockReturnValue(false);
    const result = await getPublicProfile("ada");

    expect(isProfileFailure(result)).toBe(true);
    if (isProfileFailure(result)) expect(result.reason).toBe("database_not_configured");
  });
});

describe("moderation gate", () => {
  const session = { uid: UID, email: null, emailConfirmedAt: null };

  it("refuses a member", async () => {
    getServerSession.mockResolvedValue(session);
    isDatabaseConfigured.mockReturnValue(true);
    // First call: own profile (role member). A second call should never happen.
    getDatabase.mockReturnValue(dbStub([[row({ role: "member" })]]));

    const result = await getModerationProfiles(10);

    expect(isProfileFailure(result)).toBe(true);
    if (isProfileFailure(result)) expect(result.reason).toBe("invalid_identity");
  });

  it("allows a moderator", async () => {
    getServerSession.mockResolvedValue(session);
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(
      dbStub([[row({ role: "moderator" })], [{ uid: UID, username: "ada", role: "moderator" }]]),
    );

    const result = await getModerationProfiles(10);
    expect(isProfileFailure(result)).toBe(false);
  });

  it("allows an admin", async () => {
    getServerSession.mockResolvedValue(session);
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(
      dbStub([[row({ role: "admin" })], [{ uid: UID, username: "ada", role: "admin" }]]),
    );

    const result = await getModerationProfiles(10);
    expect(isProfileFailure(result)).toBe(false);
  });

  it("refuses without a session", async () => {
    getServerSession.mockResolvedValue(null);

    const result = await getModerationProfiles(10);

    expect(isProfileFailure(result)).toBe(true);
    if (isProfileFailure(result)) expect(result.reason).toBe("unauthenticated");
  });

  it("refuses a session with no profile row", async () => {
    getServerSession.mockResolvedValue(session);
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(dbStub([[]]));

    const result = await getModerationProfiles(10);
    expect(isProfileFailure(result)).toBe(true);
  });
});
