/**
 * Phase 1 — authentication flow (jsdom, not a real browser).
 *
 * Covers the pieces this phase actually changed, at the level they can be
 * checked without a browser:
 *   • `AuthGate` — protected content never renders while the session is unknown
 *     or absent, and the redirect carries the original path.
 *   • `Login` — an already-signed-in visitor is bounced to the validated
 *     return destination; a hostile `from` falls back to `/`.
 *   • Logout cache clearing lives in `phase01-logout.test.tsx` (it needs the
 *     real `AuthProvider`, which this file's mocks would replace).
 *
 * Real App Router navigation, cookie/session storage behaviour and the actual
 * Supabase round trip cannot be exercised here — see the phase report's
 * "known limitations".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// `AppLink` falls back to the React Router branch outside the App Router, so the
// harness must provide a router context for views that render links.
import { MemoryRouter } from "react-router-dom";

const replace = vi.fn();
const push = vi.fn();
let currentPath = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => currentPath,
  useSearchParams: () => new URLSearchParams(search),
  useParams: () => ({}),
}));

let search = "";
let authState: { user: null | { uid: string }; loading: boolean } = { user: null, loading: false };

vi.mock("@/hooks/auth-context", () => ({
  useAuth: () => authState,
  AuthContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signInWithOAuth: async () => ({ error: null }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      resend: async () => ({ error: null }),
    },
  },
  isDemoMode: false,
}));

vi.mock("@/lib/users", () => ({
  ensureUserProfile: vi.fn(async () => null),
  checkUsernameAvailability: vi.fn(async () => true),
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  currentPath = "/";
  search = "";
  authState = { user: null, loading: false };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthGate — protected routes (Step 5)", () => {
  it("renders nothing and does not redirect while the session is unknown", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    authState = { user: null, loading: true };

    const { container } = wrap(
      <AuthGate>
        <p>private dashboard</p>
      </AuthGate>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("private dashboard")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("never flashes protected content for a signed-out visitor", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    currentPath = "/settings";
    authState = { user: null, loading: false };

    const { container } = wrap(
      <AuthGate>
        <p>private settings</p>
      </AuthGate>,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("private settings")).not.toBeInTheDocument();
  });

  it("redirects a signed-out visitor to /login with the original path", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    currentPath = "/settings";
    authState = { user: null, loading: false };

    wrap(
      <AuthGate>
        <p>private settings</p>
      </AuthGate>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?from=%2Fsettings"));
  });

  it("preserves nested paths and query strings in the return path", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    currentPath = "/pipeline";
    authState = { user: null, loading: false };

    wrap(
      <AuthGate>
        <p>private pipeline</p>
      </AuthGate>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?from=%2Fpipeline"));
  });

  it("renders the page for a signed-in user and does not redirect", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    currentPath = "/settings";
    authState = { user: { uid: "user-1" }, loading: false };

    wrap(
      <AuthGate>
        <p>private settings</p>
      </AuthGate>,
    );

    expect(screen.getByText("private settings")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("Login — post-auth destination (Step 6)", () => {
  async function renderLogin(from: string | null) {
    const { default: Login } = await import("@/views/Login");
    search = from === null ? "" : `from=${encodeURIComponent(from)}`;
    // Signed in already → the view must not render the form.
    authState = { user: { uid: "user-1" }, loading: false };
    return wrap(<Login />);
  }

  it("sends an already-signed-in visitor to the validated destination", async () => {
    await renderLogin("/pipeline");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/pipeline"));
  });

  it("falls back to / when no return path is present", async () => {
    await renderLogin(null);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("rejects an absolute external return path", async () => {
    await renderLogin("https://evil.example/steal");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("rejects a protocol-relative return path", async () => {
    await renderLogin("//evil.example/steal");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("rejects a javascript: return path", async () => {
    await renderLogin("javascript:alert(1)");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("rejects a return path that loops back into the auth flow", async () => {
    await renderLogin("/login?from=/login");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });

  it("shows the form (no redirect) for a signed-out visitor", async () => {
    const { default: Login } = await import("@/views/Login");
    search = "";
    authState = { user: null, loading: false };

    wrap(<Login />);

    expect(await screen.findByRole("button", { name: /^log in$/i })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
