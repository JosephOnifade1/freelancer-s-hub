/**
 * Phase 2B.4 — recoverable provisioning, exercised through the real `AuthProvider`.
 *
 * Uses jsdom with a scripted Supabase stub and a scripted provisioning endpoint,
 * following the Phase 1 convention in `phase01-logout.test.tsx`: the *provider's
 * own* logic runs, only the network edges are faked.
 *
 * What is proven here: session state and provisioning state are independent, a
 * database failure never signs the user out, retries work, concurrent and
 * repeated events do not duplicate work, and logout clears both.
 *
 * What is NOT proven here: anything about Neon. See the phase report §4. The
 * database half of provisioning is covered against local PostgreSQL in
 * `tests/db/identity-integration.test.ts`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Session = { user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | null;

let initialSession: Session = null;
let authListener: ((event: string, session: Session) => void) | null = null;

const signOut = vi.fn(async () => {
  initialSession = null;
  return { error: null };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: initialSession }, error: null }),
      onAuthStateChange: (cb: (event: string, session: Session) => void) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe: () => { authListener = null; } } } };
      },
      signOut: () => signOut(),
    },
  },
  isDemoMode: false,
}));

/** Scripted provisioning endpoint. Each entry is consumed per call. */
type ProvisionReply = { status: number } | "network-error";
let replies: ProvisionReply[] = [];
let provisionCalls = 0;
/** When set, calls hang until this resolves — used for concurrency tests. */
let gate: Promise<void> | null = null;

vi.mock("@/lib/profile-provisioning", async () => {
  const actual = await vi.importActual<typeof import("@/lib/profile-provisioning")>(
    "@/lib/profile-provisioning",
  );
  return {
    ...actual,
    provisionProfileOnServer: vi.fn(async () => {
      provisionCalls += 1;
      if (gate) await gate;
      const reply = replies.shift() ?? { status: 200 };
      if (reply === "network-error") return { status: "error" };
      if (reply.status === 201) return { status: "created" };
      if (reply.status === 200) return { status: "existing" };
      if (reply.status === 401) return { status: "unauthenticated" };
      if (reply.status === 503) return { status: "unavailable" };
      return { status: "error" };
    }),
  };
});

const signedInUser = { id: "user-1", email: "a@example.test", user_metadata: { display_name: "Ada" } };

function makeClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
    return (
      <span data-testid="state">
        {ctx!.loading ? "loading" : ctx!.user ? "signed-in" : "signed-out"}|
        {ctx!.provisioning.status}
        {ctx!.provisioning.reason ? `:${ctx!.provisioning.reason}` : ""}
      </span>
    );
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
  authListener = null;
  replies = [];
  provisionCalls = 0;
  gate = null;
  signOut.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("auth succeeds and provisioning succeeds", () => {
  it("publishes the session and reaches ready", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 201 }];

    const { ctx } = await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|ready"));
    expect(ctx().isProvisioned).toBe(true);
    expect(ctx().user?.uid).toBe("user-1");
    expect(provisionCalls).toBe(1);
  });

  it("an already-provisioned user (200 existing) is equally ready", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 200 }];

    const { ctx } = await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|ready"));
    expect(ctx().isProvisioned).toBe(true);
  });

  it("refreshes cached queries once the profile exists", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 201 }];

    const { client } = await mountProvider();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|ready"));

    // A provisioned profile unlocks queries that were waiting on it. React Query
    // marks stale and refetches rather than deleting, so assert the invalidation
    // rather than the absence of data.
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });
});

describe("auth succeeds but provisioning fails", () => {
  it("stays signed in when the database is unavailable", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 503 }];

    const { ctx } = await mountProvider();

    // The session is real and is published; only the profile is missing.
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|failed:unavailable"));
    expect(ctx().user?.uid).toBe("user-1");
    expect(ctx().isProvisioned).toBe(false);
    expect(ctx().loading).toBe(false);
  });

  it("does not sign the user out on failure", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 503 }];

    const { ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("failed"));

    expect(signOut).not.toHaveBeenCalled();
    expect(ctx().user).not.toBeNull();
  });

  it("stays signed in on a network error", async () => {
    initialSession = { user: signedInUser };
    replies = ["network-error"];

    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|failed:error"));
  });

  it("a 401 from the provisioning route does not end the session", async () => {
    // If the session were genuinely gone, Supabase's auth event would say so.
    // A single route reporting 401 (e.g. a cookie race) must not log the user out.
    initialSession = { user: signedInUser };
    replies = [{ status: 401 }];

    const { ctx } = await mountProvider();

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("signed-in|failed:unauthenticated"),
    );
    expect(ctx().user).not.toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("never leaves the app stuck in loading", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 503 }];

    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toBeInTheDocument());
    expect(screen.getByTestId("state")).not.toHaveTextContent("loading");
  });
});

