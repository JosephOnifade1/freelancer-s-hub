/**
 * Profile provisioning state — Phase 2B.4.
 *
 * Phase 2B.3 moved profile creation into the server and made `acceptSession`
 * await it before reporting the user as signed in. That was correct about
 * *ordering* but wrong about *failure*: a Neon outage made a perfectly valid
 * Supabase session look provisional, and the app had no state in which to say
 * "you are signed in, your profile is not ready yet".
 *
 * This module supplies that missing state. It is pure TypeScript with no React
 * and no fetch, so the state machine is unit-testable in isolation and the
 * provider stays a thin adapter over it.
 *
 * The five states the brief requires
 * ----------------------------------
 *   auth loading        → `loading`            (session not resolved yet)
 *   unauthenticated     → `unauthenticated`
 *   provisioning        → `pending`
 *   provisioned         → `ready`
 *   failed, recoverable → `failed`
 *
 * Deliberately *not* a state: "signed out because Neon was down". A database
 * fault cannot reach `unauthenticated` from here — that transition only happens
 * when Supabase says the session is gone. That is the whole point of the module,
 * so it is enforced by the shape of the API rather than by remembering to check.
 */

/** The provisioning phase, independent of whether a session exists. */
export type ProvisioningStatus = "pending" | "ready" | "failed";

/**
 * Why provisioning did not succeed. None of these are authentication failures.
 *
 * Deliberately coarse: the server already refuses to leak driver detail (2B.3
 * §8), and the client does not need to distinguish "Neon is down" from "Neon is
 * not configured" in order to show a retry affordance.
 */
export type ProvisioningFailureReason =
  /** Database not configured or unreachable (HTTP 503, or network failure). */
  | "unavailable"
  /** The server rejected the request as unauthenticated (HTTP 401). */
  | "unauthenticated"
  /** Any other non-2xx outcome, or a malformed response. */
  | "error";

export interface ProvisioningState {
  status: ProvisioningStatus;
  /** Present when `status === "failed"`; never contains driver text. */
  reason?: ProvisioningFailureReason;
  /** How many attempts have been made for the current identity. */
  attempts: number;
}

export const INITIAL_PROVISIONING: ProvisioningState = { status: "pending", attempts: 0 };

/**
 * Retry policy.
 *
 * Two independent brakes, because they guard different things:
 *
 *  - `MAX_AUTOMATIC_ATTEMPTS` stops an *automatic* retry loop (an auth event
 *    that fires repeatedly while Neon is down) from hammering the database.
 *    After the budget is spent the user can still retry by hand, or simply
 *    reload — both are one attempt, not a loop.
 *  - `RETRY_COOLDOWN_MS` spaces the automatic attempts out so a burst of auth
 *    events in the same tick collapses into one request (see `shouldAttempt`).
 *
 * There is no unbounded retry anywhere: requirement 9 of the brief.
 */
export const MAX_AUTOMATIC_ATTEMPTS = 2;
export const RETRY_COOLDOWN_MS = 5_000;

/** True when the state still needs the server to act. */
export function needsProvisioning(state: ProvisioningState): boolean {
  return state.status === "pending" || state.status === "failed";
}

/**
 * Whether an automatic attempt is allowed now.
 *
 * `lastAttemptAt` is a timestamp rather than a duration so the caller owns the
 * clock and the test can control it. `undefined` means "never attempted".
 */
export function shouldAttemptAutomatically(
  state: ProvisioningState,
  lastAttemptAt: number | undefined,
  now: number,
): boolean {
  // `ready` never needs another attempt; an in-flight `pending` is owned by the
  // in-flight de-duplication in the provider, not by this budget.
  if (state.status === "ready") return false;
  if (state.attempts >= MAX_AUTOMATIC_ATTEMPTS) return false;
  if (lastAttemptAt === undefined) return true;
  return now - lastAttemptAt >= RETRY_COOLDOWN_MS;
}

/**
 * Maps a server outcome onto the next provisioning state.
 *
 * The one interesting case is `unauthenticated`: the server derives identity
 * from the cookie session, so a 401 means the cookie was not present or not
 * valid *for that request*. That is reported as
 * `failed/unauthenticated` — recoverable — and **not** as a sign-out. If the
 * session really is gone, Supabase's own auth event says so and the provider
 * transitions to `unauthenticated` from there. Letting a single 401 from one
 * route log the user out would mean a transient cookie race could end a valid
 * session, which is precisely the failure mode this phase exists to remove.
 */
export function nextProvisioningState(
  previous: ProvisioningState,
  outcome: { status: "created" | "existing" | "unavailable" | "unauthenticated" | "error" },
): ProvisioningState {
  const attempts = previous.attempts + 1;

  switch (outcome.status) {
    case "created":
    case "existing":
      return { status: "ready", attempts };
    case "unavailable":
      return { status: "failed", reason: "unavailable", attempts };
    case "unauthenticated":
      return { status: "failed", reason: "unauthenticated", attempts };
    default:
      return { status: "failed", reason: "error", attempts };
  }
}

/**
 * Human-facing copy for a failed state.
 *
 * Says what is true (signed in, profile not ready) and what to do. It never
 * mentions databases, HTTP status codes or internals — requirement 4 of the
 * brief, applied to the UI layer rather than only the transport.
 */
export function provisioningMessage(reason: ProvisioningFailureReason | undefined): string {
  switch (reason) {
    case "unavailable":
      return "Your profile could not be set up yet because the service is temporarily unavailable.";
    case "unauthenticated":
      return "Your profile could not be set up yet. You are still signed in.";
    default:
      return "Your profile could not be set up yet. Please try again.";
  }
}
