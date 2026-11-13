import { fetchFollowing, setFollowing } from "./social-client";
import { supabase } from "./supabase";
import {
  fetchPublicProfile,
  fetchTopProfiles,
  checkHandleAvailable,
  saveOwnAvatar,
  isProfileError,
} from "./profile-client";
import {
  fetchAuthorResourceCount,
  fetchSavedPostIds,
  isContentError,
  toggleSavedPost,
} from "./content-client";

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string | null;
  initial: string | null;
  bio: string;
  location: string;
  website: string;
  /** Join year, derived server-side from `createdAt` (Phase 2C). */
  joined: string;
  status: string;
  skills: string[];
  reputation: number;
  followers: number;
  following: number;
  savedPosts?: Record<string, boolean>;
  communitiesList?: Record<string, boolean>;
  createdAt?: string;
  avatarUrl?: string | null;
  isVerifiedPro?: boolean;
  role?: "admin" | "moderator" | "member" | string;
  hasSeenVeteranCelebration?: boolean;
  favoriteTopics?: string[];
};

interface AuthUserMetadata {
  display_name?: string;
  full_name?: string;
  name?: string;
  username?: string;
  avatar_url?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Looks a profile up by uid or username.
 *
 * Phase 2C: reads Neon through `/api/profiles/[identifier]`. The old version read
 * Supabase, did up to four round-trips, and — importantly — could *create* a profile
 * via `ensureUserProfile` as a side effect of a read. That fallback is gone; creation
 * belongs to provisioning, which is idempotent and server-owned.
 *
 * Returns `null` for "no such profile" **and** for a failed request, because the two
 * dozen existing call sites treat both as "show nothing". Callers that need to tell
 * them apart (`Profile.tsx`) use `fetchPublicProfile` and its typed error directly.
 *
 * `savedPosts` is attached only for the viewer's own profile and still comes from
 * Supabase: bookmarks are a separate domain that has not migrated, and folding them
 * into the Neon profile read would couple two migrations.
 */
export const getUserProfile = async (identifier: string): Promise<UserProfile | null> => {
  const result = await fetchPublicProfile(identifier);
  if (!result.ok) return null;

  const profile = result.data as UserProfile;

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUser = sessionData?.session?.user;
  if (sessionUser && sessionUser.id === profile.uid) {
    // Private bookmarks belong to the viewer, not everyone who visits their profile.
    try {
      profile.savedPosts = await getSavedPostIds(profile.uid);
    } catch {
      // A bookmark lookup failure must not turn a profile into a 404.
      profile.savedPosts = undefined;
    }
  }
  return profile;
};

/**
 * How many resource posts an author has.
 *
 * Phase 2D: counted in Neon by a `count(*)` rather than transferring a row set with
 * `head: true`. Both are a single round trip; this one is a single number.
 */
export const getUserResourcesCount = async (uid: string) => {
  const result = await fetchAuthorResourceCount(uid);
  if (isContentError(result)) return 0;
  return result.data;
};

export const isVeteran = (reputation: number) => {
  return (reputation || 0) >= 5000;
};

/**
 * Is a handle free?
 *
 * Phase 2C: asks Neon, which checks the `usernames` registry and
 * `profiles.username` together — the two sources the atomic claim relies on.
 *
 * Returns `false` on a failed request rather than throwing. The old version threw,
 * which made the settings field show "unavailable" for a network blip; a handle is
 * only claimed after an explicit save, which has its own authoritative check, so
 * failing closed here costs nothing and misleads less.
 */
export const checkUsernameAvailability = async (username: string) => {
  if (!username) return false;
  const result = await checkHandleAvailable(username.toLowerCase());
  return result.ok ? result.data : false;
};

/**
 * Resolves a uid from a handle.
 *
 * Phase 2C: one Neon read instead of two Supabase round-trips with a fallback.
 */
export const getUidByUsername = async (username: string) => {
  if (!username) return null;
  const clean = username.startsWith("@") ? username.substring(1) : username;
  const result = await fetchPublicProfile(clean);
  return result.ok ? result.data.uid : null;
};

/**
 * The caller's bookmarks, as a lookup map.
 *
 * Phase 2D: Neon, via `/api/content/saved`. The `uid` argument is kept for call-site
 * compatibility but is **not sent**: the server uses the verified session, so this
 * cannot be pointed at another user's bookmarks. Before the migration the parameter
 * was honoured by the API and silently narrowed by RLS — the same trap as the profile
 * writes in 2C.
 */
export const getSavedPostIds = async (uid: string): Promise<Record<string, boolean>> => {
  if (!uid) return {};
  const result = await fetchSavedPostIds();
  if (isContentError(result)) {
    if (result.error === "unauthenticated") return {};
    throw new Error("Could not load bookmarks.");
  }
  const map: Record<string, boolean> = {};
  for (const postId of result.data) map[postId] = true;
  return map;
};

/**
 * Toggles a bookmark and reports the new state.
 *
 * Returns `true` when the post is now saved. The previous implementation did a
 * `select` followed by an `insert`/`delete`; the server now performs the toggle in one
 * statement, so a double-click cannot race itself into a duplicate-key error.
 */
export const toggleBookmark = async (uid: string, postId: string) => {
  if (!uid || !postId) return false;

  const result = await toggleSavedPost(postId);
  if (isContentError(result)) {
    if (result.error === "not_found") throw new Error("Post not found.");
    if (result.error === "unauthenticated") throw new Error("Sign in to save posts.");
    throw new Error("Bookmark could not be saved.");
  }
  return result.data === "saved";
};

/**
 * Records a new avatar reference.
 *
 * Phase 2C: the file is still uploaded to Supabase Storage by the caller; only the URL
 * is stored, and now in Neon. `imageUrl` is not a trust decision here — the server
 * validates it is http(s) before storing, because it is rendered into an `<img src>`.
 *
 * The `uid` argument is kept for call-site compatibility but is **not sent**: the
 * server writes the session's own row, so this cannot be pointed at another account.
 */
export const updateUserAvatar = async (uid: string, imageUrl: string) => {
  if (!uid) return;
  const result = await saveOwnAvatar(imageUrl);
  if (isProfileError(result)) {
    throw new Error(
      result.error === "unavailable"
        ? "Could not save your photo. Please try again."
        : "Could not save your photo.",
    );
  }
  return imageUrl;
};

export const toggleFollow = async (_currentUid: string, targetUid: string) =>
  (await setFollowing(targetUid, "toggle")).following;

/** Top profiles by reputation — Phase 2C reads Neon. */
export const getTopContributors = async (count = 5): Promise<UserProfile[]> => {
  const result = await fetchTopProfiles(count);
  if (!result.ok) throw new Error("Could not load contributors.");
  return result.data as UserProfile[];
};

// Real list of user IDs this user follows, from the `follows` join table —
// replaces the old (nonexistent) profile.followingList field.
export const getFollowingIds = async (uid: string): Promise<string[]> =>
  (await fetchFollowing(uid)).map(profile => profile.uid);
