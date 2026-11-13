/**
 * Browser client for the Neon profile API (Phase 2C).
 *
 * Replaces the Supabase profile reads and writes in `src/lib/users.ts`. Same shape as
 * `profile-provisioning.ts`: thin, no retries, no fallback that reaches into Supabase
 * when Neon is unavailable. A failure surfaces as a typed outcome so the caller can
 * decide what to show — silently falling back to the other database would be the
 * dual-read this migration exists to avoid.
 *
 * These functions mirror the `UserProfile` type the views already use, so switching a
 * call site does not ripple through the UI.
 */

/** The profile shape the UI renders. Superset of the server's public projection. */
export interface UserProfile {
  uid: string;
  username: string;
  displayName: string | null;
  initial: string | null;
  bio: string;
  location: string;
  website: string;
  status: string;
  skills: string[];
  reputation: number;
  followers: number;
  following: number;
  avatarUrl: string | null;
  isVerifiedPro: boolean;
  /** Join year, derived server-side from `createdAt`. */
  joined: string;
  role?: "admin" | "moderator" | "member" | string;
  hasSeenVeteranCelebration?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  savedPosts?: Record<string, boolean>;
}

/** Why a profile call did not produce data. Mirrors the route status codes. */
export type ProfileClientError =
  | "unauthenticated"
  | "unavailable"
  | "not_found"
  | "not_provisioned"
  | "invalid"
  | "error";

export type ProfileClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProfileClientError };

/**
 * Narrows a failed result.
 *
 * `strictNullChecks` is off in this repository, so the `ok` discriminant does not
 * narrow on its own — the same constraint the server guards work around.
 */
export function isProfileError<T>(
  result: ProfileClientResult<T>,
): result is { ok: false; error: ProfileClientError } {
  return result.ok === false;
}

