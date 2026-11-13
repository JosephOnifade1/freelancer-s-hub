import "server-only";

import { getDatabase, isDatabaseConfigured } from "@/server/db";
import { getServerSession } from "@/lib/server-session";

import {
  findOwnProfile,
  findProfileByIdentifier,
  findProfilesByUids,
  findTopProfiles,
  isUsernameAvailable,
  searchProfiles,
  setOwnAvatar,
  updateOwnProfile,
  findModerationProfiles,
  type EditableProfileFields,
  type ModerationProfile,
  type OwnProfile,
  type PublicProfile,
} from "./profile-queries";

/**
 * Server-only profile services (Phase 2C).
 *
 * The single place where a browser-visible request becomes a Neon profile query.
 * Every function here follows the Phase 2B.3 authorization model:
 *
 *  - **Identity comes from `getServerSession()`**, which verifies the cookie session
 *    with Supabase Auth. No function accepts a uid from a request body for anything
 *    the caller owns.
 *  - **Reads may name a target** (`getPublicProfile("@ada")`) because a public
 *    profile is public — but the subject is always a username or uid the *route*
 *    resolved, never an identity claim.
 *  - **Writes never name a target.** `updateCurrentProfile(fields)` takes no uid, so
 *    "update somebody else's profile" is not an expressible request. This is the
 *    same structural guarantee as `claimUsernameForCurrentUser`.
 *
 * Failure reasons are the same vocabulary the identity routes already use, so the
 * client has one set of status mappings rather than two.
 */

/** Re-exported so routes can type their whitelisted bodies without importing the core. */
export type { EditableProfileFields };

export type ProfileFailureReason =
  | "unauthenticated"
  | "database_not_configured"
  | "invalid_identity"
  | "database_error";

export type ProfileResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: ProfileFailureReason };

export type OwnProfileResult =
  | { ok: true; profile: OwnProfile }
  | { ok: false; reason: ProfileFailureReason };

/**
 * Failure guard. `strictNullChecks` is off in this repository, so discriminated
 * unions on `ok` do not narrow — the same reason the identity layer has one.
 */
export function isProfileFailure<T>(
  result: ProfileResult<T>,
): result is { ok: false; reason: ProfileFailureReason } {
  return result.ok === false;
}

export function isOwnProfileFailure(
  result: OwnProfileResult,
): result is { ok: false; reason: ProfileFailureReason } {
  return result.ok === false;
}

/** Guard for the mutation results. Separate because their success shape is `outcome`. */
export function isMutationFailure(
  result: MutationResult | SimpleMutationResult,
): result is { ok: false; reason: ProfileFailureReason } {
  return result.ok === false;
}

/** Resolves the verified session uid, or the reason there isn't one. */
async function requireUid(): Promise<
  { ok: true; uid: string } | { ok: false; reason: ProfileFailureReason }
> {
  const session = await getServerSession();
  if (!session?.uid) return { ok: false, reason: "unauthenticated" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "database_not_configured" };
  return { ok: true, uid: session.uid };
}

/**
 * Public profile by username or uid.
 *
 * Anonymous callers are allowed — a profile is a public page. The projection
 * excludes `role`, so a signed-out visitor cannot enumerate administrators.
 */
export async function getPublicProfile(identifier: string): Promise<ProfileResult<PublicProfile | null>> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "database_not_configured" };
  try {
    return { ok: true, data: await findProfileByIdentifier(getDatabase(), identifier) };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

/** Public profiles for a set of uids. Used by list surfaces (search, stats). */
export async function getPublicProfiles(uids: string[]): Promise<ProfileResult<PublicProfile[]>> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "database_not_configured" };
  try {
    return { ok: true, data: await findProfilesByUids(getDatabase(), uids) };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

export async function getTopPublicProfiles(limit = 5): Promise<ProfileResult<PublicProfile[]>> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "database_not_configured" };
  try {
    return { ok: true, data: await findTopProfiles(getDatabase(), limit) };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

export async function searchPublicProfiles(term: string): Promise<ProfileResult<PublicProfile[]>> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "database_not_configured" };
  try {
    return { ok: true, data: await searchProfiles(getDatabase(), term) };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

export async function checkUsernameAvailability(username: string): Promise<ProfileResult<boolean>> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "database_not_configured" };
  try {
    return { ok: true, data: await isUsernameAvailable(getDatabase(), username) };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

/** The caller's own profile. */
export async function getCurrentProfile(): Promise<OwnProfileResult> {
  const identity = await requireUid();
  if (identity.ok === false) return identity;

  try {
    const profile = await findOwnProfile(getDatabase(), identity.uid);
    // Missing is not an error: it is the pre-provisioning state, which the client
    // renders as "profile not ready yet" rather than a failure.
    if (!profile) return { ok: false, reason: "invalid_identity" };
    return { ok: true, profile };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}

export type ProfileMutationOutcome =
  | { status: "updated"; profile: OwnProfile }
  | { status: "profile_missing" }
  | { status: "invalid" }
  | { status: "failed" };

export type MutationResult =
  | { ok: true; outcome: ProfileMutationOutcome }
  | { ok: false; reason: ProfileFailureReason };

export type SimpleMutationResult =
  | { ok: true; outcome: { status: "updated" | "profile_missing" | "invalid" | "failed" } }
  | { ok: false; reason: ProfileFailureReason };

/**
 * Updates the caller's own profile.
 *
 * Takes no uid. The identity is resolved here, so this function is the authorization
 * boundary for every profile field a user may change.
 */
export async function updateCurrentProfile(fields: EditableProfileFields): Promise<MutationResult> {
  const identity = await requireUid();
  if (identity.ok === false) return identity;

  return { ok: true, outcome: await updateOwnProfile(getDatabase(), identity.uid, fields) };
}

/** Replaces the caller's avatar reference. The file itself stays in Storage. */
export async function setCurrentAvatar(url: string): Promise<MutationResult> {
  const identity = await requireUid();
  if (identity.ok === false) return identity;

  return { ok: true, outcome: await setOwnAvatar(getDatabase(), identity.uid, url) };
}

/**
 * Marks the veteran celebration as seen.
 *
 * Given its own function rather than being folded into `updateCurrentProfile`
 * because it is the one field the client sets without the user filling in a form,
 * and folding it in would put a "skip the celebration" flag on the general update
 * surface.
 */
export async function markVeteranCelebrationSeen(): Promise<SimpleMutationResult> {
  const identity = await requireUid();
  if (identity.ok === false) return identity;

  const outcome = await updateOwnProfile(getDatabase(), identity.uid, {
    hasSeenVeteranCelebration: true,
  });
  return { ok: true, outcome: outcome.status === "updated" ? { status: "updated" } : outcome };
}

/**
 * Moderation list including `role`.
 *
 * Gated on the caller's **own** role, read from Neon. This is the one place where a
 * profile read is itself privileged, so the check lives beside the query rather than in
 * the route: a second route calling this cannot forget to authorize.
 *
 * Role and verification mutations are administered by the Neon content service.
 */
export async function getModerationProfiles(limit = 50): Promise<ProfileResult<ModerationProfile[]>> {
  const identity = await requireUid();
  if (identity.ok === false) return identity;

  const db = getDatabase();
  try {
    const own = await findOwnProfile(db, identity.uid);
    if (!own) return { ok: false, reason: "invalid_identity" };
    if (own.role !== "admin" && own.role !== "moderator") {
      return { ok: false, reason: "invalid_identity" };
    }
    return { ok: true, data: await findModerationProfiles(db, limit) };
  } catch {
    return { ok: false, reason: "database_error" };
  }
}
