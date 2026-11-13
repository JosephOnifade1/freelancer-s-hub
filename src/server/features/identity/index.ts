import "server-only";

import { getDatabase, isDatabaseConfigured } from "@/server/db";
import { getServerSession, type ServerSession } from "@/lib/server-session";

import {
  isProvisioningFailure,
  isValidUid,
  provisionProfile,
  type ProvisionedProfile,
} from "./provision-profile";
import { claimUsername, normalizeUsername, type ClaimUsernameOutcome } from "./claim-username";

/**
 * Server-only identity services (Phase 2B.3).
 *
 * This is the **only** place where the authenticated Supabase identity meets the
 * Neon profile tables. Everything else — route handlers, server actions, future
 * feature modules — goes through here, so there is one answer to "who is this,
 * and do they have a profile".
 *
 * Authorization model
 * -------------------
 * Neon does not inherit Supabase RLS (audit §9). Every rule that RLS used to
 * enforce is now an explicit check in this layer:
 *
 *  - **Identity always comes from `getServerSession()`**, which verifies the
 *    cookie session with Supabase Auth (`auth.getUser()`). No function here
 *    accepts a uid from a request body. That is the whole of the identity
 *    boundary: if a caller could pass an arbitrary uid, the `profiles.uid` link
 *    to Supabase Auth would be meaningless.
 *  - **Ownership is implied, not checked.** Both operations act on
 *    `profiles.uid = <verified uid>`, so a user can only ever read or change
 *    their own profile row. There is no path that takes a uid parameter from a
 *    caller.
 *  - **Privileges are never granted here.** `role`, `isVerifiedPro` and every
 *    other elevated field keep their schema defaults (`member`, `false`).
 *    Promoting a user is an admin operation that does not exist yet.
 */

/** Why a request could not be served, in terms the route can map to a status. */
export type IdentityFailureReason =
  | "unauthenticated"
  | "database_not_configured"
  | "invalid_identity"
  | "database_error";

export type EnsureProfileResult =
  | { ok: true; profile: ProvisionedProfile; session: ServerSession }
  | { ok: false; reason: IdentityFailureReason };

export type ClaimResult =
  | { ok: true; outcome: ClaimUsernameOutcome; session: ServerSession }
  | { ok: false; reason: IdentityFailureReason };

/**
 * Failure guards.
 *
 * `strictNullChecks` is off in this repository, so TypeScript does not narrow
 * discriminated unions on `ok`. These guards make the failure branch explicit at
 * every call site instead of enabling the flag across the whole project.
 */
export function isIdentityFailure(
  result: EnsureProfileResult | ClaimResult,
): result is { ok: false; reason: IdentityFailureReason } {
  return result.ok === false;
}

/**
 * Resolves the verified session, or explains why it could not.
 *
 * Returns a reason instead of throwing so callers cannot accidentally treat a
 * failure as an empty-but-successful result.
 */
type IdentityResolution =
  | { ok: true; session: ServerSession }
  | { ok: false; reason: IdentityFailureReason };

/** Guards the resolution itself (the other guards cover the public results). */
function isResolutionFailure(
  resolution: IdentityResolution,
): resolution is { ok: false; reason: IdentityFailureReason } {
  return resolution.ok === false;
}

async function requireIdentity(): Promise<IdentityResolution> {
  const session = await getServerSession();
  if (!session?.uid) return { ok: false, reason: "unauthenticated" };
  return { ok: true, session };
}

/**
 * Makes sure the authenticated user has a Neon profile, creating it if needed.
 *
 * This is the `handle_new_user` replacement. Call it from the narrowest point
 * that guarantees "a logged-in user reaching application data passes through
 * here" — currently the OAuth callback and the two API routes below. It is
 * deliberately **not** wired into every page: provisioning is one idempotent
 * call, not a lifestyle.
 *
 * A failed provisioning never pretends to have succeeded: the caller gets
 * `ok: false` and must not render authenticated application data on the strength
 * of a Supabase session alone.
 */
export async function ensureProfileForCurrentUser(): Promise<EnsureProfileResult> {
  const identity = await requireIdentity();
  if (isResolutionFailure(identity)) return { ok: false, reason: identity.reason };

  if (!isDatabaseConfigured()) {
    // A valid Supabase session with no database is a configuration problem, not
    // an anonymous request. Reported distinctly so it is not mistaken for one.
    return { ok: false, reason: "database_not_configured" };
  }

  // Reject a malformed session uid before opening a connection; the driver
  // would reject it anyway, but there is no reason to reach the network to find
  // out that an identity is not an identity.
  if (!isValidUid(identity.session.uid)) {
    return { ok: false, reason: "invalid_identity" };
  }

  const outcome = await provisionProfile(getDatabase(), {
    uid: identity.session.uid,
    displayName: readDisplayName(identity.session),
  });

  if (isProvisioningFailure(outcome)) {
    return { ok: false, reason: outcome.reason };
  }

  return { ok: true, profile: outcome.profile, session: identity.session };
}

/**
 * Claims a handle for the **current** authenticated user.
 *
 * There is no uid parameter, by design — the requirement that a user cannot
 * claim on behalf of someone else is met structurally rather than by a check.
 */
export async function claimUsernameForCurrentUser(desired: string): Promise<ClaimResult> {
  const identity = await requireIdentity();
  if (isResolutionFailure(identity)) return { ok: false, reason: identity.reason };

  // Validate before touching the database: a malformed handle is a client error,
  // not a reason to open a connection. `normalizeUsername` is the same rule the
  // database CHECK enforces, so this cannot accept something the insert rejects.
  if (!normalizeUsername(desired)) {
    return {
      ok: true,
      outcome: { status: "invalid", reason: "username_must_match_3_to_15_lowercase_alphanumeric_or_underscore" },
      session: identity.session,
    };
  }

  if (!isDatabaseConfigured()) {
    return { ok: false, reason: "database_not_configured" };
  }

  const outcome = await claimUsername(getDatabase(), {
    uid: identity.session.uid,
    desired,
  });

  return { ok: true, outcome, session: identity.session };
}

/**
 * Reads the display-name hint for provisioning.
 *
 * `ServerSession` deliberately exposes only `{ uid, email, emailConfirmedAt }`
 * (Phase 1.2) and no auth metadata, so there is no display name available here
 * yet. Rather than widen that contract for a cosmetic field, provisioning
 * derives the handle from the UUID (`fallbackUsername`). Widening
 * `ServerSession` is a follow-up, not a reason to loosen this boundary now.
 */
function readDisplayName(_session: ServerSession): string | null {
  return null;
}