function failureFromStatus(status: number): ProfileClientError {
  switch (status) {
    case 401:
      return "unauthenticated";
    case 404:
      return "not_found";
    case 503:
      return "unavailable";
    case 400:
      return "invalid";
    default:
      return "error";
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * A public profile by username or uid.
 *
 * `not_found` is a first-class outcome: `Profile.tsx` shows "not found" for it, which
 * the old `null` return could not express separately from a failed request.
 */
export async function fetchPublicProfile(
  identifier: string,
  signal?: AbortSignal,
): Promise<ProfileClientResult<UserProfile>> {
  if (!identifier) return { ok: false, error: "invalid" };

  let response: Response;
  try {
    response = await fetch(`/api/profiles/${encodeURIComponent(identifier)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal,
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profile = body?.profile as UserProfile | undefined;
  if (!profile) return { ok: false, error: "error" };
  return { ok: true, data: profile };
}

/** The signed-in user's own profile. */
export async function fetchOwnProfile(
  signal?: AbortSignal,
): Promise<ProfileClientResult<UserProfile>> {
  let response: Response;
  try {
    response = await fetch("/api/profile/me", {
      headers: { accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (response.status === 404) return { ok: false, error: "not_provisioned" };
  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profile = body?.profile as UserProfile | undefined;
  if (!profile) return { ok: false, error: "error" };
  return { ok: true, data: profile };
}

/** Several public profiles at once. */
export async function fetchPublicProfiles(
  uids: string[],
): Promise<ProfileClientResult<UserProfile[]>> {
  if (uids.length === 0) return { ok: true, data: [] };

  let response: Response;
  try {
    response = await fetch(`/api/profiles/lookup?uids=${encodeURIComponent(uids.join(","))}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profiles = body?.profiles as UserProfile[] | undefined;
  if (!profiles) return { ok: false, error: "error" };
  return { ok: true, data: profiles };
}

/** Top profiles by reputation. */
export async function fetchTopProfiles(limit = 5): Promise<ProfileClientResult<UserProfile[]>> {
  let response: Response;
  try {
    response = await fetch(`/api/profiles/lookup?top=${limit}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profiles = body?.profiles as UserProfile[] | undefined;
  if (!profiles) return { ok: false, error: "error" };
  return { ok: true, data: profiles };
}

/** Profile search. */
export async function searchProfiles(term: string): Promise<ProfileClientResult<UserProfile[]>> {
  if (!term.trim()) return { ok: true, data: [] };

  let response: Response;
  try {
    response = await fetch(`/api/profiles/lookup?q=${encodeURIComponent(term)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profiles = body?.profiles as UserProfile[] | undefined;
  if (!profiles) return { ok: false, error: "error" };
  return { ok: true, data: profiles };
}

/** Is a handle free? Used by signup and the settings field. */
export async function checkHandleAvailable(
  username: string,
): Promise<ProfileClientResult<boolean>> {
  if (!username) return { ok: true, data: false };

  let response: Response;
  try {
    response = await fetch(`/api/profiles/lookup?available=${encodeURIComponent(username)}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const available = body?.available;
  if (typeof available !== "boolean") return { ok: false, error: "error" };
  return { ok: true, data: available };
}

/**
 * Fields the settings form may send.
 *
 * Typed as the editable subset. The server whitelists independently, so this type is
 * for the caller's benefit, not the security boundary.
 */
export interface EditableProfileInput {
  displayName?: string | null;
  bio?: string;
  location?: string;
  website?: string;
  status?: "Available" | "Busy";
  skills?: string[];
  avatarUrl?: string | null;
}

/**
 * Saves profile fields.
 *
 * One request, one database. Phase 2C's "settings save consistency" fix: the username
 * claim and the profile fields used to hit Neon and Supabase respectively in a single
 * user action, so a failure in the second left the form half-saved. Both now target
 * Neon; the caller decides how to present a partial failure.
 */
export async function saveOwnProfile(
  fields: EditableProfileInput,
): Promise<ProfileClientResult<UserProfile>> {
  let response: Response;
  try {
    response = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(fields),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (response.status === 404) return { ok: false, error: "not_provisioned" };
  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profile = body?.profile as UserProfile | undefined;
  if (!profile) return { ok: false, error: "error" };
  return { ok: true, data: profile };
}

/** Records an avatar URL already uploaded to Supabase Storage. */
export async function saveOwnAvatar(url: string): Promise<ProfileClientResult<UserProfile>> {
  let response: Response;
  try {
    response = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ url }),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (response.status === 404) return { ok: false, error: "not_provisioned" };
  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profile = body?.profile as UserProfile | undefined;
  if (!profile) return { ok: false, error: "error" };
  return { ok: true, data: profile };
}

/** Marks the veteran celebration as seen. */
export async function markVeteranCelebrationSeen(): Promise<ProfileClientResult<UserProfile>> {
  return saveOwnProfileStatus({ hasSeenVeteranCelebration: true });
}

/** Internal: the celebration flag is not in `EditableProfileInput`, so it has its own call. */
async function saveOwnProfileStatus(
  fields: { hasSeenVeteranCelebration: boolean },
): Promise<ProfileClientResult<UserProfile>> {
  let response: Response;
  try {
    response = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(fields),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (response.status === 404) return { ok: false, error: "not_provisioned" };
  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const profile = body?.profile as UserProfile | undefined;
  if (!profile) return { ok: false, error: "error" };
  return { ok: true, data: profile };
}

/** A profile row including `role` — the moderation/admin projection. */
export interface ModerationUserRow {
  uid: string;
  username?: string;
  name: string;
  avatarUrl?: string;
  reputation: number;
  isVerifiedPro: boolean;
  role: string;
}

/**
 * Profiles for the moderation queue, including `role`.
 *
 * Separate from every other read because `role` is an authorization input. The server
 * gates the route on the caller's own role, so this cannot be used by a non-admin to
 * enumerate staff.
 */
export async function fetchModerationProfiles(
  limit = 50,
): Promise<ProfileClientResult<ModerationUserRow[]>> {
  let response: Response;
  try {
    response = await fetch(`/api/profiles/moderation?limit=${limit}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    return { ok: false, error: "error" };
  }

  if (response.status === 403) return { ok: false, error: "invalid" };
  if (!response.ok) return { ok: false, error: failureFromStatus(response.status) };

  const body = await readJson(response);
  const users = body?.users as ModerationUserRow[] | undefined;
  if (!users) return { ok: false, error: "error" };
  return { ok: true, data: users };
}

/**
 * The signed-in user's own role.
 *
 * An authorization input, so it comes from the server's read of the session's own row.
 * The value is still only ever used to *hide* content in the client mirror of
 * `can_view_post`; the authoritative check is server-side, and will move with the
 * content migration.
 */
export async function fetchOwnRole(): Promise<ProfileClientResult<string>> {
  const result = await fetchOwnProfile();
  if (isProfileError(result)) return result;
  return { ok: true, data: (result.data.role as string) || "member" };
}
