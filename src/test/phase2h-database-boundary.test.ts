/** Repository-wide runtime boundary guard. Historical SQL/docs/tests are classified
 * in PHASE_2H_AUDIT.md, not suppressed production database dependencies. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
const walk = (p: string): string[] =>
  readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walk(`${p}/${e.name}`)
      : /\.[jt]sx?$/.test(e.name)
        ? [`${p}/${e.name}`]
        : [],
  );
const production = walk("src").filter(
  (p) => !p.startsWith("src/test/") && !p.includes(".test."),
);
describe("Phase 2H final database boundary", () => {
  it("all runtime Supabase from calls are Storage byte operations; no RPCs remain", () => {
    for (const p of production) {
      const s = read(p)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      expect(s, p).not.toMatch(/\.rpc\(/);
      if (/\.from\(/.test(s.replace(/Array\.from\(/g, "ArrayConstruct("))) {
        expect([
          "src/lib/uploads.ts",
          "src/lib/attachments.ts",
          "src/server/storage/documents.ts",
        ]).toContain(p);
        expect(s, p).not.toMatch(/supabase\s*\.from\(/);
      }
    }
  });
  it("no runtime mock/delegate persistence graph or default badge error fallback", () => {
    for (const p of production)
      expect(read(p), p).not.toMatch(
        /from ["'][^"']*(mockSupabase|content-demo|test\/fixtures)|seedMockData|MockSupabaseClient/,
      );
    expect(read("src/lib/badges.ts")).not.toMatch(/DEFAULT_BADGES|\.catch\(/);
  });
  it("only isolated server Storage capability reads privileged credential", () => {
    const readers = production.filter((p) =>
      /process\.env\.SUPABASE_SERVICE_ROLE_KEY/.test(read(p)),
    );
    expect(readers).toEqual(["src/server/storage/documents.ts"]);
    expect(read(readers[0])).toMatch(/^import "server-only"/);
    expect(read(readers[0])).toContain('.storage.from("post-documents")');
  });
  it("Storage cutover policy references no application database or can_view_post", () => {
    const s = read("ops/supabase_storage_neon_cutover.sql");
    expect(s).not.toMatch(
      /public\.(posts|profiles|post_attachments|can_view_post)/,
    );
    expect(s).toContain("public=false");
    expect(s).toContain("auth.uid()");
  });
  it("no public badge award or independent profile counter setter survives", () => {
    expect(read("src/lib/badges.ts")).not.toContain("awardBadge");
    expect(read("src/server/features/profile/profile-queries.ts")).not.toMatch(
      /export async function (setReputation|adjustProfileCounter)/,
    );
    expect(read("src/app/api/profile/reputation/route.ts")).toContain("410");
  });
  it("Neon-backed APIs remain available to legacy UI through same-origin proxy", () => {
    expect(read("vite.config.ts")).toContain('"/api"');
    expect(read("vite.config.ts")).toContain("BORYNX_API_PROXY_TARGET");
    expect(read("src/lib/badge-client.ts")).not.toContain("localhost");
  });
});
