/**
 * Phase 1 — session architecture + logout (Steps 4 & 9).
 *
 * Uses the *real* `AuthProvider` with a scripted Supabase stub, so the tested
 * behaviour is the provider's own: session restoration, a single session fetch,
 * identity changes clearing the cache, and logout dropping private cached data
 * before the redirect.
 *
 * jsdom only. Supabase's real client (persistence, token refresh, network) is
 * not exercised here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Session = { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null;

let initialSession: Session = null;
let sessionFetchCount = 0;
let authListener: ((event: string, session: Session) => void) | null = null;

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => {
        sessionFetchCount += 1;
        return { data: { session: initialSession }, error: null };
      },
      onAuthStateChange: (cb: (event: string, session: Session) => void) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => { authListener = null; } } } };
      },
      signOut: async () => {
        initialSession = null;
        return { error: null };
      },
    },
  },
  isDemoMode: false,
}));

vi.mock("@/lib/users", () => ({
  ensureUserProfile: vi.fn(async () => null),
}));

const signedInUser = { id: "user-1", email: "a@example.test", user_metadata: { display_name: "Ada" } };

function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seed private-looking data the way a warm session would.
  client.setQueryData(["profile", "user-1"], { uid: "user-1", username: "ada" });
  client.setQueryData(["notifications", "user-1"], [{ id: "n1" }]);
  return client;
}

async function mountProvider() {
  const { AuthProvider } = await import("@/hooks/useAuth");
  const { useAuth } = await import("@/hooks/auth-context");
  const client = makeClient();

  let ctx: ReturnType<typeof useAuth> | null = null;
  const Probe = () => {
    ctx = useAuth();
    return <span data-testid="state">{ctx!.loading ? "loading" : ctx!.user ? "signed-in" : "signed-out"}</span>;
  };

  const utils = render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return { ...utils, client, ctx: () => ctx! };
}

beforeEach(() => {
  initialSession = null;
  sessionFetchCount = 0;
  authListener = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("session restoration (Step 4)", () => {
  it("restores an existing session on mount", async () => {
    initialSession = { user: signedInUser };
    const { ctx } = await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in"));
    expect(ctx().user?.uid).toBe("user-1");
    expect(ctx().user?.displayName).toBe("Ada");
  });

  it("resolves to signed-out when there is no stored session", async () => {
    const { ctx } = await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-out"));
    expect(ctx().user).toBeNull();
  });

  it("fetches the session exactly once (no duplicate session reads)", async () => {
    initialSession = { user: signedInUser };
    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in"));
    expect(sessionFetchCount).toBe(1);
  });

  it("keeps children unmounted until the session is known (no auth flicker)", async () => {
    initialSession = { user: signedInUser };
    await mountProvider();

    // First paint: provider holds children back while `loading` is true.
    expect(screen.queryByTestId("state")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("state")).toBeInTheDocument());
  });

  it("clears cached private data when the signed-in identity changes", async () => {
    initialSession = { user: signedInUser };
    const { client } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in"));
    expect(client.getQueryData(["profile", "user-1"])).toBeTruthy();

    const other = { id: "user-2", email: "b@example.test", user_metadata: {} };
    await act(async () => {
      authListener?.("SIGNED_IN", { user: other });
    });

    expect(client.getQueryData(["profile", "user-1"])).toBeUndefined();
  });
});

describe("logout (Step 9)", () => {
  it("drops the session and clears private cached data", async () => {
    initialSession = { user: signedInUser };
    const { client, ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in"));
    expect(client.getQueryData(["notifications", "user-1"])).toBeTruthy();

    await act(async () => {
      await ctx().signOut();
    });

    // Session gone...
    expect(ctx().user).toBeNull();
    // ...and no previous-account rows survive for the next visitor.
    expect(client.getQueryData(["profile", "user-1"])).toBeUndefined();
    expect(client.getQueryData(["notifications", "user-1"])).toBeUndefined();
  });

  it("still clears the cache if the sign-out call fails", async () => {
    initialSession = { user: signedInUser };
    const { client, ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in"));

    const { supabase } = await import("@/lib/supabase");
    vi.spyOn(supabase.auth, "signOut").mockRejectedValueOnce(new Error("network down"));

    await act(async () => {
      await expect(ctx().signOut()).rejects.toThrow("network down");
    });

    expect(client.getQueryData(["profile", "user-1"])).toBeUndefined();
  });
});
