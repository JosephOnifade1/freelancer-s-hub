/**
 * Phase 0.1 smoke test: the view components behind the Next.js App Router entry
 * points must render under React 19 without throwing, and the React Router
 * compatibility adapter must expose the same surface it did before the upgrade.
 *
 * The render is an SSR (`renderToString`) pass on purpose: every App Router page
 * mounts its view client-side only (`dynamic(..., { ssr: false })`), so anything
 * that touches `window`/`document` during render is a hydration hazard. This
 * catches that class of React 19 / browser-API regression. Views are wrapped in
 * `MemoryRouter` because Vitest resolves the real `react-router-dom` package,
 * while the Next build resolves it to `@/lib/navigation`.
 */
import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
    }),
  },
  isDemoMode: false,
}));

const renderView = (element: React.ReactElement) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToString(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <MemoryRouter>{element}</MemoryRouter>
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

describe("React 19 view rendering (Next.js 16 entry points)", () => {
  it("renders the anonymous landing page without touching browser APIs", async () => {
    const { default: Landing } = await import("@/views/Landing");
    const html = renderView(<Landing />);
    expect(html.length).toBeGreaterThan(500);
  });

  it("renders the leads board shell", async () => {
    const { default: LeadsBoard } = await import("@/views/LeadsBoard");
    const html = renderView(<LeadsBoard />);
    expect(html).toContain("Opportunities");
  });

  it("renders the login view (Radix + react-hook-form on React 19)", async () => {
    const { default: Login } = await import("@/views/Login");
    const html = renderView(<Login />);
    expect(html.toLowerCase()).toContain("sign");
  });
});

describe("NavLink adapter (className render props)", () => {
  it("never stringifies a className render prop into the class attribute", async () => {
    const { NavLink } = await import("@/lib/navigation");
    const html = renderToString(
      <NavLink to="/l" className={({ isActive }) => (isActive ? "active-link" : "idle-link")} />
    );
    expect(html).toContain("idle-link");
    expect(html).not.toContain("isActive");
    expect(html).not.toContain("&gt;");
  });
});

describe("react-router-dom compatibility adapter", () => {
  it("keeps the exported surface used by components", async () => {
    const nav = await import("@/lib/navigation");
    for (const name of [
      "Link",
      "NavLink",
      "useNavigate",
      "useLocation",
      "useParams",
      "useSearchParams",
      "Navigate",
      "MemoryRouter",
      "Routes",
      "Route",
    ]) {
      expect(nav).toHaveProperty(name);
    }
  });
});
