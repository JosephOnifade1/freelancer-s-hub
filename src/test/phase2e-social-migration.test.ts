import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
function files(dir: string): string[] {
  return readdirSync(dir,{ withFileTypes:true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : /\.[jt]sx?$/.test(e.name) ? [`${dir}/${e.name}`] : []);
}
const read = (p: string) => readFileSync(p,"utf8");
const production = files("src").filter(f => !/\.test\./.test(f) && !f.includes("mockSupabase"));
describe("Phase 2E static regression boundaries", () => {
  it("has no migrated-domain Supabase tables or counter RPCs in any application path", () => {
    for (const f of production) {
      expect(read(f),f).not.toMatch(/\.from\(\s*["'](communities|community_members|follows)["']/);
      expect(read(f),f).not.toMatch(/\.rpc\(\s*["'](?:increment|decrement)_(?:community_members|followers|following)["']/);
    }
  });
  it("does not leave a demo/localStorage fallback in migrated adapters", () => {
    for (const f of ["src/lib/communities.ts","src/lib/social-client.ts","src/server/features/social/index.ts"]) {
      expect(read(f),f).not.toMatch(/isDemoMode|mockSupabase|localStorage|supabase\.from/);
    }
  });
  it("persists only stable community ID, never a competing slug relation", () => {
    const content = read("src/server/db/schema/content.ts");
    expect(content).toContain('communityId: uuid("communityId")');
    expect(content).not.toContain('communitySlug: text(');
    expect(content).toContain('onDelete: "restrict"');
    const social = read("src/server/db/schema/social.ts");
    expect(social).toContain('ownerId: text("ownerId")');
    expect(social).toContain('default("system")');
  });
  it("server content viewer uses the Neon community facts port", () => {
    expect(read("src/server/features/content/index.ts")).toContain("communityFacts(getDatabase(), uid)");
    expect(read("src/server/features/content/index.ts")).not.toContain("createSupabaseServerClient");
    expect(read("src/server/features/social/social-queries.ts")).toContain("memberIds:");
  });
  it("keeps queries injectable and services server-only", () => {
    expect(read("src/server/features/social/index.ts").trimStart()).toMatch(/^import "server-only";/);
    expect(read("src/server/features/social/social-queries.ts")).not.toMatch(/from ["']@\/server\/db["']/);
    for (const f of production.filter(f => /^src\/(lib|views|components|hooks)\//.test(f))) {
      expect(read(f),f).not.toContain("@/server/features/social");
    }
  });
  it("retires independent counter writes instead of leaving an integrity bypass", () => {
    const route = read("src/app/api/profile/following-counter/route.ts");
    expect(route).toContain("status: 410");
    expect(route).not.toContain("adjustCurrentFollowing");
    expect(read("src/lib/users.ts")).not.toContain("adjustFollowingCounter");
  });
  it("does not silently detach legacy community-scoped posts during migration", () => {
    const migration = read("src/server/db/migrations/0003_community_social_graph.sql");
    expect(migration).toContain("RAISE EXCEPTION");
    expect(migration.indexOf("RAISE EXCEPTION")).toBeLessThan(migration.indexOf('DROP COLUMN "communitySlug"'));
  });
});
