/**
 * Phase 2C — profile domain migration invariants.
 *
 * These are static assertions over the source tree, in the style of
 * `phase1.1-session-architecture`. They exist because the *absence* of something is the
 * deliverable here: no Supabase profile reads, no duplicate provisioning, no uid in a
 * request body. A behaviour test cannot prove a negative that has been deleted, and a
 * future edit could reintroduce it silently.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Every TypeScript/TSX file under `src`, excluding tests and the mock backend. */
function sourceFiles(dir = "src", acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "test") continue;
      sourceFiles(path, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(path);
    }
  }
  return acc;
}

const files = sourceFiles();
const read = (path: string) => readFileSync(path, "utf8");

/**
 * Strips comments, so an assertion about what code *does* is not defeated by a comment
 * explaining what it no longer does. This phase deliberately leaves "we removed X" notes
 * in place, and those notes must not fail the "X is gone" checks.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/** Files that talk to the Supabase client at all. */
const clientside = files.filter((f) => f !== "src/lib/mockSupabase.ts");

describe("no Supabase profile access remains", () => {
  it("nothing reads or writes the profiles table directly", () => {
    const offenders = clientside.filter((f) =>
      /from\(\s*["']profiles["']\s*\)/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it("nothing reads or writes the usernames registry directly", () => {
    const offenders = clientside.filter((f) =>
      /from\(\s*["']usernames["']\s*\)/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it("the only profile SQL lives in the server feature directory", () => {
    const filesWithProfileSql = clientside.filter((f) => {
      const source = read(f);
      // A Drizzle query against the profile tables.
      return /(from|update|insert\s+into)\s+profiles\b/i.test(source);
    });
    // Only server feature modules may query these tables. As of Phase 2D that
    // includes `content`, which reads the viewer's own `role` for authorization and
    // adjusts `reputation` inside the vote transaction — both server-side, neither
    // in a client path.
    for (const file of filesWithProfileSql) {
      expect(file).toMatch(/^src\/server\/features\/(profile|identity|content|social|marketplace|trust)\//);
    }
  });
});

describe("no duplicate provisioning mechanism", () => {
  it("only AuthProvider starts a provisioning attempt", () => {
    const callers = clientside.filter((f) =>
      /provisionProfileOnServer\s*\(/.test(read(f)) && f !== "src/lib/profile-provisioning.ts",
    );
    expect(callers).toEqual(["src/hooks/useAuth.tsx"]);
  });

  it("the deprecated browser-side profile helpers are gone", () => {
    const source = code("src/lib/users.ts");
    expect(source).not.toContain("ensureUserProfile");
    expect(source).not.toContain("createUserProfile");
    // `claimUsername` was superseded by the server claim in 2B.3.
    expect(source).not.toMatch(/export const claimUsername\s*=/);
  });

  it("no view writes profile fields through Supabase", () => {
    const offenders = clientside.filter((f) => {
      const source = read(f);
      // Any remaining `.from("profiles")` would already fail the test above, so this
      // additionally guards the RPCs that used to mutate profile counters.
      return /rpc\(\s*["'](increment|decrement)_(followers|following)["']/.test(source);
    });
    // Phase 2E moves both halves into a Neon transaction. No RPC may survive.
    expect(offenders).toEqual([]);
    const source = read("src/lib/users.ts");
    expect(source).not.toContain("increment_followers");
    // But the caller's own half must no longer go through an RPC.
    expect(source).not.toContain("increment_following\"");
    expect(source).not.toContain("decrement_following\"");
  });
});

describe("authorization shape", () => {
  it("every write route resolves identity server-side", () => {
    for (const route of [
      "src/app/api/profile/me/route.ts",
      "src/app/api/profile/avatar/route.ts",
      "src/app/api/profile/reputation/route.ts",
    ]) {
      const source = read(route);
      // None of them reads a uid from the request.
      expect(source, route).not.toMatch(/body[^\n]*\.uid/);
      expect(source, route).not.toMatch(/searchParams\.get\(\s*["']uid["']\s*\)/);
    }
  });

  it("no profile endpoint exposes role except the moderation one", () => {
    for (const file of files) {
      if (!file.startsWith("src/app/api/profile")) continue;
      const source = read(file);
      // `role` may be *mentioned* (in a comment about not exposing it), but the
      // moderation route is the only one allowed to serve it.
      if (file.includes("moderation")) continue;
      expect(source, file).not.toMatch(/["']role["']\s*:/);
    }
  });

  it("the public projection excludes role", () => {
    const source = read("src/server/features/profile/profile-queries.ts");
    const publicColumns = source.slice(
      source.indexOf("const PUBLIC_COLUMNS"),
      source.indexOf("const OWN_COLUMNS"),
    );
    expect(publicColumns).not.toContain("role");
    expect(publicColumns).not.toMatch(/select\s+\*/i);
  });

  it("the moderation query is the only one that selects role for others", () => {
    const source = code("src/server/features/profile/profile-queries.ts");
    // Every `select … from profiles` must either be the moderation projection or the
    // viewer's own row (`OWN_COLUMNS`, which legitimately includes role).
    const selects = [...source.matchAll(/select [\s\S]{0,400}?from profiles/g)].map((m) => m[0]);
    for (const select of selects) {
      // `select 1 from profiles` is the availability probe: it projects no column at
      // all, so it cannot leak anything.
      // Availability probes (`select exists(… select 1 from profiles)`) project no
      // column, so they cannot leak anything.
      if (/^select 1 from profiles/.test(select) || /^select exists\(/.test(select)) continue;

      const isOwn = select.includes("${OWN_COLUMNS}");
      const isModeration = select.includes('reputation, "isVerifiedPro", role');
      const isPublic = select.includes("${PUBLIC_COLUMNS}");
      expect(isOwn || isModeration || isPublic, select).toBe(true);
      if (!isOwn && !isModeration) expect(select).not.toContain("role");
    }
  });
});

describe("Supabase Auth and Storage are untouched", () => {
  it("Auth still owns the session", () => {
    // The identity anchor must still be the Supabase UUID, read from a verified session.
    const source = read("src/server/features/profile/index.ts");
    expect(source).toContain("getServerSession");
    expect(source).not.toMatch(/auth\.getUser/); // only the session helper may verify
  });

  it("Storage uploads are unchanged", () => {
    const source = read("src/lib/uploads.ts");
    expect(source).toContain("supabase.storage");
    expect(source).toContain("avatars");
  });

  it("the avatar route stores a URL and never touches Storage", () => {
    const source = read("src/app/api/profile/avatar/route.ts");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("storage");
  });

  it("email is never selected from the profile tables", () => {
    // Supabase Auth owns it; it is not a Neon column and must not become one.
    const source = code("src/server/features/profile/profile-queries.ts");
    expect(source).not.toMatch(/\bemail\b/);
  });
});

describe("server-only boundary", () => {
  it("the profile orchestrator is server-only", () => {
    expect(read("src/server/features/profile/index.ts").trimStart()).toMatch(/^import "server-only";/);
  });

  it("no client file imports the server profile feature", () => {
    const offenders = clientside.filter((f) => {
      const source = read(f);
      const isClient =
        f.startsWith("src/views/") ||
        f.startsWith("src/components/") ||
        f.startsWith("src/hooks/") ||
        f.startsWith("src/lib/");
      return isClient && source.includes("@/server/features/profile");
    });
    expect(offenders).toEqual([]);
  });
});
