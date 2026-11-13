/**
 * Server-only identity orchestration — unit tests (Phase 2B.3).
 *
 * These cover the layer that joins "who is signed in" to "what is in Neon":
 * the authorization decisions and the reason-to-status mapping. Both
 * collaborators are mocked, so this proves the *policy*, not the SQL (which the
 * local-PostgreSQL suite covers) and not Neon (which is unverified, see §3 of
 * the phase document).
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

const { ensureProfileForCurrentUser, claimUsernameForCurrentUser, isIdentityFailure } = await import(
  "@/server/features/identity"
);

const UID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  getServerSession.mockReset();
  isDatabaseConfigured.mockReset();
  getDatabase.mockReset();
});

describe("ensureProfileForCurrentUser", () => {
  it("is unauthenticated when there is no verified session", async () => {
    getServerSession.mockResolvedValue(null);

    const result = await ensureProfileForCurrentUser();

    expect(isIdentityFailure(result)).toBe(true);
    if (isIdentityFailure(result)) expect(result.reason).toBe("unauthenticated");
    // The database must not even be looked up for an anonymous request.
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("reports database_not_configured rather than unauthenticated", async () => {
    // The distinction prevents a login loop: the user *is* signed in, but the
    // infrastructure is missing. Telling them to log in again would not help.
    getServerSession.mockResolvedValue({ uid: UID, email: "a@b.c", emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(false);

    const result = await ensureProfileForCurrentUser();

    expect(isIdentityFailure(result)).toBe(true);
    if (isIdentityFailure(result)) expect(result.reason).toBe("database_not_configured");
  });

  it("rejects a session whose uid is not a uuid", async () => {
    getServerSession.mockResolvedValue({ uid: "not-a-uuid", email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);

    const result = await ensureProfileForCurrentUser();

    expect(isIdentityFailure(result)).toBe(true);
    if (isIdentityFailure(result)) expect(result.reason).toBe("invalid_identity");
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("provisions using the session uid and nothing else", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: "a@b.c", emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);

    const execute = vi.fn(async () => ({ rows: [{ uid: UID, username: "user_111111" }] }));
    const transaction = vi.fn();
    getDatabase.mockReturnValue({ execute, transaction });

    const result = await ensureProfileForCurrentUser();

    expect(isIdentityFailure(result)).toBe(false);
    if (!isIdentityFailure(result)) {
      expect(result.profile.uid).toBe(UID);
      expect(result.profile.created).toBe(true);
      // The session is handed back so callers do not re-read it.
      expect(result.session.uid).toBe(UID);
    }
  });

  it("surfaces an unexpected driver failure as database_error, not a stack", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue({
      execute: vi.fn(async () => {
        throw new Error("postgres://user:hunter2@host/db unreachable");
      }),
      transaction: vi.fn(),
    });

    const result = await ensureProfileForCurrentUser();

    expect(isIdentityFailure(result)).toBe(true);
    if (isIdentityFailure(result)) expect(result.reason).toBe("database_error");
    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(JSON.stringify(result)).not.toContain("postgres://");
  });
});

describe("claimUsernameForCurrentUser", () => {
  /** Minimal fake that satisfies the claim transaction contract. */
  function claimDb(responses: Array<{ rows: unknown[] }>) {
    let i = 0;
    return {
      execute: vi.fn(async () => responses[i++] ?? { rows: [] }),
      transaction: async <T,>(run: (tx: { execute: () => Promise<unknown> }) => Promise<T>) =>
        run({ execute: async () => responses[i++] ?? { rows: [] } }),
    };
  }

  it("has no uid parameter: claiming for another account is unexpressible", () => {
    // The arity is the security property, so assert it directly.
    expect(claimUsernameForCurrentUser.length).toBe(1);
  });

  it("is unauthenticated without a session", async () => {
    getServerSession.mockResolvedValue(null);

    const result = await claimUsernameForCurrentUser("ada");

    expect(isIdentityFailure(result)).toBe(true);
    if (isIdentityFailure(result)) expect(result.reason).toBe("unauthenticated");
  });

  it("claims for the session user", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(
      claimDb([
        { rows: [{ username: "user_111111" }] }, // profile read
        { rows: [] }, // release old
        { rows: [{ username: "ada" }] }, // claim won
        { rows: [] }, // profile update
      ]),
    );

    const result = await claimUsernameForCurrentUser("Ada");

    expect(isIdentityFailure(result)).toBe(false);
    if (!isIdentityFailure(result)) {
      expect(result.outcome).toEqual({ status: "claimed", username: "ada" });
      expect(result.session.uid).toBe(UID);
    }
  });

  it("returns typed `taken` rather than a thrown error", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);
    getDatabase.mockReturnValue(
      claimDb([
        { rows: [{ username: "user_111111" }] },
        { rows: [] },
        { rows: [] }, // conflict
      ]),
    );

    const result = await claimUsernameForCurrentUser("taken_one");

    expect(isIdentityFailure(result)).toBe(false);
    if (!isIdentityFailure(result)) expect(result.outcome.status).toBe("taken");
  });

  it("returns `invalid` without a database when the handle is malformed", async () => {
    getServerSession.mockResolvedValue({ uid: UID, email: null, emailConfirmedAt: null });
    isDatabaseConfigured.mockReturnValue(true);

    const result = await claimUsernameForCurrentUser("no!");

    expect(isIdentityFailure(result)).toBe(false);
    if (!isIdentityFailure(result)) expect(result.outcome.status).toBe("invalid");
    expect(getDatabase).not.toHaveBeenCalled();
  });
});
