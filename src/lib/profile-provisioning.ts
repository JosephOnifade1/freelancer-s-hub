/**
 * Client shim for the server-side profile provisioning call (Phase 2B.3).
 *
 * The browser can only *ask* the server to provision. It never supplies a uid,
 * because the server ignores request bodies on that route entirely and reads the
 * identity from the verified Supabase session cookie.
 *
 * Kept deliberately thin: no retries and no queueing — those belong to the
 * caller (`src/hooks/useAuth.tsx`, policy in `src/lib/provisioning-state.ts`) so
 * that one identity, not one module, owns the attempt budget. No fallback writes
 * to Supabase on its own either: a second mechanism competing with the server
 * call is the exact thing Phase 2B.3 removed.
 */

/** Outcomes the server can report, plus the two transport-level ones. */
export type ProvisionOutcome =
  | { status: "created" | "existing" }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "error" };

/** Options for the provisioning call. */
export interface ProvisionOptions {
  /**
   * Aborts the request. Used so a superseded attempt (a newer auth event, or
   * logout) cannot land its result and overwrite the current state.
   */
  signal?: AbortSignal;
}

/**
 * Ensures the signed-in user has a profile row in Neon.
 *
 * Resolves rather than throws for every expected failure so callers can decide
 * what the UI should do; only a programming error can escape.
 */
export async function provisionProfileOnServer(
  options: ProvisionOptions = {},
): Promise<ProvisionOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/profile/provision", {
      method: "POST",
      // Deliberate: no body. Identity comes from the session cookie only.
      headers: { accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
    });
  } catch {
    // Network failure, offline, or an aborted request. An abort is reported the
    // same way as a transient failure: the caller decides whether the result is
    // still relevant, because it knows whether it superseded the attempt.
    return { status: "error" };
  }

  switch (response.status) {
    case 200:
      return { status: "existing" };
    case 201:
      return { status: "created" };
    case 401:
      return { status: "unauthenticated" };
    case 503:
      // Database not configured, or unreachable. Distinct from "signed out" so
      // the app does not bounce the user to /login for an infrastructure fault.
      return { status: "unavailable" };
    default:
      return { status: "error" };
  }
}

/** Outcomes of a username claim, as the server types them. */
export type ClaimOutcome =
  | { status: "claimed"; username: string }
  | { status: "same"; username: string }
  | { status: "invalid" }
  | { status: "taken" }
  | { status: "profile_missing" }
  | { status: "unauthenticated" }
  | { status: "unavailable" }
  | { status: "error" };

/**
 * Claims a username for the signed-in user.
 *
 * Only the desired handle crosses the wire. The uid is not sent, and the server
 * has no parameter to accept one, so "claim this for another account" is not an
 * expressible request.
 */
export async function claimUsernameOnServer(desired: string): Promise<ClaimOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/profile/username", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ username: desired }),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { status: "error" };
  }

  if (response.status === 401) return { status: "unauthenticated" };
  if (response.status === 503) return { status: "unavailable" };
  if (response.status === 400) return { status: "invalid" };
  if (response.status === 409) return { status: "taken" };
  if (response.status === 404) return { status: "profile_missing" };

  if (response.status === 200) {
    try {
      const body = (await response.json()) as { status?: string; username?: string };
      const username = typeof body.username === "string" ? body.username : "";
      if (body.status === "claimed" || body.status === "same") {
        return { status: body.status, username };
      }
    } catch {
      return { status: "error" };
    }
  }

  return { status: "error" };
}
