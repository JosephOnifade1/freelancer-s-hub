/**
 * Phase 0.2 — environment variable contract.
 *
 * Next only inlines `process.env.NEXT_PUBLIC_*` when the identifier appears
 * literally in source. A computed read (`process.env[key]`) or a `process.env`
 * object spread silently yields `undefined` in the browser bundle, which is
 * exactly how Supabase config was lost between Phase 0 and Phase 0.1. These
 * assertions keep that from regressing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Phase 1.1 moved credential resolution out of the browser client so the proxy
// and server utilities can import it without touching browser globals. The
// contract is unchanged; only the module holding it moved — assert on that module
// and keep proving the browser client does not read env itself.
const ENV_MODULE = "src/lib/supabase-env.ts";
const raw = readFileSync(ENV_MODULE, "utf8");
// Comments explain the pitfalls and mention the very patterns we forbid, so
// they are stripped before matching.
const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("environment variable handling", () => {
  it("reads NEXT_PUBLIC_* identifiers literally (inlinable by Next)", () => {
    const literalReads = [
      "process.env.NEXT_PUBLIC_SUPABASE_URL",
      "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "process.env.NEXT_PUBLIC_DEMO_MODE",
    ];
    for (const read of literalReads) expect(source).toContain(read);
  });

  it("never indexes process.env with a computed key", () => {
    expect(source).not.toMatch(/process\.env\s*\[/);
    expect(source).not.toMatch(/process\.env\s*\)\s*\[/);
  });

  it("never references server-only secrets", () => {
    expect(source).not.toMatch(/SERVICE_ROLE|SERVICE_KEY|SUPABASE_SERVICE/);
    expect(source).not.toMatch(/process\.env\.(?!NEXT_PUBLIC_)[A-Z]/);
  });

  it("still supports the Vite variable names", () => {
    for (const name of ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY", "VITE_DEMO_MODE"]) {
      expect(source).toContain(name);
    }
    expect(source).toContain("import.meta");
  });

  it("keeps the browser client free of env reads (single source)", () => {
    const client = readFileSync("src/lib/supabase.ts", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(client).not.toMatch(/process\.env/);
    expect(client).not.toContain("import.meta");
  });

  it("documents both variable conventions in .env.example", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(example).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(example).toContain("NEXT_PUBLIC_DEMO_MODE");
    expect(example).toContain("VITE_SUPABASE_URL");
  });
});
