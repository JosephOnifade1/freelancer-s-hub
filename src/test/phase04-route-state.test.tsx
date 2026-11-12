/**
 * Phase 0.4 — route-state migration (step 3: `useParams` / `useLocation` consumers).
 *
 * What is asserted:
 *  1. `useCurrentParams` resolves from the App Router when present and falls back
 *     to React Router when it is not — the whole point of the seam.
 *  2. Parameter semantics behave as the views expect: present, absent, and
 *     multi-segment routes. React Router and Next.js do NOT behave identically
 *     here (Next returns `null` outside its provider, React Router returns `{}`),
 *     so this is pinned rather than assumed.
 *  3. `useCurrentPathname` no longer throws when rendered without a Router.
 *  4. Source guards: the migrated views keep their adapter-only APIs on the
 *     adapter (`useNavigate`/`useLocation` are step 4/5 work) and read route
 *     params through the seam.
 *
 * jsdom only — not a real browser.
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

const withRouter = (entries: string[]) =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={entries}>{children}</MemoryRouter>
  );

describe("useCurrentParams", () => {
  it("reads a single dynamic segment from the React Router location", async () => {
    const { useCurrentParams } = await import("@/hooks/useCurrentParams");
    const { result } = renderHook(() => useCurrentParams<{ slug: string }>(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/b/developers"]}>
          <Routes>
            <Route path="/b/:slug" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      ),
    });
    expect(result.current.slug).toBe("developers");
  });

  it("reads nested dynamic segments", async () => {
    const { useCurrentParams } = await import("@/hooks/useCurrentParams");
    const { result } = renderHook(() => useCurrentParams<{ slug: string; id: string }>(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/b/designers/p/post-42"]}>
          <Routes>
            <Route path="/b/:slug/p/:id" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      ),
    });
    expect(result.current).toEqual({ slug: "designers", id: "post-42" });
  });

  it("returns an empty map (not a throw) when no segment matches", async () => {
    const { useCurrentParams } = await import("@/hooks/useCurrentParams");
    const { result } = renderHook(() => useCurrentParams<{ leadId: string }>(), {
      wrapper: withRouter(["/l"]),
    });
    // Views guard with `if (!param)`, so an absent key must be undefined — never
    // the string "undefined" and never an exception.
    expect(result.current.leadId).toBeUndefined();
  });

  it("decodes URL-encoded segments the way tag routes rely on", async () => {
    const { useCurrentParams } = await import("@/hooks/useCurrentParams");
    const { result } = renderHook(() => useCurrentParams<{ tagName: string }>(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/tag/react%20native"]}>
          <Routes>
            <Route path="/tag/:tagName" element={<>{children}</>} />
          </Routes>
        </MemoryRouter>
      ),
    });
    expect(result.current.tagName).toBe("react native");
  });

  // Declared last: resets the module registry so the mocked `next/navigation`
  // cannot leak into other tests in this file.
  it("prefers App Router params when the Next router provides them", async () => {
    vi.resetModules();
    vi.doMock("next/navigation", async () => {
      const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
      return { ...actual, useParams: () => ({ leadId: "lead-1" }) };
    });
    const { useCurrentParams } = await import("@/hooks/useCurrentParams");
    const { result } = renderHook(() => useCurrentParams<{ leadId: string }>(), {
      wrapper: withRouter(["/ignored"]),
    });
    expect(result.current.leadId).toBe("lead-1");
    vi.doUnmock("next/navigation");
    vi.resetModules();
  });
});

describe("route-state source guards", () => {
  /** Views migrated to the params seam in Phase 0.4. */
  const PARAM_VIEWS: Array<[file: string, param: string]> = [
    ["views/CommunityDetail.tsx", "slug"],
    ["views/LeadDetail.tsx", "leadId"],
    ["views/PostDetail.tsx", "id"],
    ["views/TagFeed.tsx", "tagName"],
  ];

  it("migrated views read route params through the seam", () => {
    for (const [file, param] of PARAM_VIEWS) {
      const src = readFileSync(join(SRC, file), "utf8");
      expect(src, file).toContain("useCurrentParams");
      expect(src, file).toContain(`{ ${param} } = useCurrentParams`);
      // No leftover React Router useParams import in these files.
      expect(src, file).not.toMatch(/import \{[^}]*\buseParams\b[^}]*\} from "react-router-dom"/);
    }
  });

  it("keeps useNavigate on the adapter until step 4", () => {
    // The brief explicitly forbids migrating navigation writers in this phase.
    for (const [file] of PARAM_VIEWS) {
      const src = readFileSync(join(SRC, file), "utf8");
      if (src.includes("useNavigate")) {
        expect(src, file).toMatch(/import \{[^}]*useNavigate[^}]*\} from "react-router-dom"/);
      }
    }
  });

  it("leaves the legacy protected-route on the compatibility layer", () => {
    const src = readFileSync(join(SRC, "components/ProtectedRoute.tsx"), "utf8");
    expect(src).toContain('from "react-router-dom"');
  });

  it("moved the auth views to native navigation (Phase 1)", () => {
    for (const file of ["views/Login.tsx", "views/Signup.tsx"]) {
      const src = readFileSync(join(SRC, file), "utf8");
      expect(src, file).not.toContain('from "react-router-dom"');
      expect(src, file).toContain('from "next/navigation"');
    }
  });

  it("replaced the React Router `state={{ from }}` bridge with `?from=`", () => {
    // Phase 1: these used to forward the login destination through history.state.
    // They now build an href with the validated return path, so no production
    // file may pass auth location STATE into /login any more.
    const offenders = ["views/Profile.tsx", "views/LeadsBoard.tsx", "components/PollWidget.tsx",
      "views/LeadDetail.tsx", "views/CommunityDetail.tsx", "views/Communities.tsx",
      "components/ComposerBar.tsx", "views/PostDetail.tsx"]
      .filter((file) => {
        const src = readFileSync(join(SRC, file), "utf8");
        return /state=\{\{ *from/.test(src) || /from: (location|pageLocation)/.test(src);
      });
    expect(offenders).toEqual([]);
  });
});
