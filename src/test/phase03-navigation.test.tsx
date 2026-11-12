/**
 * Phase 0.3 — React Router adapter reduction.
 *
 * Two things are asserted here:
 *
 *  1. Behaviour — the native `NavLink` reproduces React Router's active-state
 *     contract exactly (the Phase 0.2 bug was that active styling never
 *     rendered at all), and `useCurrentPathname` resolves in both runtimes.
 *
 *  2. Boundaries — files migrated off the compatibility layer stay off it, and
 *     the files that legitimately still depend on it do not grow. Both are
 *     source scans rather than runtime checks, so a regression is caught in
 *     review instead of in production.
 *
 * These are jsdom/source assertions, not real-browser navigation checks.
 */
import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MemoryRouter } from "react-router-dom";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Auth is stubbed for the whole file: the migrated views under test either do not
// read it or only need "signed out". Mocking it here (rather than with
// `vi.resetModules()` per test) avoids splitting module singletons such as the
// sidebar context.
const mockAuth: { current: { user: null; loading: boolean } } = {
  current: { user: null, loading: false },
};
vi.mock("@/hooks/auth-context", () => ({ useAuth: () => mockAuth.current }));
vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => mockAuth.current,
}));

const withRouter = (entries: string[]) =>
  ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={entries}>{children}</MemoryRouter>
  );

// ─── 1. NavLink active-state contract ───────────────────────────────────────
describe("native NavLink active state", () => {
  const renderNavLink = async (target: string, path: string, end?: boolean) => {
    const { NavLink } = await import("@/components/NavLink");
    return render(
      <MemoryRouter initialEntries={[path]}>
        <NavLink
          to={target}
          end={end}
          className={({ isActive }) => (isActive ? "is-active" : "is-idle")}
        >
          link
        </NavLink>
      </MemoryRouter>
    );
  };

  it("marks an exact match active", async () => {
    const { container } = await renderNavLink("/l", "/l");
    expect(container.querySelector("a")!.className).toBe("is-active");
  });

  it("marks a nested path active", async () => {
    const { container } = await renderNavLink("/l", "/l/lead-1");
    expect(container.querySelector("a")!.className).toBe("is-active");
  });

  it("does not activate on a partial segment match", async () => {
    // "/new" must not light up for "/newsletter" — prefix without a boundary.
    const { container } = await renderNavLink("/new", "/newsletter");
    expect(container.querySelector("a")!.className).toBe("is-idle");
  });

  it("honours `end` by requiring an exact match", async () => {
    const { container } = await renderNavLink("/l", "/l/lead-1", true);
    expect(container.querySelector("a")!.className).toBe("is-idle");
  });

  it("only activates the root link on the root path", async () => {
    const root = await renderNavLink("/", "/");
    expect(root.container.querySelector("a")!.className).toBe("is-active");
    root.unmount();

    const nested = await renderNavLink("/", "/l");
    expect(nested.container.querySelector("a")!.className).toBe("is-idle");
  });

  it("never leaks a render prop into the class attribute", async () => {
    const { container } = await renderNavLink("/l", "/l");
    const html = container.innerHTML;
    expect(html).not.toContain("=>");
    expect(html).not.toContain("isActive");
    expect(html).not.toContain("[object");
  });

  it("keeps a plain-string className unchanged", async () => {
    const { NavLink } = await import("@/components/NavLink");
    const { container } = render(
      <MemoryRouter initialEntries={["/zzz"]}>
        <NavLink to="/l" className="plain" activeClassName="on" />
      </MemoryRouter>
    );
    expect(container.querySelector("a")!.className).toBe("plain");
  });
});

