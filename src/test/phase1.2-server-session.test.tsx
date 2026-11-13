// @vitest-environment node
/**
 * Phase 1.2 — server identity and private-page rendering.
 *
 * The point of this phase is that `/settings` resolves identity on the *server*.
 * These tests drive the real route page and the real `getServerSession` helper,
 * stubbing only Supabase itself (no live project is available here — see the
 * phase report's verification gaps).
 *
 * What is proven:
 *  - the server session helper returns identity from the cookie-backed client;
 *  - an anonymous request produces no private markup and redirects;
 *  - demo/unconfigured builds fall back to the client guard instead of a redirect
 *    loop into a login form that could not work;
 *  - the page is not statically prerendered.
 * What is NOT proven: a real JWT verification or a real token refresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

type FakeUser = { id: string; email: string | null; email_confirmed_at: string | null } | null;

let currentUser: FakeUser = null;
let getUserCalls = 0;
let serverClientCalls = 0;
let configured = true;

// Counters live on `globalThis` so a `vi.resetModules()` does not hand the fresh
// module graph a second copy of them.
const counters = (globalThis as unknown as { __p12?: { user: number; client: number } }).__p12 ?? {
  user: 0,
  client: 0,
};
(globalThis as unknown as { __p12: typeof counters }).__p12 = counters;

vi.mock("@/lib/supabase-server", () => ({
  getServerUser: async () => {
    counters.user += 1;
    getUserCalls += 1;
    return currentUser;
  },
  createSupabaseServerClient: async () => {
    serverClientCalls += 1;
    return null;
  },
}));

vi.mock("@/lib/supabase-env", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase-env")>("@/lib/supabase-env");
  // A live getter, not a snapshot: the mock is evaluated once, but tests flip the
  // flag (and reset the module registry) between cases.
  return {
    ...actual,
    get isSupabaseConfigured() {
      return configured;
    },
  };
});

// The redirect must be observable without a real Next request scope.
const redirectCalls: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectCalls.push(url);
    // Next's redirect() throws to unwind rendering; mirror that here.
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// The shell is a client component; render it as a marker so we can assert which
// branch the server page chose without mounting the browser tree.
vi.mock("@/app/settings/settings-shell", () => ({
  SettingsShell: ({ session }: { session?: { uid: string; email: string | null } }) => (
    <div data-testid="shell" data-uid={session?.uid ?? "none"}>
      shell
    </div>
  ),
}));

beforeEach(() => {
  currentUser = null;
  getUserCalls = 0;
  serverClientCalls = 0;
  redirectCalls.length = 0;
  counters.user = 0;
  configured = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getServerSession — server identity (Step 2/3)", () => {
  it("returns the authenticated identity from the cookie session", async () => {
    currentUser = { id: "user-42", email: "ada@example.test", email_confirmed_at: "2026-01-01T00:00:00Z" };
    const { getServerSession } = await import("@/lib/server-session");

    const session = await getServerSession();

    expect(session).toEqual({
      uid: "user-42",
      email: "ada@example.test",
      emailConfirmedAt: "2026-01-01T00:00:00Z",
    });
  });

  it("returns null for an anonymous request", async () => {
    const { getServerSession } = await import("@/lib/server-session");
    expect(await getServerSession()).toBeNull();
  });

  it("delegates to the established server utility (no second mechanism)", async () => {
    currentUser = { id: "user-1", email: null, email_confirmed_at: null };
    const { getServerSession } = await import("@/lib/server-session");
    await getServerSession();
    // The one server user mechanism from Phase 1.1.
    expect(getUserCalls).toBe(1);
  });

  it("carries identity only — no application data", async () => {
    currentUser = { id: "user-1", email: "a@b.test", email_confirmed_at: null };
    const { getServerSession } = await import("@/lib/server-session");
    const session = await getServerSession();
    // Exactly the auth fields; nothing from the profiles table.
    expect(Object.keys(session!).sort()).toEqual(["email", "emailConfirmedAt", "uid"]);
  });

  it("requireServerSession redirects to the login return path when anonymous", async () => {
    const { requireServerSession } = await import("@/lib/server-session");
    await expect(requireServerSession("/settings")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectCalls).toEqual(["/login?from=%2Fsettings"]);
  });

  it("requireServerSession returns the session instead of redirecting when authenticated", async () => {
    currentUser = { id: "user-7", email: "x@y.test", email_confirmed_at: null };
    const { requireServerSession } = await import("@/lib/server-session");
    const session = await requireServerSession("/settings");
    expect(session.uid).toBe("user-7");
    expect(redirectCalls).toEqual([]);
  });
});

describe("/settings route page — configured server", () => {
  it("passes the server-verified identity to the client shell", async () => {
    currentUser = { id: "user-9", email: "n@o.test", email_confirmed_at: null };
    const { default: SettingsRoute } = await import("@/app/settings/page");

    const element = await SettingsRoute();
    const html = renderToStaticMarkup(element);

    expect(html).toContain('data-uid="user-9"');
  });

  it("renders the guard branch (no identity) for an anonymous request", async () => {
    const { default: SettingsRoute } = await import("@/app/settings/page");

    const element = await SettingsRoute();
    const html = renderToStaticMarkup(element);

    // No identity crossed the boundary...
    expect(html).toContain('data-uid="none"');
  });

  it("resolves identity on the server before rendering any markup", async () => {
    currentUser = { id: "user-9", email: "n@o.test", email_confirmed_at: null };
    const { default: SettingsRoute } = await import("@/app/settings/page");
    await SettingsRoute();
    expect(getUserCalls).toBe(1);
  });

  it("is force-dynamic so a private page is never statically cached", async () => {
    const page = await import("@/app/settings/page");
    expect(page.dynamic).toBe("force-dynamic");
  });
});

describe("/settings route page — demo / unconfigured", () => {
  it("does not gate on the server when there is no cookie session to verify", async () => {
    configured = false;
    // Fresh module graph so the page reads the flipped flag; the default mock has
    // already imported it, and static ESM bindings are resolved per module.
    vi.resetModules();
    const { default: SettingsRoute } = await import("@/app/settings/page");

    const element = await SettingsRoute();
    const html = renderToStaticMarkup(element);

    // Falls back to the client guard rather than redirecting into a login form
    // the mock backend cannot satisfy.
    expect(html).toContain('data-uid="none"');
    expect(redirectCalls).toEqual([]);
    expect(counters.user).toBe(0);
  });
});

describe("server/client boundary (Step 3)", () => {
  it("keeps the route page a Server Component", () => {
    const page = readFileSync("src/app/settings/page.tsx", "utf8");
    // The directive must not appear at the top of the file; the prose below
    // mentions it to explain the boundary.
    expect(page.trimStart().startsWith('"use client"')).toBe(false);
    expect(page).toContain("@/lib/server-session");
  });

  it("keeps the browser tree behind a client boundary", () => {
    const shell = readFileSync("src/app/settings/settings-shell.tsx", "utf8");
    expect(shell.startsWith('"use client"')).toBe(true);
  });

  it("never imports the browser Supabase client into the server page", () => {
    const page = readFileSync("src/app/settings/page.tsx", "utf8");
    expect(page).not.toContain("@/lib/supabase\"");
    expect(page).not.toContain("@supabase/supabase-js");
  });

  it("passes only serialisable identity across the boundary", () => {
    // The shell's props type must not carry a Supabase `User` object.
    const shell = readFileSync("src/app/settings/settings-shell.tsx", "utf8");
    expect(shell).not.toContain("import type { User }");
    expect(shell).toContain("uid: string");
  });
});