describe("retry", () => {
  it("succeeds after a temporary failure", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 503 }, { status: 201 }];

    const { ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("failed:unavailable"));

    await act(async () => {
      ctx().retryProvisioning();
    });

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|ready"));
    expect(ctx().isProvisioned).toBe(true);
    expect(provisionCalls).toBe(2);
  });

  it("is a no-op once ready", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 200 }];

    const { ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));

    await act(async () => {
      ctx().retryProvisioning();
    });

    expect(provisionCalls).toBe(1);
  });
});

describe("repeated and concurrent auth events", () => {
  it("does not start a second request while one is in flight", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 201 }];

    // Hold the first call open, then fire more events for the same user.
    let release: () => void = () => {};
    gate = new Promise<void>((resolve) => { release = resolve; });

    const { ctx } = await mountProvider();

    await act(async () => {
      authListener?.("SIGNED_IN", { user: signedInUser });
      authListener?.("TOKEN_REFRESHED", { user: signedInUser });
      authListener?.("SIGNED_IN", { user: signedInUser });
    });

    expect(provisionCalls).toBe(1);

    await act(async () => {
      gate = null;
      release();
    });

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));
    // Three extra events, still one request.
    expect(provisionCalls).toBe(1);
    expect(ctx().isProvisioned).toBe(true);
  });

  it("does not re-provision an already-ready user on later events", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 201 }];

    await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));

    await act(async () => {
      authListener?.("TOKEN_REFRESHED", { user: signedInUser });
      authListener?.("SIGNED_IN", { user: signedInUser });
    });

    expect(provisionCalls).toBe(1);
  });

  it("does not loop while the database is down", async () => {
    initialSession = { user: signedInUser };
    // More failures than the automatic budget allows.
    replies = [{ status: 503 }, { status: 503 }, { status: 503 }, { status: 503 }];

    await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("failed"));

    // A storm of auth events must not produce a storm of requests.
    await act(async () => {
      for (let i = 0; i < 10; i += 1) authListener?.("SIGNED_IN", { user: signedInUser });
    });

    expect(provisionCalls).toBeLessThanOrEqual(2);
  });

  it("provisions separately for a genuinely different identity", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 201 }, { status: 201 }];

    const { ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("ready"));

    const other = { id: "user-2", email: "b@example.test", user_metadata: {} };
    await act(async () => {
      authListener?.("SIGNED_IN", { user: other });
    });

    await waitFor(() => expect(ctx().user?.uid).toBe("user-2"));
    await waitFor(() => expect(provisionCalls).toBe(2));
  });
});

describe("reload / reinitialisation recovery", () => {
  it("retries provisioning on a fresh mount after a previous failure", async () => {
    // A reload is a new provider; the failed attempt from last time must not
    // stick. Here the database has recovered.
    initialSession = { user: signedInUser };
    replies = [{ status: 201 }];

    const { ctx } = await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|ready"));
    expect(ctx().isProvisioned).toBe(true);
  });

  it("a reload while still failing reports failed again, not signed-out", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 503 }];

    await mountProvider();

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("signed-in|failed"));
  });
});

describe("logout", () => {
  it("clears the user, the cache and the provisioning state", async () => {
    initialSession = { user: signedInUser };
    replies = [{ status: 503 }];

    const { client, ctx } = await mountProvider();
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("failed"));

    await act(async () => {
      await ctx().signOut();
    });

    expect(ctx().user).toBeNull();
    expect(ctx().isProvisioned).toBe(false);
    // Attempt bookkeeping is dropped so the next account starts clean.
    expect(ctx().provisioning).toEqual({ status: "pending", attempts: 0 });
    expect(client.getQueryData(["profile", "user-1"])).toBeUndefined();
    expect(client.getQueryData(["notifications", "user-1"])).toBeUndefined();
  });
});
