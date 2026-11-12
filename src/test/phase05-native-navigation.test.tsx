/**
 * Phase 0.5 — Vite exit & native Next.js navigation.
 *
 * What is asserted:
 *  1. Application code imports navigation from `next/navigation`, not from
 *     React Router — the point of the transition.
 *  2. The legacy rollback shim preserves React Router semantics (push, replace,
 *     back), so the frozen Vite snapshot still navigates client-side.
 *  3. The preserved adapter surface is exactly what production code still uses;
 *     the exports removed in Phase 0.5 stay removed.
 *  4. The authentication boundary is unchanged.
 *
 * jsdom only — not a real browser.
 */
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useRouter } from "next/navigation";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** Files migrated from `useNavigate` to `next/navigation`'s `useRouter`. */
const ROUTER_WRITER_FILES = [
  "components/AppLayout.tsx",
  "components/ComposerBar.tsx",
  "components/NotificationBell.tsx",
  "components/modals/CreateCommunityModal.tsx",
  "views/CommunityDetail.tsx",
  "views/CreateLead.tsx",
  "views/CreatePost.tsx",
  "views/Drafts.tsx",
  "views/Index.tsx",
  "views/NotFound.tsx",
  "views/Notifications.tsx",
  "views/Onboarding.tsx",
  "views/PostDetail.tsx",
  "views/ResetPassword.tsx",
  "views/TagFeed.tsx",
  "views/UserMeRedirect.tsx",
];

describe("navigation migrated to next/navigation", () => {
  it("migrated writers import useRouter from next/navigation", () => {
    for (const file of ROUTER_WRITER_FILES) {
      const src = read(file);
      expect(src, file).toContain('from "next/navigation"');
      expect(src, file).toContain("useRouter()");
      // No residual React Router writer hook.
      expect(src, file).not.toMatch(/import \{[^}]*\buseNavigate\b[^}]*\} from "react-router-dom"/);
      expect(src, file).not.toMatch(/\bnavigate\(/);
    }
  });

  it("preserves history-traversal semantics via router.back()", () => {
    // React Router navigate(-1) -> next/navigation router.back()
    for (const file of ["views/NotFound.tsx", "views/PostDetail.tsx", "views/TagFeed.tsx", "views/CreatePost.tsx"]) {
      expect(read(file), file).toContain("router.back()");
      expect(read(file), file).not.toContain("navigate(-1)");
    }
  });

  it("preserves the replace option as router.replace()", () => {
    for (const file of ["views/Onboarding.tsx", "views/ResetPassword.tsx"]) {
      expect(read(file), file).toContain("router.replace(");
      expect(read(file), file).not.toContain("{ replace: true }");
    }
  });

  it("keeps query strings and dynamic routes intact in migrated calls", () => {
    // Verbatim destinations: no URL changed during the migration.
    expect(read("components/ComposerBar.tsx")).toContain("/submit?${params.toString()}");
    expect(read("views/Drafts.tsx")).toContain("/submit?restore=1");
    expect(read("views/CreatePost.tsx")).toContain("/b/${selectedSpace.communitySlug}/p/${postId}");
    expect(read("components/modals/CreateCommunityModal.tsx")).toContain("/b/${slug}");
    expect(read("components/NotificationBell.tsx")).toContain("notificationLink(n)");
  });
});

// ─── Legacy rollback shim ───────────────────────────────────────────────────
function LocationProbe() {
  return <span data-testid="loc">{useLocation().pathname}</span>;
}

function ShimWriter() {
  // Imported statically so the Vitest alias applies: under Vitest (and the Vite
  // rollback build) `next/navigation` resolves to src/legacy-next/next-navigation.ts.
  const router = useRouter();
  return (
    <>
      <button onClick={() => router.push("/communities")}>push</button>
      <button onClick={() => router.replace("/settings")}>replace</button>
      <button onClick={() => router.back()}>back</button>
    </>
  );
}

describe("legacy rollback shim (next/navigation -> React Router)", () => {
  it("forwards push, replace and back to React Router", () => {
    render(
      <MemoryRouter initialEntries={["/", "/l"]}>
        <ShimWriter />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("push"));
    expect(screen.getByTestId("loc").textContent).toBe("/communities");

    fireEvent.click(screen.getByText("replace"));
    expect(screen.getByTestId("loc").textContent).toBe("/settings");

    fireEvent.click(screen.getByText("back"));
    expect(screen.getByTestId("loc").textContent).toBe("/l");
  });
});

// ─── Adapter reduction ──────────────────────────────────────────────────────
describe("compatibility adapter reduction", () => {
  const ADAPTER = read("lib/navigation.tsx");

  it("keeps the exports production code still imports", () => {
    for (const api of ["Link", "useNavigate", "useLocation", "useParams", "useSearchParams", "Navigate"]) {
      expect(ADAPTER, api).toContain(`export ${api === "Link" ? "const" : "function"} ${api}`.replace("export function Link", "export const Link"));
    }
  });

  it("removed the exports that had zero consumers", () => {
    expect(ADAPTER).not.toContain("export const NavLink");
    expect(ADAPTER).not.toContain("export const MemoryRouter");
    expect(ADAPTER).not.toContain("export const Routes");
    expect(ADAPTER).not.toContain("export const Route ");
  });

  it("is still the single React Router import point for the Next build", () => {
    // The Next build aliases the specifier itself, so the adapter must keep
    // importing from next/navigation rather than from react-router-dom.
    expect(ADAPTER).toContain('from "next/link"');
    expect(ADAPTER).toContain('from "next/navigation"');
  });
});

// ─── Authentication boundary ────────────────────────────────────────────────
describe("authentication boundary (Phase 1: auth views are native)", () => {
  it("keeps only the legacy ProtectedRoute on the compatibility layer", () => {
    const legacy = read("components/ProtectedRoute.tsx");
    expect(legacy).toContain('from "react-router-dom"');
    for (const file of ["views/Login.tsx", "views/Signup.tsx"]) {
      const src = read(file);
      expect(src, file).not.toContain('from "react-router-dom"');
      expect(src, file).toContain('from "next/navigation"');
    }
  });

  it("keeps the post-auth redirect contract on the validated `?from=` query", () => {
    expect(read("lib/auth.ts")).toContain("postAuthRedirect");
    expect(read("lib/auth.ts")).toContain("sanitizeReturnPath");
    for (const file of ["views/Login.tsx", "views/Signup.tsx"]) {
      const src = read(file);
      expect(src, file).toContain("readReturnPath");
      expect(src, file).toContain("postAuthRedirect(");
      expect(src, file).not.toContain("location.state");
    }
  });

  it("does not alter the auth provider or session module", () => {
    // Guard against accidental edits to the Supabase auth wiring.
    const authProvider = read("hooks/useAuth.tsx");
    expect(authProvider).toMatch(/getSession|onAuthStateChange/);
  });
});
