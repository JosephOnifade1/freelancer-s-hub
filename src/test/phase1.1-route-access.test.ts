/**
 * Phase 1.1 — route classification (Step 5).
 *
 * The proxy protects `PROTECTED_ROUTES` and touches nothing else, so this
 * inventory is the security boundary. These tests pin it to the routes that
 * actually exist, so a new private page cannot be added without being classified
 * (and a public page cannot be gated by accident).
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  PROTECTED_ROUTES,
  PUBLIC_ROUTES,
  AUTH_ROUTES,
  isProtectedPath,
  isPublicPath,
} from "@/lib/route-access";

const APP = "src/app";

/** Every `page.tsx` URL in the App Router, dynamic segments as `[param]`. */
function appRouterUrls(dir = APP, prefix = ""): string[] {
  const entries = readdirSync(dir);
  const urls: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // Route groups `(auth)` and private folders `_x` do not affect the URL.
    const segment = /^\(.*\)$/.test(entry) || entry.startsWith("_") ? "" : `/${entry}`;
    const nextPrefix = prefix + segment;
    if (entries.includes("page.tsx") && entry === "page.tsx") continue;
    try {
      if (readdirSync(full).includes("page.tsx")) urls.push(nextPrefix || "/");
    } catch {
      /* not a directory */
    }
    urls.push(...appRouterUrls(full, nextPrefix));
  }
  return urls;
}

describe("protected route inventory", () => {
  it("classifies every protected URL as protected", () => {
    for (const route of PROTECTED_ROUTES) {
      expect(isProtectedPath(route), route).toBe(true);
    }
  });

  it("protects nested paths under a protected route", () => {
    expect(isProtectedPath("/settings/profile")).toBe(true);
    expect(isProtectedPath("/pipeline/board")).toBe(true);
    expect(isProtectedPath("/l/post")).toBe(true);
  });

  it("does not over-match look-alike paths", () => {
    // Prefix matching must stay anchored on a path segment boundary.
    expect(isProtectedPath("/settings-archive")).toBe(false);
    expect(isProtectedPath("/pipelinex")).toBe(false);
    expect(isProtectedPath("/logins")).toBe(false);
  });

  it("never classifies an auth-flow route as protected", () => {
    for (const route of AUTH_ROUTES) {
      expect(isProtectedPath(route), route).toBe(false);
      expect(isPublicPath(route), route).toBe(true);
    }
  });

  it("keeps public profiles, posts and opportunities readable anonymously", () => {
    for (const path of ["/b/design", "/b/design/p/42", "/p/42", "/f/ada", "/u/ada", "/l/abc", "/tag/design"]) {
      expect(isProtectedPath(path), path).toBe(false);
      expect(isPublicPath(path), path).toBe(true);
    }
  });

  it("keeps the feed and marketing pages public", () => {
    for (const path of ["/", "/new", "/popular", "/leaderboard", "/communities", "/pricing", "/status", "/privacy", "/terms"]) {
      expect(isPublicPath(path), path).toBe(true);
      expect(isProtectedPath(path), path).toBe(false);
    }
  });

  it("covers every gated page that exists in the App Router", () => {
    const urls = appRouterUrls();
    for (const route of PROTECTED_ROUTES) {
      expect(urls, `protected route ${route} has no page`).toContain(route);
    }
  });

  it("does not double-classify a path as both public and protected", () => {
    const overlap = [...PROTECTED_ROUTES].filter((route) =>
      (PUBLIC_ROUTES as readonly string[]).includes(route),
    );
    expect(overlap).toEqual([]);
  });
});

describe("proxy and route table agree", () => {
  it("the proxy consults the shared inventory rather than a private copy", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain("@/lib/route-access");
    expect(proxy).toContain("isProtectedPath");
    // A hardcoded path list in the proxy would drift from the inventory.
    expect(proxy).not.toMatch(/PROTECTED_ROUTES\s*=\s*\[/);
  });

  it("the proxy skips static assets in its matcher", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    expect(proxy).toContain("_next/static");
    expect(proxy).toContain("_next/image");
    expect(proxy).toMatch(/matcher/);
  });

  it("uses the Next.js 16 `proxy` convention, not the deprecated one", () => {
    expect(readFileSync("src/proxy.ts", "utf8")).toContain("export async function proxy");
    expect(() => statSync("src/middleware.ts")).toThrow();
  });
});
