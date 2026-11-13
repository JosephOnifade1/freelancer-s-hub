/**
 * Phase 1.1 — session architecture invariants (Steps 2, 7 & 8).
 *
 * These are source-contract tests: they assert the structural decisions that make
 * the cookie session work and that keep a second session source from creeping
 * back in. They are cheap and they catch exactly the regressions that are hard to
 * see at runtime (a client reverted to localStorage, a config read that breaks
 * server imports, a protected page losing its guard).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PROTECTED_ROUTES } from "@/lib/route-access";

const read = (p: string) => readFileSync(p, "utf8");

describe("browser client (Step 2)", () => {
  it("uses the cookie-backed @supabase/ssr client in the browser", () => {
    const src = read("src/lib/supabase.ts");
    expect(src).toContain('from "@supabase/ssr"');
    expect(src).toContain("createBrowserClient");
  });

  it("never falls back to localStorage session storage", () => {
    // `createClient` from supabase-js defaults to localStorage. It is kept only
    // for the prerender/Vitest branch, which holds no session.
    const src = read("src/lib/supabase.ts");
    const clientUsages = src.match(/createClient\(/g) ?? [];
    // Two: the placeholder client and the non-browser prerender client.
    expect(clientUsages).toHaveLength(2);
    expect(src).toContain('typeof window === "undefined"');
  });

  it("keeps credential reads in the server-safe module", () => {
    const env = read("src/lib/supabase-env.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // No browser globals, no SDK, no demo mock: importable from the proxy.
    expect(env).not.toContain("window.");
    expect(env).not.toContain("localStorage");
    expect(env).not.toContain("@supabase/supabase-js");
    expect(env).not.toContain("@supabase/ssr");
    // But it must still keep the literal inlinable reads.
    expect(env).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
    expect(env).toContain("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("never references a service-role credential", () => {
    for (const file of ["src/lib/supabase.ts", "src/lib/supabase-env.ts", "src/lib/supabase-server.ts", "src/proxy.ts"]) {
      expect(read(file), file).not.toMatch(/SERVICE_ROLE|SERVICE_KEY/i);
    }
  });
});

describe("server client (Step 2)", () => {
  it("derives server access from request cookies via @supabase/ssr", () => {
    const src = read("src/lib/supabase-server.ts");
    expect(src).toContain("createServerClient");
    expect(src).toContain("next/headers");
    expect(src).toContain("getAll");
    expect(src).toContain("setAll");
  });

  it("verifies identity with getUser rather than trusting the cookie", () => {
    const src = read("src/lib/supabase-server.ts")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(src).toContain("auth.getUser()");
    expect(src).not.toContain("getSession()");
  });

  it("is never imported by a client component or view", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      if (file.includes("supabase-server")) continue;
      if (file.startsWith("src/test/")) continue;
      const src = read(file);
      if (!src.includes("@/lib/supabase-server")) continue;
      const isServerFile =
        src.includes("next/server") || file.endsWith("route.ts") || src.includes("next/headers");
      if (!isServerFile) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("proxy (Step 6)", () => {
  it("refreshes the session and gates protected paths in one place", () => {
    const src = read("src/proxy.ts");
    expect(src).toContain("createServerClient");
    expect(src).toContain("isProtectedPath");
    expect(src).toContain("loginPath");
    // The refresh must write the rotated cookies back to both request and
    // response, otherwise the server and browser diverge.
    expect(src).toContain("request.cookies.set");
    expect(src).toContain("response.cookies.set");
  });

  it("reuses the existing return-path validator (no second system)", () => {
    const libs = readdirSync("src/lib");
    // Exactly one sanitizer exists in the codebase.
    const sanitizerFiles = walk("src").filter(
      (f) => !f.startsWith("src/test/") && /export function sanitizeReturnPath/.test(read(f)),
    );
    expect(sanitizerFiles).toEqual(["src/lib/return-path.ts"]);
    expect(libs).toContain("return-path.ts");
  });

  it("does not gate routes when there is no cookie session to verify", () => {
    // Demo mode and unconfigured builds must not be bounced by the proxy.
    expect(read("src/proxy.ts")).toContain("if (!credentials) return NextResponse.next()");
  });
});

describe("layered protection (Step 7)", () => {
  it("keeps AuthGate on every protected page (client layer retained)", () => {
    const missing: string[] = [];
    for (const route of PROTECTED_ROUTES) {
      const page = join("src/app", route.slice(1), "page.tsx");
      const src = read(page);
      if (!src.includes("AuthGate")) missing.push(route);
    }
    expect(missing).toEqual([]);
  });

  it("explains why the client layer was kept rather than removed", () => {
    const src = read("src/components/AuthGate.tsx");
    expect(src).toContain("proxy");
    expect(src).toContain("not removed");
  });
});

describe("single session source (Step 8)", () => {
  it("keeps a single browser client, so every getSession() sees one session", () => {
    // Phase 1.1 finding: five data-layer modules call `getSession()` directly.
    // They are *not* competing identity sources — each reads the uid of the
    // session on the one shared client to gate a write (RLS is still the real
    // authority). That is only true because `@/lib/supabase` exports a singleton;
    // a second client would mean a second session store.
    const sessionReaders = walk("src").filter(
      (f) => !f.startsWith("src/test/") && /supabase\.auth\.getSession\(/.test(read(f)),
    );
    expect(sessionReaders.sort()).toEqual([
      "src/hooks/useAuth.tsx",
      "src/lib/attachments.ts",
      "src/lib/posts.ts",
      "src/lib/uploads.ts",
      "src/lib/users.ts",
      "src/views/ResetPassword.tsx",
    ]);

    // Only one module may construct a Supabase client.
    const clientFactories = walk("src").filter(
      (f) =>
        !f.startsWith("src/test/") &&
        /createClient\(|createBrowserClient\(|createServerClient\(/.test(read(f)),
    );
    expect(clientFactories.sort()).toEqual([
      "src/lib/supabase-server.ts", // server (cookie read/write)
      "src/lib/supabase.ts", // browser singleton
      "src/proxy.ts", // per-request refresh
    ]);
  });

  it("AuthProvider reads the session once and reacts to changes", () => {
    const src = read("src/hooks/useAuth.tsx");
    expect(src).toContain("onAuthStateChange");
    expect(src).toContain("getSession");
    expect(src).toContain("lastUid");
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full.replace(/\\/g, "/"));
  }
  return out;
}
