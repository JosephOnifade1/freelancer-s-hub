/**
 * Phase 2B.4 — a provisioning failure must not read as an unauthenticated session.
 *
 * `AuthGate` is the component that actually decides "can this private subtree
 * paint", so the distinction has to hold *here*, not just in the provider. These
 * tests render the real gate and the real notice against a scripted context, so
 * the assertion is about the render decision rather than an internal flag.
 *
 * jsdom. No Supabase client, no network, no database.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const replace = vi.fn();
let currentPath = "/settings";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => currentPath,
  useSearchParams: () => new URLSearchParams(""),
  useParams: () => ({}),
}));

type AuthState = {
  user: { uid: string; displayName: string | null; photoURL: string | null } | null;
  loading: boolean;
  provisioning: { status: "pending" | "ready" | "failed"; reason?: string; attempts: number };
  retryProvisioning: () => void;
  isProvisioned: boolean;
  signOut: () => Promise<void>;
};

let authState: AuthState;

vi.mock("@/hooks/auth-context", () => ({
  useAuth: () => authState,
  AuthContext: { Provider: ({ children }: { children: React.ReactNode }) => children },
}));

function baseState(overrides: Partial<AuthState> = {}): AuthState {
  return {
    user: { uid: "user-1", displayName: "Ada", photoURL: null },
    loading: false,
    provisioning: { status: "ready", attempts: 1 },
    retryProvisioning: vi.fn(),
    isProvisioned: true,
    signOut: vi.fn(async () => {}),
    ...overrides,
  };
}

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
  currentPath = "/settings";
  authState = baseState();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("AuthGate with a provisioning failure", () => {
  it("renders the protected subtree: the user is signed in", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    authState = baseState({
      provisioning: { status: "failed", reason: "unavailable", attempts: 2 },
      isProvisioned: false,
    });

    wrap(
      <AuthGate>
        <p>private dashboard</p>
      </AuthGate>,
    );

    // A recoverable provisioning error must not hide the whole application.
    expect(screen.getByText("private dashboard")).toBeInTheDocument();
  });

  it("does not redirect to login", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    authState = baseState({
      provisioning: { status: "failed", reason: "unavailable", attempts: 2 },
      isProvisioned: false,
    });

    wrap(
      <AuthGate>
        <p>private dashboard</p>
      </AuthGate>,
    );

    expect(replace).not.toHaveBeenCalled();
  });

  it("still holds private content while the profile is pending", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    authState = baseState({
      provisioning: { status: "pending", attempts: 0 },
      isProvisioned: false,
    });

    wrap(
      <AuthGate>
        <p>private dashboard</p>
      </AuthGate>,
    );

    // Pending is not a failure; it is a brief wait, and the session is known.
    expect(screen.getByText("private dashboard")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("still redirects a genuinely signed-out visitor", async () => {
    const { AuthGate } = await import("@/components/AuthGate");
    authState = baseState({
      user: null,
      provisioning: { status: "pending", attempts: 0 },
      isProvisioned: false,
    });

    wrap(
      <AuthGate>
        <p>private dashboard</p>
      </AuthGate>,
    );

    expect(screen.queryByText("private dashboard")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalled();
  });
});

describe("ProfileProvisioningNotice", () => {
  it("says nothing while ready", async () => {
    const { ProfileProvisioningNotice } = await import("@/components/ProfileProvisioningNotice");
    wrap(<ProfileProvisioningNotice />);

    expect(screen.queryByTestId("profile-provisioning-notice")).not.toBeInTheDocument();
  });

  it("says nothing while pending — a brief wait is not a problem to report", async () => {
    const { ProfileProvisioningNotice } = await import("@/components/ProfileProvisioningNotice");
    authState = baseState({ provisioning: { status: "pending", attempts: 0 }, isProvisioned: false });

    wrap(<ProfileProvisioningNotice />);

    expect(screen.queryByTestId("profile-provisioning-notice")).not.toBeInTheDocument();
  });

  it("explains the recoverable failure without leaking infrastructure detail", async () => {
    const { ProfileProvisioningNotice } = await import("@/components/ProfileProvisioningNotice");
    authState = baseState({
      provisioning: { status: "failed", reason: "unavailable", attempts: 2 },
      isProvisioned: false,
    });

    wrap(<ProfileProvisioningNotice />);

    const notice = screen.getByTestId("profile-provisioning-notice");
    expect(notice).toHaveTextContent(/profile isn.t ready yet/i);
    expect(notice).toHaveTextContent(/temporarily unavailable/i);
    expect(notice.textContent).not.toMatch(/postgres|neon|drizzle|503|500|database|sql/i);
  });

  it("offers a retry that calls the provided handler", async () => {
    const { ProfileProvisioningNotice } = await import("@/components/ProfileProvisioningNotice");
    const retryProvisioning = vi.fn();
    authState = baseState({
      provisioning: { status: "failed", reason: "error", attempts: 1 },
      isProvisioned: false,
      retryProvisioning,
    });

    wrap(<ProfileProvisioningNotice />);

    screen.getByRole("button", { name: /retry/i }).click();
    expect(retryProvisioning).toHaveBeenCalledTimes(1);
  });

  it("does not claim the user is signed out", async () => {
    const { ProfileProvisioningNotice } = await import("@/components/ProfileProvisioningNotice");
    authState = baseState({
      provisioning: { status: "failed", reason: "unauthenticated", attempts: 1 },
      isProvisioned: false,
    });

    wrap(<ProfileProvisioningNotice />);

    const notice = screen.getByTestId("profile-provisioning-notice");
    expect(notice).toHaveTextContent(/still signed in/i);
  });

  it("renders nothing for an anonymous visitor", async () => {
    const { ProfileProvisioningNotice } = await import("@/components/ProfileProvisioningNotice");
    authState = baseState({
      user: null,
      provisioning: { status: "failed", reason: "error", attempts: 1 },
      isProvisioned: false,
    });

    wrap(<ProfileProvisioningNotice />);

    expect(screen.queryByTestId("profile-provisioning-notice")).not.toBeInTheDocument();
  });
});
