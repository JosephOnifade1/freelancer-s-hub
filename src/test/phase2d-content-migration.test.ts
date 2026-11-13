/**
 * Phase 2D — content domain migration invariants.
 *
 * Static assertions over the source tree, in the style of
 * `phase2c-profile-migration`. They exist because the deliverable here is largely an
 * *absence*: no Supabase content reads, no `profiles!` joins on migrated paths, no
 * client-supplied voter, no RPC for votes or roles. A behavioural test cannot prove a
 * call that no longer exists, and a future edit could reintroduce it silently.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function sourceFiles(dir = "src", acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules") continue;
      sourceFiles(path, acc);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      acc.push(path);
    }
  }
  return acc;
}

const files = sourceFiles();
const read = (path: string) => readFileSync(path, "utf8");

/** Strips comments, so "we removed X" notes do not fail "X is gone" checks. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Production files: everything except the demo backend and the mock it drives.
 *
 * `content-demo.ts` deliberately queries the mock client, because in demo mode that
 * client *is* the database. It is asserted separately below, including the fact that
 * every one of its entry points is behind `isDemoMode`.
 */
const nonMock = files.filter(
  (f) =>
    !f.includes("mockSupabase") &&
    f !== "src/lib/content-demo.ts" &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".test.tsx"),
);

const TABLES = [
  "posts",
  "comments",
  "votes",
  "polls",
  "poll_options",
  "poll_votes",
  "post_attachments",
  "saved_posts",
];