// ─── 1a. Dual-runtime link ──────────────────────────────────────────────────
describe("AppLink runtime selection", () => {
  it("navigates client-side in the React Router runtime (no full reload)", async () => {
    const { AppLink } = await import("@/components/AppLink");
    const { useLocation, Routes, Route } = await import("react-router-dom");
    function Loc() {
      return <span data-testid="loc">{useLocation().pathname}</span>;
    }
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppLink href="/communities">go</AppLink>
        <Routes>
          <Route path="*" element={<Loc />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("go"));
    expect(screen.getByTestId("loc").textContent).toBe("/communities");
  });

  it("stays a React Router link when usePathname is null", async () => {
    // The discriminator is `usePathname() !== null`; without an App Router
    // context the React Router branch must be the one rendered.
    const { AppLink } = await import("@/components/AppLink");
    const { container } = render(
      <MemoryRouter initialEntries={["/l"]}>
        <AppLink href="/communities">go</AppLink>
      </MemoryRouter>
    );
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/communities");
  });
});

// ─── 1b. Migrated components emit real hrefs ────────────────────────────────
describe("migrated components render native links", () => {
  it("LegalPage renders absolute hrefs with no `to` attribute", async () => {
    const { LegalPage } = await import("@/components/LegalPage");
    // Wrapped in a router because the Vite runtime renders React Router's Link,
    // which requires a location context (always present in the real app).
    const { container } = render(
      <MemoryRouter initialEntries={["/privacy"]}>
        <LegalPage title="T" updated="now" intro="i" sections={[{ heading: "h", paragraphs: ["p"] }]} />
      </MemoryRouter>
    );
    const anchors = [...container.querySelectorAll("a")];
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      expect(href.startsWith("/")).toBe(true);
      expect(a.hasAttribute("to")).toBe(false);
      expect(href).not.toMatch(/undefined|\[object/);
    }
    const hrefs = anchors.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/privacy");
    expect(hrefs).toContain("/terms");
  });

  it("Leaderboard renders profile links with dynamic segments", async () => {
    const { default: Leaderboard } = await import("@/views/Leaderboard");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider>
            <MemoryRouter initialEntries={["/leaderboard"]}>
              <Leaderboard />
            </MemoryRouter>
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    for (const a of [...container.querySelectorAll("a")]) {
      expect(a.hasAttribute("to")).toBe(false);
      expect(a.getAttribute("href")).toMatch(/^\//);
    }
  });
});

// ─── 2. Dual-runtime pathname seam ──────────────────────────────────────────
describe("useCurrentPathname", () => {
  it("falls back to the React Router location when the Next router is absent", async () => {
    const { useCurrentPathname } = await import("@/hooks/useCurrentPathname");
    const { result } = renderHook(() => useCurrentPathname(), {
      wrapper: withRouter(["/tag/react"]),
    });
    // Outside the App Router `usePathname()` is null; the React Router location
    // (the Vite build's source of truth) must win.
    expect(result.current).toBe("/tag/react");
  });

});

// ─── 3. Adapter boundary guards ─────────────────────────────────────────────
const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const isTestFile = (p: string) => /\.test\.tsx?$/.test(p);

/** Files that were migrated to native Next.js navigation in Phase 0.3. */
const MIGRATED = [
  "components/LegalPage.tsx",
  "components/LeadCard.tsx",
  "components/UserHoverCard.tsx",
  "components/CommunityHoverCard.tsx",
  "components/FeedSidebar.tsx",
  "components/PostCard.tsx",
  "components/NavLink.tsx",
  "components/AppSidebar.tsx",
  "views/Landing.tsx",
  "views/Leaderboard.tsx",
  "views/Admin.tsx",
  "views/Applications.tsx",
  "views/Achievements.tsx",
  "views/Pipeline.tsx",
];

/**
 * The single deliberate exception: migrated components read the current path
 * through this hook, which falls back to React Router while the Vite build
 * exists. Deleting the fallback is migration step 7.
 */
const SEAM = "hooks/useCurrentPathname.ts";

/**
 * Production files still importing `react-router-dom` after Phase 0.3.
 *
 * These are intentionally left for later phases: navigation writers, view-level
 * `useLocation`/`useParams` consumers, and the auth/protected-route surface.
 * `views/Communities.tsx` additionally passes React Router `state` (the
 * `history.state` bridge), which has no native equivalent yet.
 * `src/lib/navigation.tsx` (the adapter itself) is excluded — it must resolve the
 * real package in the Vite build.
 */
const REMAINING_ADAPTER_CONSUMERS = [
  "App.tsx",
  "components/AppLayout.tsx",
  "components/AppLink.tsx",
  "components/ComingSoon.tsx",
  "components/ComposerBar.tsx",
  "components/NotificationBell.tsx",
  "components/PollWidget.tsx",
  "components/ProtectedRoute.tsx",
  "components/modals/CreateCommunityModal.tsx",
  "hooks/useCurrentPathname.ts",
  "views/Communities.tsx",
  "views/CommunityDetail.tsx",
  "views/CreateLead.tsx",
  "views/CreatePost.tsx",
  "views/Drafts.tsx",
  "views/ForgotPassword.tsx",
  "views/Index.tsx",
  "views/LeadDetail.tsx",
  "views/LeadsBoard.tsx",
  "views/Login.tsx",
  "views/MyReports.tsx",
  "views/NotFound.tsx",
  "views/Notifications.tsx",
  "views/Onboarding.tsx",
  "views/PostDetail.tsx",
  "views/Profile.tsx",
  "views/ResetPassword.tsx",
  "views/Signup.tsx",
  "views/TagFeed.tsx",
  "views/UserMeRedirect.tsx",
].sort();

/** Authentication / protected-route files Phase 0.3 must not touch. */
const PROTECTED = ["components/ProtectedRoute.tsx", "views/Login.tsx", "views/Signup.tsx"];

describe("adapter boundaries", () => {
  it("migrated files no longer import react-router-dom", () => {
    const offenders = MIGRATED.filter((rel) =>
      readFileSync(join(SRC, rel), "utf8").includes('from "react-router-dom"')
    );
    expect(offenders).toEqual([]);
  });

  it("migrated files use native navigation (directly or via the dual-runtime link)", () => {
    const missing = MIGRATED.filter((rel) => {
      const src = readFileSync(join(SRC, rel), "utf8");
      const usesNative = /from "next\/(link|navigation)"/.test(src);
      const usesSeam =
        src.includes("@/hooks/useCurrentPathname") || src.includes("@/components/AppLink");
      return !usesNative && !usesSeam;
    });
    expect(missing).toEqual([]);
  });

  it("keeps the remaining adapter consumers to the documented inventory", () => {
    // Scans production code only: tests intentionally render the real package.
    // This list is the Phase 0.3 "remaining dependencies" inventory. It may only
    // shrink as later phases migrate these files.
    const bridgers = walk(SRC)
      .filter((p) => !isTestFile(p))
      .map((p) => relative(SRC, p).replace(/\\/g, "/"))
      .filter((rel) => readFileSync(join(SRC, rel), "utf8").includes('from "react-router-dom"'))
      .filter((rel) => rel !== "lib/navigation.tsx")
      .sort();
    expect(bridgers).toEqual(REMAINING_ADAPTER_CONSUMERS);
  });

  it("leaves the auth and protected-route files untouched", () => {
    for (const rel of PROTECTED) {
      expect(readFileSync(join(SRC, rel), "utf8")).toContain("react-router-dom");
    }
  });

  it("keeps the compatibility layer available for unmigrated code", () => {
    const adapter = readFileSync(join(SRC, "lib/navigation.tsx"), "utf8");
    for (const api of ["Link", "NavLink", "useNavigate", "useLocation", "useParams", "useSearchParams", "Navigate"]) {
      expect(adapter).toContain(api);
    }
  });

  it("keeps react-router-dom as a dependency for the Vite build", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.dependencies["react-router-dom"]).toBeTruthy();
  });

  // Declared last on purpose: this test resets the module registry, which would
  // otherwise hand later tests a second copy of the React context.
  it("prefers usePathname when the App Router provides one", async () => {
    vi.resetModules();
    vi.doMock("next/navigation", async () => {
      const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
      return { ...actual, usePathname: () => "/b/developers" };
    });
    const { useCurrentPathname } = await import("@/hooks/useCurrentPathname");
    const { result } = renderHook(() => useCurrentPathname(), {
      wrapper: withRouter(["/ignored"]),
    });
    expect(result.current).toBe("/b/developers");
    vi.doUnmock("next/navigation");
    vi.resetModules();
  });
});
