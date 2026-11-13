/**
 * Profile API routes — unit tests (Phase 2C).
 *
 * Calls the route handlers directly with mocked services, so these pin the HTTP
 * contract: status codes, the whitelisting of request bodies, and that no route
 * accepts a uid from the caller. No server is started and no database is touched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const getCurrentProfile = vi.fn();
const updateCurrentProfile = vi.fn();
const getPublicProfile = vi.fn();
const getPublicProfiles = vi.fn();
const getTopPublicProfiles = vi.fn();
const searchPublicProfiles = vi.fn();
const checkUsernameAvailability = vi.fn();
const setCurrentAvatar = vi.fn();
const setCurrentReputation = vi.fn();
const adjustCurrentFollowing = vi.fn();
const getModerationProfiles = vi.fn();

// The guard is the real one; only the services are replaced.
vi.mock("@/server/features/profile", async () => {
  const actual = await vi.importActual<typeof import("@/server/features/profile")>(
    "@/server/features/profile",
  );
  return {
    ...actual,
    getCurrentProfile: () => getCurrentProfile(),
    updateCurrentProfile: (f: unknown) => updateCurrentProfile(f),
    getPublicProfile: (id: string) => getPublicProfile(id),
    getPublicProfiles: (u: string[]) => getPublicProfiles(u),
    getTopPublicProfiles: (l: number) => getTopPublicProfiles(l),
    searchPublicProfiles: (t: string) => searchPublicProfiles(t),
    checkUsernameAvailability: (u: string) => checkUsernameAvailability(u),
    setCurrentAvatar: (u: string) => setCurrentAvatar(u),
    setCurrentReputation: (t: number) => setCurrentReputation(t),
    adjustCurrentFollowing: (d: number) => adjustCurrentFollowing(d),
    getModerationProfiles: (l: number) => getModerationProfiles(l),
  };
});

const profile = {
  uid: "11111111-1111-4111-8111-111111111111",
  username: "ada",
  displayName: "Ada",
  role: "member",
};

function post(url: string, body?: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function patch(url: string, body?: unknown) {
  return new Request(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  [
    getCurrentProfile,
    updateCurrentProfile,
    getPublicProfile,
    getPublicProfiles,
    getTopPublicProfiles,
    searchPublicProfiles,
    checkUsernameAvailability,
    setCurrentAvatar,
    setCurrentReputation,
    adjustCurrentFollowing,
    getModerationProfiles,
  ].forEach((fn) => fn.mockReset());
});

describe("GET /api/profile/me", () => {
  it("returns the profile on success", async () => {
    getCurrentProfile.mockResolvedValue({ ok: true, profile });
    const { GET } = await import("@/app/api/profile/me/route");

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ profile: { username: "ada" } });
  });

  it("maps a missing row to 404, not 500", async () => {
    getCurrentProfile.mockResolvedValue({ ok: false, reason: "invalid_identity" });
    const { GET } = await import("@/app/api/profile/me/route");

    const response = await GET();
    // The client shows the provisioning notice for this, not an error page.
    expect(response.status).toBe(404);
  });

  it("maps no session to 401", async () => {
    getCurrentProfile.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const { GET } = await import("@/app/api/profile/me/route");

    expect((await GET()).status).toBe(401);
  });

  it("maps an unconfigured database to 503", async () => {
    getCurrentProfile.mockResolvedValue({ ok: false, reason: "database_not_configured" });
    const { GET } = await import("@/app/api/profile/me/route");

    expect((await GET()).status).toBe(503);
  });

  it("keeps driver detail out of the body", async () => {
    getCurrentProfile.mockResolvedValue({ ok: false, reason: "database_error" });
    const { GET } = await import("@/app/api/profile/me/route");

    const response = await GET();
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toMatch(/postgres|neon|drizzle|password/i);
  });
});

describe("PATCH /api/profile/me", () => {
  it("passes only whitelisted fields to the update", async () => {
    updateCurrentProfile.mockResolvedValue({ ok: true, outcome: { status: "updated", profile } });
    const { PATCH } = await import("@/app/api/profile/me/route");

    await PATCH(
      patch("http://localhost/api/profile/me", {
        bio: "new bio",
        // Privileged and non-editable keys must be dropped before the service sees them.
        role: "admin",
        isVerifiedPro: true,
        reputation: 999999,
        followers: 5000,
        uid: "22222222-2222-4222-8222-222222222222",
      }),
    );

    const passed = updateCurrentProfile.mock.calls[0][0] as Record<string, unknown>;
    expect(passed).toEqual({ bio: "new bio" });
    expect(passed).not.toHaveProperty("role");
    expect(passed).not.toHaveProperty("isVerifiedPro");
    expect(passed).not.toHaveProperty("reputation");
    expect(passed).not.toHaveProperty("uid");
  });

  it("rejects a body with no editable fields", async () => {
    const { PATCH } = await import("@/app/api/profile/me/route");

    const response = await PATCH(patch("http://localhost/api/profile/me", { role: "admin" }));
    expect(response.status).toBe(400);
    expect(updateCurrentProfile).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const { PATCH } = await import("@/app/api/profile/me/route");

    const response = await PATCH(
      new Request("http://localhost/api/profile/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an array body", async () => {
    const { PATCH } = await import("@/app/api/profile/me/route");

    expect((await PATCH(patch("http://localhost/api/profile/me", [{ bio: "x" }]))).status).toBe(400);
  });

  it("maps profile_missing to 404", async () => {
    updateCurrentProfile.mockResolvedValue({ ok: true, outcome: { status: "profile_missing" } });
    const { PATCH } = await import("@/app/api/profile/me/route");

    expect((await PATCH(patch("http://localhost/api/profile/me", { bio: "x" }))).status).toBe(404);
  });

  it("maps invalid fields to 400", async () => {
    updateCurrentProfile.mockResolvedValue({ ok: true, outcome: { status: "invalid" } });
    const { PATCH } = await import("@/app/api/profile/me/route");

    expect((await PATCH(patch("http://localhost/api/profile/me", { bio: "x" }))).status).toBe(400);
  });

  it("maps a driver failure to 500 without detail", async () => {
    updateCurrentProfile.mockResolvedValue({ ok: true, outcome: { status: "failed" } });
    const { PATCH } = await import("@/app/api/profile/me/route");

    const response = await PATCH(patch("http://localhost/api/profile/me", { bio: "x" }));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/postgres|neon|drizzle/i);
  });
});

describe("GET /api/profiles/[identifier]", () => {
  async function call(identifier: string) {
    const { GET } = await import("@/app/api/profiles/[identifier]/route");
    return GET(new Request(`http://localhost/api/profiles/${identifier}`), {
      params: Promise.resolve({ identifier }),
    });
  }

  it("returns a public profile", async () => {
    getPublicProfile.mockResolvedValue({ ok: true, data: profile });

    const response = await call("ada");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ profile: { username: "ada" } });
  });

  it("passes the identifier through", async () => {
    getPublicProfile.mockResolvedValue({ ok: true, data: profile });
    await call("ada");
    expect(getPublicProfile).toHaveBeenCalledWith("ada");
  });

  it("maps not-found to 404", async () => {
    getPublicProfile.mockResolvedValue({ ok: true, data: null });
    expect((await call("ghost")).status).toBe(404);
  });

  it("maps an empty identifier to 400", async () => {
    expect((await call("%20")).status).toBe(400);
    expect(getPublicProfile).not.toHaveBeenCalled();
  });
});

describe("GET /api/profiles/lookup", () => {
  async function call(query: string) {
    const { GET } = await import("@/app/api/profiles/lookup/route");
    return GET(new Request(`http://localhost/api/profiles/lookup?${query}`));
  }

  it("batch-reads by uids", async () => {
    getPublicProfiles.mockResolvedValue({ ok: true, data: [profile] });

    const response = await call("uids=a,b");
    expect(response.status).toBe(200);
    expect(getPublicProfiles).toHaveBeenCalledWith(["a", "b"]);
  });

  it("caps the uid list", async () => {
    getPublicProfiles.mockResolvedValue({ ok: true, data: [] });
    const many = Array.from({ length: 500 }, (_, i) => `u${i}`).join(",");

    await call(`uids=${many}`);
    expect((getPublicProfiles.mock.calls[0][0] as string[]).length).toBe(100);
  });

  it("answers a handle-availability query", async () => {
    checkUsernameAvailability.mockResolvedValue({ ok: true, data: true });

    const response = await call("available=ada");
    expect(await response.json()).toEqual({ available: true });
  });

  it("answers a leaderboard query", async () => {
    getTopPublicProfiles.mockResolvedValue({ ok: true, data: [profile] });

    await call("top=5");
    expect(getTopPublicProfiles).toHaveBeenCalledWith(5);
  });

  it("answers a search query", async () => {
    searchPublicProfiles.mockResolvedValue({ ok: true, data: [profile] });

    await call("q=ada");
    expect(searchPublicProfiles).toHaveBeenCalledWith("ada");
  });

  it("rejects a request with no query", async () => {
    expect((await call("")).status).toBe(400);
  });

  it("maps database_not_configured to 503", async () => {
    getPublicProfiles.mockResolvedValue({ ok: false, reason: "database_not_configured" });

    expect((await call("uids=a")).status).toBe(503);
  });
});

describe("POST /api/profile/avatar", () => {
  it("accepts a url and returns the updated profile", async () => {
    setCurrentAvatar.mockResolvedValue({ ok: true, outcome: { status: "updated", profile } });
    const { POST } = await import("@/app/api/profile/avatar/route");

    const response = await POST(post("http://localhost/api/profile/avatar", { url: "https://x/a.png" }));
    expect(response.status).toBe(200);
    expect(setCurrentAvatar).toHaveBeenCalledWith("https://x/a.png");
  });

  it("ignores any uid in the body", async () => {
    setCurrentAvatar.mockResolvedValue({ ok: true, outcome: { status: "updated", profile } });
    const { POST } = await import("@/app/api/profile/avatar/route");

    await POST(
      post("http://localhost/api/profile/avatar", {
        url: "https://x/a.png",
        uid: "22222222-2222-4222-8222-222222222222",
      }),
    );

    // Exactly one argument: the url. There is no parameter to receive a uid.
    expect(setCurrentAvatar.mock.calls[0]).toEqual(["https://x/a.png"]);
  });

  it("rejects a missing url", async () => {
    const { POST } = await import("@/app/api/profile/avatar/route");

    expect((await POST(post("http://localhost/api/profile/avatar", {}))).status).toBe(400);
  });

  it("maps a rejected url to 400", async () => {
    setCurrentAvatar.mockResolvedValue({ ok: true, outcome: { status: "invalid" } });
    const { POST } = await import("@/app/api/profile/avatar/route");

    expect(
      (await POST(post("http://localhost/api/profile/avatar", { url: "javascript:alert(1)" }))).status,
    ).toBe(400);
  });

  it("maps unauthenticated to 401", async () => {
    setCurrentAvatar.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const { POST } = await import("@/app/api/profile/avatar/route");

    expect((await POST(post("http://localhost/api/profile/avatar", { url: "https://x/a.png" }))).status).toBe(401);
  });
});

describe("POST /api/profile/reputation", () => {
  it("writes a total for the caller", async () => {
    setCurrentReputation.mockResolvedValue({ ok: true, outcome: { status: "updated" } });
    const { POST } = await import("@/app/api/profile/reputation/route");

    const response = await POST(post("http://localhost/api/profile/reputation", { total: 42 }));
    expect(response.status).toBe(200);
    expect(setCurrentReputation).toHaveBeenCalledWith(42);
  });

  it("rejects a non-numeric total", async () => {
    const { POST } = await import("@/app/api/profile/reputation/route");

    expect((await POST(post("http://localhost/api/profile/reputation", { total: "42" }))).status).toBe(400);
    expect(setCurrentReputation).not.toHaveBeenCalled();
  });

  it("maps an invalid total to 400", async () => {
    setCurrentReputation.mockResolvedValue({ ok: true, outcome: { status: "invalid" } });
    const { POST } = await import("@/app/api/profile/reputation/route");

    expect((await POST(post("http://localhost/api/profile/reputation", { total: -5 }))).status).toBe(400);
  });
});

describe("POST /api/profile/following-counter", () => {
  it("accepts +1 and -1", async () => {
    adjustCurrentFollowing.mockResolvedValue({ ok: true, outcome: { status: "updated" } });
    const { POST } = await import("@/app/api/profile/following-counter/route");

    expect((await POST(post("http://localhost/x", { delta: 1 }))).status).toBe(200);
    expect((await POST(post("http://localhost/x", { delta: -1 }))).status).toBe(200);
  });

  it("rejects any other delta", async () => {
    const { POST } = await import("@/app/api/profile/following-counter/route");

    for (const delta of [0, 2, -2, "1", null]) {
      expect((await POST(post("http://localhost/x", { delta }))).status).toBe(400);
    }
    expect(adjustCurrentFollowing).not.toHaveBeenCalled();
  });
});

describe("GET /api/profiles/moderation", () => {
  it("returns users for staff", async () => {
    getModerationProfiles.mockResolvedValue({ ok: true, data: [{ uid: "u", role: "admin" }] });
    const { GET } = await import("@/app/api/profiles/moderation/route");

    const response = await GET(new Request("http://localhost/api/profiles/moderation"));
    expect(response.status).toBe(200);
  });

  it("returns 403 for a non-staff caller", async () => {
    getModerationProfiles.mockResolvedValue({ ok: false, reason: "invalid_identity" });
    const { GET } = await import("@/app/api/profiles/moderation/route");

    // Deliberately not distinguished from "no profile", so an outsider cannot probe.
    expect((await GET(new Request("http://localhost/api/profiles/moderation"))).status).toBe(403);
  });

  it("returns 401 when there is no session at all", async () => {
    getModerationProfiles.mockResolvedValue({ ok: false, reason: "unauthenticated" });
    const { GET } = await import("@/app/api/profiles/moderation/route");

    expect((await GET(new Request("http://localhost/api/profiles/moderation"))).status).toBe(401);
  });
});