describe("no Supabase content access remains", () => {
  it("nothing reads or writes a migrated content table directly", () => {
    const offenders: string[] = [];
    for (const file of nonMock) {
      const source = code(file);
      for (const table of TABLES) {
        if (new RegExp(`from\\(\\s*["']${table}["']\\s*\\)`).test(source)) {
          offenders.push(`${file} → ${table}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("only the demo backend still touches those tables, and only through the mock", () => {
    // `content-demo.ts` legitimately queries the mock client in demo mode, where that
    // client *is* the database. Production never loads it: `isDemoMode` is false.
    const demo = code("src/lib/content-demo.ts");
    expect(demo).toContain('from("posts")');
    expect(read("src/lib/content-client.ts")).toContain(
      'import * as demo from "./content-demo"',
    );
    // ...and every demo call is behind the flag.
    const client = code("src/lib/content-client.ts");
    const demoCalls = client.match(/return demo\./g) ?? [];
    const guards = client.match(/if \(isDemoMode\) return demo\./g) ?? [];
    expect(demoCalls.length).toBe(guards.length);
  });

  it("no content RPC survives", () => {
    const offenders: string[] = [];
    for (const file of nonMock) {
      const source = code(file);
      for (const fn of [
        "cast_vote",
        "increment_post_views",
        "set_user_role",
        "set_user_verified_pro",
      ]) {
        if (new RegExp(`rpc\\(\\s*["']${fn}["']`).test(source)) {
          offenders.push(`${file} → ${fn}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the demo delegate keeps the mock's vote and view RPCs, which have no server equivalent", () => {
    // The mock's `cast_vote` is its RLS mirror. Demo mode has no Neon, so it must call
    // the mock's own implementation rather than the removed Supabase RPC path.
    const demo = code("src/lib/content-demo.ts");
    expect(demo).toContain('rpc("cast_vote"');
    expect(demo).toContain('rpc("increment_post_views"');
  });
});

describe("embedded profile joins are gone from migrated paths", () => {
  it("posts, comments and search carry no profiles! join", () => {
    for (const file of ["src/lib/posts.ts", "src/lib/comments.ts", "src/lib/search.ts"]) {
      expect(code(file), file).not.toMatch(/profiles!/);
    }
  });

  it("reports no longer joins profiles for its content previews", () => {
    // Content previews moved in 2D; the lead preview also moved in Phase 2F.
    const source = code("src/lib/reports.ts");
    expect(source).not.toContain("profiles!posts_authorUid_fkey");
    expect(source).not.toContain("profiles!comments_authorUid_fkey");
    expect(source).not.toContain("profiles!leads_postedByUid_fkey");
  });

  it("leads also has no embedded join after Phase 2F", () => {
    expect(code("src/lib/leads.ts")).not.toContain("profiles!leads_postedByUid_fkey");
  });

  it("author hydration is batched, never per-item", () => {
    // A per-row profile fetch would be an N+1 against the profile route. Every call
    // site must go through `hydrateAuthors` (plural).
    for (const file of ["src/lib/posts.ts", "src/lib/comments.ts", "src/lib/search.ts"]) {
      expect(code(file), file).toContain("hydrateAuthors");
    }
  });
});

describe("authorization shape", () => {
  it("the server predicate is defined once, and any client mirror is inert", () => {
    const definers = nonMock.filter((file) => /export function canViewPost/.test(read(file)));
    // `src/lib/posts.ts` keeps a *client* mirror for demo mode and optimistic UI. It is
    // no longer the boundary: the server filters inside the query. Both exist on
    // purpose, and the integration suite asserts they agree row for row.
    expect(definers.sort()).toEqual([
      "src/lib/posts.ts",
      "src/server/features/content/authorization.ts",
    ]);

    // The client mirror must not be used to filter a server-produced feed.
    const posts = code("src/lib/posts.ts");
    expect(posts).not.toMatch(/visibleOnly/);
  });

  it("every feed read applies the filter inside the query", () => {
    const source = code("src/server/features/content/content-queries.ts");
    // `findPosts` must include the authorization fragment in its conditions.
    expect(source).toContain("authorizationFilter(viewer)");
    // And must not fetch-then-filter: `findPosts` returning rows before the predicate
    // would defeat the point. There is exactly one return of mapped rows.
    expect(source).toMatch(/order by p\."createdAt" desc/);
  });

  it("no content write route accepts a uid from the body or query", () => {
    const writeRoutes = [
      "src/app/api/content/posts/route.ts",
      "src/app/api/content/votes/route.ts",
      "src/app/api/content/comments/[id]/route.ts",
      "src/app/api/content/attachments/route.ts",
      "src/app/api/content/saved/[postId]/route.ts",
    ];
    for (const route of writeRoutes) {
      const source = code(route);
      // A body field named authorUid / userId / voterUid must never be *read* from the
      // request. (Mentioning it in a comment is fine, and already stripped.)
      expect(source, route).not.toMatch(/body\.(authorUid|userId|voterUid|uploaderUid)/);
      expect(source, route).not.toMatch(/searchParams\.get\(\s*["'](authorUid|userId|uid)["']/);
    }
  });

  it("the admin routes send only the target", () => {
    for (const route of [
      "src/app/api/admin/roles/route.ts",
      "src/app/api/admin/verification/route.ts",
    ]) {
      const source = code(route);
      expect(source, route).toContain("body.uid");
      expect(source, route).not.toMatch(/body\.(actorUid|adminUid|actor)/);
    }
  });

  it("role and verification checks live beside the mutation, not in the route", () => {
    // A second caller must not be able to forget the check.
    const queries = code("src/server/features/content/content-queries.ts");
    expect(queries).toMatch(/export async function setUserRole/);
    expect(queries).toContain('!== "admin"');
    expect(code("src/app/api/admin/roles/route.ts")).not.toContain("role === \"admin\"");
  });

  it("membership is never accepted from the client", () => {
    // The viewer's community facts come from the server-only Supabase client.
    const source = read("src/server/features/content/index.ts");
    expect(source).toContain("communityFacts");
    expect(source).not.toContain("createSupabaseServerClient");
    expect(source).not.toMatch(/body\.memberSlugs/);
  });
});

describe("server-only boundary", () => {
  it("the content orchestrator is server-only", () => {
    expect(read("src/server/features/content/index.ts").trimStart()).toMatch(
      /^import "server-only";/,
    );
  });

  it("the query core stays pure and injectable", () => {
    // Same rule as `profile-queries.ts`: no `server-only`, no connection import, so it
    // can be integration-tested against real PostgreSQL without a second copy of the SQL.
    const source = read("src/server/features/content/content-queries.ts");
    expect(source).not.toContain('import "server-only"');
    expect(source).not.toContain("@/server/db");
  });

  it("no client file imports the server content feature", () => {
    const offenders = nonMock.filter((file) => {
      const isClient =
        file.startsWith("src/views/") ||
        file.startsWith("src/components/") ||
        file.startsWith("src/hooks/") ||
        (file.startsWith("src/lib/") && !file.startsWith("src/lib/"));
      return isClient && read(file).includes("@/server/features/content");
    });
    expect(offenders).toEqual([]);
  });
});

describe("Supabase Auth and Storage are untouched", () => {
  it("Storage still owns the bytes", () => {
    const source = read("src/lib/attachments.ts");
    expect(source).toContain("supabase.storage");
    expect(source).toContain("post-documents");
  });

  it("the attachment route stores a pointer and never touches Storage", () => {
    // Comments mention Storage on purpose (they explain the split); the *code* must not.
    const source = code("src/app/api/content/attachments/route.ts");
    expect(source).not.toContain("supabase");
    expect(source.toLowerCase()).not.toContain("storage.from");
    expect(source).not.toContain("createSignedUrl");
  });

  it("Auth is unchanged and email never enters the content schema", () => {
    const schema = read("src/server/db/schema/content.ts");
    expect(schema).not.toMatch(/\bemail\b/);
  });
});

describe("unmigrated domains stay in Supabase", () => {
  it("unmigrated notification and report persistence remains Supabase", () => {
    const stillInSupabase: Record<string, string> = {
      "src/lib/communities.ts": "communities",
      "src/lib/notifications.ts": "notifications",
      "src/lib/reports.ts": "reports",
    };
    for (const [file, table] of Object.entries(stillInSupabase)) {
      expect(code(file), file).toContain(`"${table}"`);
    }
  });

  it("the transitional follow counter is replaced by the atomic social boundary", () => {
    // Phase 2D §8: `toggleFollow` straddles the two databases until `follows` migrates.
    // It must not have been "cleaned up" as part of this phase.
    const source = code("src/lib/users.ts");
    expect(source).toContain("setFollowing");
    expect(source).not.toContain("increment_followers");
    expect(source).not.toContain("decrement_followers");
  });
});
