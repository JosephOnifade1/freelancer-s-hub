/**
 * Phase 0.2 — interaction smoke test (jsdom, not a real browser).
 *
 * Mounts the real components with the real providers and the real
 * react-router-dom compatibility adapter, then asserts on the resulting DOM:
 * valid link targets, resolved active states, working dropdown/dialog/tooltip/
 * toast/theme controls, and a clean React 19 console. It cannot check pixels,
 * fonts, motion timing or real App Router navigation between route segments —
 * those remain human verification on the preview URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      update: () => ({ eq: () => ({ select: async () => ({ data: [], error: null }) }) }),
    }),
  },
  isDemoMode: false,
}));

// The compatibility adapter talks to next/navigation + next/link; jsdom has no
// App Router, so provide the minimal contract Next gives it.
const routerCalls: { type: string; url: string }[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (url: string) => routerCalls.push({ type: "push", url }),
    replace: (url: string) => routerCalls.push({ type: "replace", url }),
    back: () => routerCalls.push({ type: "back", url: "" }),
    forward: () => routerCalls.push({ type: "forward", url: "" }),
  }),
  usePathname: () => "/current",
  useSearchParams: () => new URLSearchParams("a=1"),
  useParams: () => ({ id: "42" }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const consoleSpy = { errors: [] as string[], warns: [] as string[] };

beforeEach(() => {
  consoleSpy.errors = [];
  consoleSpy.warns = [];
  vi.spyOn(console, "error").mockImplementation((...args) => {
    consoleSpy.errors.push(args.map(String).join(" "));
  });
  vi.spyOn(console, "warn").mockImplementation((...args) => {
    consoleSpy.warns.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const wrap = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

const reactErrors = () =>
  consoleSpy.errors.filter(
    (e) =>
      // React 19 hydration / update / render diagnostics
      /Warning:|hydrat|did not match|Cannot update|not wrapped in act|Each child in a list|Maximum update|is not a function|Invalid hook call/i.test(
        e
      )
  );

describe("navigation integrity", () => {
  it("renders sidebar links with resolvable paths and real class strings", async () => {
    const { AppSidebar } = await import("@/components/AppSidebar");
    const { container } = wrap(<AppSidebar />);
    const anchors = [...container.querySelectorAll("a[href]")];
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      // No undefined/[object Object]/render-prop leakage into the DOM
      expect(href).not.toMatch(/undefined|\[object|isActive/);
      expect(href.startsWith("/")).toBe(true);
      expect(anchor.getAttribute("class") || "").not.toMatch(/isActive|=>/);
    }
    expect(reactErrors()).toEqual([]);
  });

  it("marks the current route active in the sidebar", async () => {
    const { AppSidebar } = await import("@/components/AppSidebar");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider>
            <MemoryRouter initialEntries={["/l"]}>
              <AppSidebar />
            </MemoryRouter>
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    const leadLink = container.querySelector('a[href="/l"]');
    expect(leadLink).not.toBeNull();
    expect(leadLink!.className).toMatch(/bg-brand/);
    const otherLink = container.querySelector('a[href="/communities"]');
    expect(otherLink!.className).not.toMatch(/bg-brand/);
  });

  it("breadcrumbs build navigable hrefs for dynamic routes", async () => {
    const { Breadcrumbs } = await import("@/components/Breadcrumbs");
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SidebarProvider>
            <MemoryRouter initialEntries={["/b/developers/p/abc"]}>
              <Breadcrumbs />
            </MemoryRouter>
          </SidebarProvider>
        </TooltipProvider>
      </QueryClientProvider>
    );
    const hrefs = [...container.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
    for (const href of hrefs) expect(href).toMatch(/^\/[a-z/-]*$/i);
    expect(reactErrors()).toEqual([]);
  });

  it("unknown route renders the in-app 404 view", async () => {
    const { default: NotFound } = await import("@/views/NotFound");
    wrap(<NotFound />);
    // The view renders a 404 heading plus "page not found" copy.
    expect(screen.getAllByText(/404|not found/i).length).toBeGreaterThan(0);
  });
});

describe("interactive primitives (React 19 compatibility)", () => {
  it("opens a Radix dialog", async () => {
    const { Dialog, DialogContent, DialogTitle, DialogDescription } = await import("@/components/ui/dialog");
    wrap(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Smoke dialog</DialogTitle>
          <DialogDescription>body</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(await screen.findByText("Smoke dialog")).toBeInTheDocument();
  });

  it("opens a controlled dropdown menu and selects an item", async () => {
    const dd = await import("@/components/ui/dropdown-menu");
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    // jsdom has no pointer-capture, so drive the controlled open state the way
    // Radix would after a real click; this still exercises the portal, focus
    // scope and item rendering.
    wrap(
      <dd.DropdownMenu open onOpenChange={onOpenChange}>
        <dd.DropdownMenuTrigger>menu</dd.DropdownMenuTrigger>
        <dd.DropdownMenuContent>
          <dd.DropdownMenuItem onSelect={onSelect}>Item one</dd.DropdownMenuItem>
        </dd.DropdownMenuContent>
      </dd.DropdownMenu>
    );
    const item = await screen.findByRole("menuitem", { name: "Item one" });
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalled();
  });

  it("opens a Radix tooltip on focus", async () => {
    const { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } = await import("@/components/ui/tooltip");
    wrap(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>trigger</TooltipTrigger>
          <TooltipContent>tip body</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    fireEvent.focus(screen.getByText("trigger"));
    await waitFor(() => expect(screen.getAllByText("tip body").length).toBeGreaterThan(0));
  });

  it("renders a toast into the document", async () => {
    const { Toaster } = await import("@/components/ui/sonner");
    const { toast } = await import("sonner");
    wrap(
      <>
        <Toaster />
        <button onClick={() => toast.success("Smoke toast")}>fire</button>
      </>
    );
    fireEvent.click(screen.getByText("fire"));
    await waitFor(() => expect(screen.getAllByText("Smoke toast").length).toBeGreaterThan(0));
  });

  it("toggles a Radix switch", async () => {
    const { Switch } = await import("@/components/ui/switch");
    const onChange = vi.fn();
    wrap(<Switch aria-label="toggle" onCheckedChange={onChange} />);
    fireEvent.click(screen.getByLabelText("toggle"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("switches theme through the theme hook", async () => {
    const { useTheme, initTheme } = await import("@/hooks/useTheme");
    localStorage.setItem("borynx-theme", "dark");
    initTheme();
    const Probe = () => {
      const { theme, setTheme } = useTheme();
      return (
        <button onClick={() => setTheme("light")} data-testid="theme">
          {theme}
        </button>
      );
    };
    wrap(<Probe />);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    fireEvent.click(screen.getByTestId("theme"));
    await waitFor(() => expect(document.documentElement.classList.contains("theme-light")).toBe(true));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("borynx-theme")).toBe("light");
  });
});

describe("editor dependency (TipTap) loads in a DOM", () => {
  it("mounts the editor view module without throwing", async () => {
    const mod = await import("@/components/editor/Editor");
    expect(Object.keys(mod).length).toBeGreaterThan(0);
    const tiptap = await import("@tiptap/react");
    expect(typeof tiptap.useEditor).toBe("function");
    expect(typeof (tiptap as unknown as { EditorContent?: unknown }).EditorContent).toBe("object");
  });

  it("renders markdown without browser-only APIs failing", async () => {
    const { MarkdownRenderer } = await import("@/components/editor/MarkdownRenderer");
    const { container } = wrap(<MarkdownRenderer content={"# Hello\n\n**bold** and `code`"} />);
    expect(container.textContent).toContain("Hello");
    expect(reactErrors()).toEqual([]);
  });
});

describe("console hygiene during mounts", () => {
  it("mounts representative views without React errors", async () => {
    const views = await Promise.all([
      import("@/views/Index"),
      import("@/views/Landing"),
      import("@/views/LeadsBoard"),
      import("@/views/Communities"),
      import("@/views/Login"),
      import("@/views/Signup"),
    ]);
    for (const view of views) {
      const { unmount } = wrap(<view.default />);
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
      unmount();
    }
    const errors = reactErrors();
    expect(errors).toEqual([]);
  });
});

describe("adapter: React Router `state` bridge (post-login redirect)", () => {
  it("carries Link state through history.state into useLocation", async () => {
    const { Link, useLocation } = await import("@/lib/navigation");
    const Probe = () => {
      const location = useLocation();
      return (
        <div>
          <Link to="/login" state={{ from: { pathname: "/l/post" } }}>
            signin
          </Link>
          <span data-testid="state">{JSON.stringify(location.state)}</span>
        </div>
      );
    };
    wrap(<Probe />);
    expect(screen.getByTestId("state")).toHaveTextContent("null");
    fireEvent.click(screen.getByText("signin"));
    // The state must be readable before/at navigation, so the login view can
    // bounce the user back instead of always landing on "/".
    expect(window.history.state?.__borynx_nav_state).toEqual({ from: { pathname: "/l/post" } });
    const { postAuthRedirect } = await import("@/lib/auth");
    expect(postAuthRedirect(window.history.state.__borynx_nav_state)).toBe("/l/post");
  });

  it("useLocation exposes a leading-? search string", async () => {
    const { useLocation } = await import("@/lib/navigation");
    const Probe = () => {
      const location = useLocation();
      return <span data-testid="loc">{JSON.stringify({ p: location.pathname, s: location.search })}</span>;
    };
    wrap(<Probe />);
    expect(screen.getByTestId("loc")).toHaveTextContent(/"s":"\?a=1"/);
  });

  it("useParams surfaces dynamic segments from next/navigation", async () => {
    const { useParams } = await import("@/lib/navigation");
    const Probe = () => {
      const params = useParams<{ id: string }>();
      return <span data-testid="params">{params.id}</span>;
    };
    wrap(<Probe />);
    expect(screen.getByTestId("params")).toHaveTextContent("42");
  });

  it("useNavigate forwards push/replace/back to the Next router", async () => {
    const { useNavigate } = await import("@/lib/navigation");
    routerCalls.length = 0;
    const Probe = () => {
      const navigate = useNavigate();
      return (
        <div>
          <button onClick={() => navigate("/x")}>push</button>
          <button onClick={() => navigate("/y", { replace: true })}>replace</button>
          <button onClick={() => navigate(-1)}>back</button>
        </div>
      );
    };
    wrap(<Probe />);
    fireEvent.click(screen.getByText("push"));
    fireEvent.click(screen.getByText("replace"));
    fireEvent.click(screen.getByText("back"));
    expect(routerCalls).toEqual([
      { type: "push", url: "/x" },
      { type: "replace", url: "/y" },
      { type: "back", url: "" },
    ]);
  });

  it("setSearchParams writes the query string onto the current path", async () => {
    const { useSearchParams } = await import("@/lib/navigation");
    routerCalls.length = 0;
    const Probe = () => {
      const [, setSearchParams] = useSearchParams();
      return <button onClick={() => setSearchParams({ feed: "following" })}>apply</button>;
    };
    wrap(<Probe />);
    fireEvent.click(screen.getByText("apply"));
    expect(routerCalls).toEqual([{ type: "push", url: "/current?feed=following" }]);
  });
});

describe("forms submit through the app's own handler (no native reload)", () => {
  it("signup form intercepts submit instead of letting the browser navigate", async () => {
    const { default: Signup } = await import("@/views/Signup");
    const { container } = wrap(<Signup />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const event = new window.Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reactErrors()).toEqual([]);
  });

  it("login form intercepts submit", async () => {
    const { default: Login } = await import("@/views/Login");
    const { container } = wrap(<Login />);
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const event = new window.Event("submit", { bubbles: true, cancelable: true });
    form!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(reactErrors()).toEqual([]);
  });
});

describe("cross-route link targets resolve to a real App Router route", () => {
  it("every static anchor target exists as a route or is a known alias", async () => {
    const { APP_ROUTES, matchesAppRoute } = await import("@/lib/route-parity");
    const { AppSidebar } = await import("@/components/AppSidebar");
    const { container } = wrap(<AppSidebar />);
    const missing: string[] = [];
    for (const anchor of [...container.querySelectorAll("a[href]")]) {
      const href = (anchor.getAttribute("href") || "").split("?")[0].replace(/\/$/, "") || "/";
      if (!matchesAppRoute(href)) missing.push(href);
    }
    expect(APP_ROUTES.length).toBeGreaterThanOrEqual(31);
    expect(missing).toEqual([]);
  });
});

describe("route parity guard (App Router ↔ inventory)", () => {
  it("the declared inventory matches src/app/page.tsx files exactly", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const walk = (dir: string, acc: string[] = []): string[] => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (entry.name === "page.tsx") acc.push(full);
      }
      return acc;
    };
    const fromDisk = walk("src/app")
      .map((file) => {
        let route = file.replace(/^src\/app/, "").replace(/\/page\.tsx$/, "");
        route = route.replace(/^\/\([^)]*\)/, "");
        return route || "/";
      })
      .sort();
    const { APP_ROUTES } = await import("@/lib/route-parity");
    expect([...APP_ROUTES].sort()).toEqual(fromDisk);
  });

  it("every React Router redirect in App.tsx has a Next equivalent", async () => {
    const fs = await import("node:fs");
    const appTsx = fs.readFileSync("src/App.tsx", "utf8");
    const redirectPaths = [...appTsx.matchAll(/<Route path="([^"]+)"\s+element=\{<[^>]*Navigate/g)].map((m) => m[1]);
    expect(redirectPaths.length).toBeGreaterThan(0);
    const { matchesAppRoute } = await import("@/lib/route-parity");
    const unmatched = redirectPaths.filter((p) => !matchesAppRoute(p));
    expect(unmatched).toEqual([]);
  });
});

describe("redirect-only aliases (React Router Navigate parity)", () => {
  it("each redirect route forwards to the destination declared in App.tsx", async () => {
    const { REDIRECT_ROUTES } = await import("@/lib/route-parity");
    const { RedirectTo } = await import("@/lib/redirect-to");
    const pushed: string[] = [];
    // next/navigation is mocked at module scope in this file; re-point it.
    const nav = await import("next/navigation");
    vi.spyOn(nav, "useRouter").mockReturnValue({
      replace: (url: string) => pushed.push(url),
      push: (url: string) => pushed.push(url),
      back: () => {},
      forward: () => {},
      refresh: () => {},
      prefetch: () => {},
    } as never);

    for (const { redirectsTo } of REDIRECT_ROUTES) {
      pushed.length = 0;
      const { unmount } = wrap(<RedirectTo href={redirectsTo} />);
      await waitFor(() => expect(pushed).toEqual([redirectsTo]));
      unmount();
    }
  });
});
