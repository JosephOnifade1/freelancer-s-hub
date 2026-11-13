// @vitest-environment node
/**
 * Phase 1.1 — OAuth callback (Step 4).
 *
 * Exercises the real route handler with real `NextRequest` objects and a stubbed
 * Supabase (`exchangeCodeForSession`). No live provider is involved, and this
 * deliberately does NOT claim a successful live OAuth round trip — that needs
 * real credentials and a browser (see the report's verification gaps).
 *
 * What is proven here: the code is exchanged server-side, and every destination
 * goes through the existing `sanitizeReturnPath` contract, so a hostile `next`
 * cannot produce an open redirect.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { oauthCallbackUrl } from "@/lib/oauth";

let exchangeResult: { error: { message: string } | null } = { error: null };
let exchangedCodes: string[] = [];
let serverClientAvailable = true;

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseServerClient: async () =>
    serverClientAvailable
      ? {
          auth: {
            exchangeCodeForSession: async (code: string) => {
              exchangedCodes.push(code);
              return { data: {}, ...exchangeResult };
            },
          },
        }
      : null,
}));

async function callback(query: string) {
  const { GET } = await import("@/app/auth/callback/route");
  const request = new NextRequest(new URL(`http://localhost/auth/callback${query}`));
  return GET(request);
}

function locationOf(response: Response) {
  return response.headers.get("location");
}

beforeEach(() => {
  exchangeResult = { error: null };
  exchangedCodes = [];
  serverClientAvailable = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("callback — code exchange", () => {
  it("exchanges the code and forwards to a valid internal destination", async () => {
    const response = await callback("?code=abc123&next=%2Fpipeline");
    expect(exchangedCodes).toEqual(["abc123"]);
    expect(response.status).toBe(307);
    expect(locationOf(response)).toBe("http://localhost/pipeline");
  });

  it("exchanges the code exactly once", async () => {
    await callback("?code=abc123");
    expect(exchangedCodes).toHaveLength(1);
  });

  it("falls back to / when no destination is supplied", async () => {
    const response = await callback("?code=abc123");
    expect(locationOf(response)).toBe("http://localhost/");
  });
});

describe("callback — destination validation (open-redirect protection)", () => {
  const hostile = [
    ["https://evil.example", "absolute URL"],
    ["//evil.example", "protocol-relative"],
    ["/\\evil.example", "backslash"],
    ["javascript:alert(1)", "script scheme"],
    ["/%2F%2Fevil.example", "encoded protocol-relative"],
    ["/login", "auth loop"],
    ["/signup", "auth loop"],
  ] as const;

  for (const [next, label] of hostile) {
    it(`rejects ${label} and falls back to /`, async () => {
      const response = await callback(`?code=abc123&next=${encodeURIComponent(next)}`);
      expect(locationOf(response)).toBe("http://localhost/");
    });
  }

  it("keeps a valid nested internal destination", async () => {
    const response = await callback("?code=abc123&next=%2Fb%2Fdesign%2Fp%2F42");
    expect(locationOf(response)).toBe("http://localhost/b/design/p/42");
  });

  it("keeps a query string on the destination", async () => {
    const response = await callback(`?code=abc123&next=${encodeURIComponent("/l?type=contract")}`);
    expect(locationOf(response)).toBe("http://localhost/l?type=contract");
  });
});

describe("callback — failure and missing parameters", () => {
  it("redirects to /login when the code is missing (no exchange attempted)", async () => {
    const response = await callback("");
    expect(exchangedCodes).toEqual([]);
    expect(locationOf(response)).toContain("/login?");
    expect(locationOf(response)).toContain("auth_error=missing_code");
  });

  it("never leaves the origin when the code is missing", async () => {
    const response = await callback("?next=https%3A%2F%2Fevil.example");
    expect(locationOf(response)).toMatch(/^http:\/\/localhost\/login\?/);
  });

  it("reports a failed exchange without looping", async () => {
    exchangeResult = { error: { message: "invalid grant" } };
    const response = await callback("?code=bad");
    expect(locationOf(response)).toContain("/login?");
    expect(locationOf(response)).toContain("auth_error=exchange_failed");
  });

  it("preserves the destination when the exchange fails", async () => {
    exchangeResult = { error: { message: "invalid grant" } };
    const response = await callback("?next=%2Fsettings&code=bad");
    expect(locationOf(response)).toContain("from=%2Fsettings");
  });

  it("redirects to /login when Supabase is unconfigured (demo mode)", async () => {
    serverClientAvailable = false;
    const response = await callback("?code=abc123");
    expect(locationOf(response)).toContain("auth_error=unconfigured");
  });
});

describe("oauthCallbackUrl — provider redirect target", () => {
  it("targets the server-side callback, not the destination page", () => {
    expect(oauthCallbackUrl("http://localhost", "/pipeline")).toBe(
      "http://localhost/auth/callback?next=%2Fpipeline",
    );
  });

  it("omits `next` for the default destination", () => {
    expect(oauthCallbackUrl("http://localhost", "/")).toBe("http://localhost/auth/callback");
  });

  it("sanitises the destination before it ever reaches the URL", () => {
    expect(oauthCallbackUrl("http://localhost", "https://evil.example")).toBe(
      "http://localhost/auth/callback",
    );
    expect(oauthCallbackUrl("http://localhost", "//evil.example")).toBe(
      "http://localhost/auth/callback",
    );
  });
});
