import { supabase } from "./supabase";
import {
  fetchPublicProfile,
  fetchTopProfiles,
  checkHandleAvailable,
  saveOwnAvatar,
  saveReputation,
  adjustFollowingCounter,
  isProfileError,
} from "./profile-client";

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

export const getUserResourcesCount = async (uid: string) => {
  const { count } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("authorUid", uid)
    .eq("type", "resource")
    .eq("isDeleted", false);

  return count || 0;
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

export const getSavedPostIds = async (uid: string): Promise<Record<string, boolean>> => {
  if (!uid) return {};
  const { data, error } = await supabase.from("saved_posts").select("postId").eq("userId", uid);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load bookmarks.");
  const map: Record<string, boolean> = {};
  for (const row of data) if (row.postId) map[row.postId] = true;
  return map;
};

export const toggleBookmark = async (uid: string, postId: string) => {
  if (!uid || !postId) return false;

  const { data: existing, error: lookupError } = await supabase
    .from("saved_posts")
    .select("postId")
    .eq("userId", uid)
    .eq("postId", postId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  if (existing) {
    const { error } = await supabase.from("saved_posts").delete().eq("userId", uid).eq("postId", postId);
    if (error) throw new Error(error.message);
    return false;
  } else {
    const { error } = await supabase.from("saved_posts").insert({ userId: uid, postId });
    if (error) throw new Error(error.message);
    return true;
  }
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

export const toggleFollow = async (currentUid: string, targetUid: string) => {
  if (currentUid === targetUid) return;

  const { data: existing, error: lookupError } = await supabase
    .from("follows")
    .select("followingId")
    .eq("followerId", currentUid)
    .eq("followingId", targetUid)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  const isFollowing = !!existing;

  // Counter RPCs keep profiles.followers/following in sync. Their errors are
  // surfaced (thrown) rather than swallowed — a follow that "worked" in the UI
  // while the counter write failed is how counts drifted out of sync before.
  // Phase 2C: the caller's own `following` total now lives in Neon; the *target's*
  // `followers` total still lives in Supabase, because that row belongs to a user whose
  // profile this phase does migrate but whose counter is driven by the `follows` domain
  // that has not. Until `follows` moves, one half of the pair is updated here and the
  // other by the RPC.
  //
  // The asymmetry is temporary and deliberate: writing the target's counter to Neon
  // would require reading `follows` from two places, which is the dual-read this
  // migration exists to remove. Errors are still surfaced, not swallowed — a follow
  // that "worked" in the UI while a counter failed is how counts drifted before.
  if (isFollowing) {
    const { error } = await supabase.from("follows").delete().eq("followerId", currentUid).eq("followingId", targetUid);
    if (error) throw new Error(error.message);
    const { error: e1 } = await supabase.rpc("decrement_followers", { target_uid: targetUid });
    if (e1) throw new Error(e1.message);
    const own = await adjustFollowingCounter(-1);
    if (isProfileError(own) && own.error !== "not_provisioned") {
      throw new Error("Could not update your following count.");
    }
  } else {
    const { error } = await supabase.from("follows").insert({ followerId: currentUid, followingId: targetUid });
    if (error) throw new Error(error.message);
    const { error: e1 } = await supabase.rpc("increment_followers", { target_uid: targetUid });
    if (e1) throw new Error(e1.message);
    const own = await adjustFollowingCounter(1);
    if (isProfileError(own) && own.error !== "not_provisioned") {
      throw new Error("Could not update your following count.");
    }
  }

  return !isFollowing;
};

export const calculateReputation = async (uid: string) => {
  const { data: postsData } = await supabase
    .from("posts")
    .select("score")
    .eq("authorUid", uid)
    .eq("isDeleted", false);

  const { data: commentsData } = await supabase
    .from("comments")
    .select("score")
    .eq("authorUid", uid)
    .eq("isDeleted", false);

  const totalScore =
    (postsData || []).reduce((sum, p) => sum + (p.score || 0), 0) +
    (commentsData || []).reduce((sum, c) => sum + (c.score || 0), 0);

  // Phase 2C: the *derivation* still reads Supabase (posts and comments have not
  // migrated), but the *write* goes to Neon where the profile now lives. Sending the
  // total to the server keeps the write bound to the session uid — the server ignores
  // any uid we might pass and writes the caller's own row.
  const saved = await saveReputation(totalScore);
  if (isProfileError(saved) && saved.error !== "not_provisioned") {
    throw new Error("Could not save reputation.");
  }
  return totalScore;
};

/** Top profiles by reputation — Phase 2C reads Neon. */
export const getTopContributors = async (count = 5): Promise<UserProfile[]> => {
  const result = await fetchTopProfiles(count);
  if (!result.ok) throw new Error("Could not load contributors.");
  return result.data as UserProfile[];
};

// Real list of user IDs this user follows, from the `follows` join table —
// replaces the old (nonexistent) profile.followingList field.
export const getFollowingIds = async (uid: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("follows")
    .select("followingId")
    .eq("followerId", uid);

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load following list.");
  return (data as { followingId: string }[]).map((row) => row.followingId);
};
