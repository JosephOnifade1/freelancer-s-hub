import { supabase } from "./supabase";

export type UserProfile = {
  uid: string;
  username: string;
  displayName: string;
  initial: string;
  bio: string;
  location: string;
  website: string;
  joined: string;
  status: string;
  skills: string[];
  reputation: number;
  followers: number;
  following: number;
  savedPosts?: Record<string, boolean>;
  communitiesList?: Record<string, boolean>;
  createdAt: any;
  avatarUrl?: string;
  isVerifiedPro?: boolean;
  role?: "admin" | "moderator" | "member";
  hasSeenVeteranCelebration?: boolean;
  favoriteTopics?: string[];
};

export const ensureUserProfile = async (user: { id?: string; uid?: string; email?: string | null; user_metadata?: any }) => {
  const uid = user.id || user.uid;
  if (!uid) return null;

  try {
    // Try fetching existing profile
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("uid", uid)
      .maybeSingle();

    if (existing) return existing as UserProfile;

    // Profile missing - create default fallback profile
    const rawDisplayName =
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "Freelancer";

    let username = (user.user_metadata?.username || rawDisplayName.toLowerCase().replace(/[^a-z0-9_]/g, "_")).slice(0, 15);
    if (username.length < 3) {
      username = `user_${uid.slice(0, 6)}`;
    }

    // Check username collision
    const { data: taken } = await supabase
      .from("usernames")
      .select("username")
      .eq("username", username)
      .maybeSingle();

    if (taken) {
      username = `user_${Math.floor(100000 + Math.random() * 900000)}`;
    }

    const newProfile: UserProfile = {
      uid,
      username,
      displayName: rawDisplayName,
      initial: rawDisplayName.charAt(0).toUpperCase(),
      bio: "New freelancer on Borynx!",
      location: "Earth",
      website: "",
      joined: new Date().getFullYear().toString(),
      status: "Available",
      skills: [],
      reputation: 10,
      followers: 0,
      following: 0,
      avatarUrl: user.user_metadata?.avatar_url || "",
      isVerifiedPro: false,
      hasSeenVeteranCelebration: false,
      createdAt: new Date().toISOString(),
    };

    const { error: profileErr } = await supabase.from("profiles").upsert(newProfile);
    if (profileErr) {
      console.warn("Could not save profile to backend:", profileErr.message || profileErr);
    }

    try {
      await supabase.from("usernames").upsert({ username, uid });
    } catch {
      // ignore username collision / error
    }

    return newProfile;
  } catch (err) {
    console.warn("ensureUserProfile exception:", err);
    return null;
  }
};

export const createUserProfile = async (uid: string, name: string, email: string) => {
  return ensureUserProfile({ id: uid, email, user_metadata: { display_name: name } });
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Looks a profile up by uid or username. Returns null when nobody matches, so
// the UI can say "not found" instead of inventing a person.
export const getUserProfile = async (identifier: string) => {
  if (!identifier) return null;

  const clean = identifier.startsWith("@") ? identifier.substring(1).trim() : identifier.trim();
  if (!clean) return null;

  try {
    let profileToReturn: UserProfile | null = null;

    // 1. UID (only query the uuid column with something shaped like a uuid)
    if (UUID_RE.test(clean)) {
      const { data: byUid } = await supabase
        .from("profiles")
        .select("*")
        .eq("uid", clean)
        .maybeSingle();
      if (byUid) profileToReturn = byUid as UserProfile;
    }

    // 2. Username, case-insensitive. ilike treats _ and % as wildcards, so escape them.
    if (!profileToReturn) {
      const escaped = clean.replace(/[\\%_]/g, "\\$&");
      const { data: byUsername } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", escaped)
        .maybeSingle();
      if (byUsername) profileToReturn = byUsername as UserProfile;
    }

    // 3. Username registry
    if (!profileToReturn) {
      const escaped = clean.replace(/[\\%_]/g, "\\$&");
      const { data: userRow } = await supabase
        .from("usernames")
        .select("uid")
        .ilike("username", escaped)
        .maybeSingle();

      if (userRow?.uid) {
        const { data: profileByUid } = await supabase
          .from("profiles")
          .select("*")
          .eq("uid", userRow.uid)
          .maybeSingle();
        if (profileByUid) profileToReturn = profileByUid as UserProfile;
      }
    }

    // 4. The signed-in user's own profile (covers "me" and a missing profile row)
    if (!profileToReturn) {
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      if (sessionUser) {
        const sessionEmailName = sessionUser.email?.split("@")[0];
        if (clean === "me" || clean === sessionUser.id || clean.toLowerCase() === sessionEmailName?.toLowerCase()) {
          const ensured = await ensureUserProfile(sessionUser);
          if (ensured) profileToReturn = ensured;
        }
      }
    }

    if (profileToReturn) {
      const savedMap = await getSavedPostIds(profileToReturn.uid);
      profileToReturn.savedPosts = savedMap;
      return profileToReturn;
    }
  } catch (err) {
    console.warn("getUserProfile exception:", err);
  }

  return null;
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

export const checkUsernameAvailability = async (username: string) => {
  if (!username) return false;
  const clean = username.toLowerCase();
  const isValidFormat = /^[a-z0-9_]{3,15}$/.test(clean);
  if (!isValidFormat) return false;

  // A handle is taken if it is in the registry OR already on a profile —
  // the two can drift, and profiles.username is the unique constraint
  // that actually fails at insert time.
  const { data: registered } = await supabase
    .from("usernames")
    .select("username")
    .eq("username", clean)
    .maybeSingle();
  if (registered) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("uid")
    .ilike("username", clean)
    .maybeSingle();

  return !profile;
};

export const claimUsername = async (uid: string, desiredUsername: string, currentUsername?: string) => {
  const lowercaseUsername = desiredUsername.toLowerCase();
  const isValidFormat = /^[a-zA-Z0-9_]{3,15}$/.test(lowercaseUsername);
  if (!isValidFormat) throw new Error("Invalid username format. Use 3-15 alphanumeric characters or underscores.");

  // Check if taken by someone else
  const { data: existing } = await supabase
    .from("usernames")
    .select("uid")
    .eq("username", lowercaseUsername)
    .single();

  if (existing && existing.uid !== uid) {
    throw new Error("Username is already taken.");
  }

  // Release old username if applicable
  if (currentUsername && currentUsername !== lowercaseUsername) {
    await supabase.from("usernames").delete().eq("username", currentUsername);
  }

  // Upsert the new username
  const { error: usernameError } = await supabase
    .from("usernames")
    .upsert({ username: lowercaseUsername, uid });

  if (usernameError) throw new Error(usernameError.message);

  // Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ username: lowercaseUsername })
    .eq("uid", uid);

  if (profileError) throw new Error(profileError.message);

  return true;
};

export const getUidByUsername = async (username: string) => {
  if (!username) return null;
  const clean = username.startsWith("@") ? username.substring(1).toLowerCase() : username.toLowerCase();

  const { data } = await supabase
    .from("usernames")
    .select("uid")
    .ilike("username", clean)
    .maybeSingle();

  if (data?.uid) return data.uid;

  const { data: profile } = await supabase
    .from("profiles")
    .select("uid")
    .ilike("username", clean)
    .maybeSingle();

  return profile?.uid ?? null;
};

export const getSavedPostIds = async (uid: string): Promise<Record<string, boolean>> => {
  if (!uid) return {};
  try {
    const { data, error } = await supabase
      .from("saved_posts")
      .select("postId")
      .eq("userId", uid);

    if (error || !data) return {};
    const map: Record<string, boolean> = {};
    for (const row of data) {
      if (row.postId) map[row.postId] = true;
    }
    return map;
  } catch (err) {
    console.warn("getSavedPostIds error:", err);
    return {};
  }
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

export const updateUserAvatar = async (uid: string, base64Image: string) => {
  if (!uid) return;
  const { error } = await supabase.from("profiles").update({ avatarUrl: base64Image }).eq("uid", uid);
  if (error) throw new Error(error.message);
  return base64Image;
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
  if (isFollowing) {
    const { error } = await supabase.from("follows").delete().eq("followerId", currentUid).eq("followingId", targetUid);
    if (error) throw new Error(error.message);
    const { error: e1 } = await supabase.rpc("decrement_followers", { target_uid: targetUid });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.rpc("decrement_following", { target_uid: currentUid });
    if (e2) throw new Error(e2.message);
  } else {
    const { error } = await supabase.from("follows").insert({ followerId: currentUid, followingId: targetUid });
    if (error) throw new Error(error.message);
    const { error: e1 } = await supabase.rpc("increment_followers", { target_uid: targetUid });
    if (e1) throw new Error(e1.message);
    const { error: e2 } = await supabase.rpc("increment_following", { target_uid: currentUid });
    if (e2) throw new Error(e2.message);
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

  await supabase.from("profiles").update({ reputation: totalScore }).eq("uid", uid);
  return totalScore;
};

export const getTopContributors = async (count = 5) => {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("reputation", { ascending: false })
    .limit(count);

  return (data || []) as UserProfile[];
};

// Real list of user IDs this user follows, from the `follows` join table —
// replaces the old (nonexistent) profile.followingList field.
export const getFollowingIds = async (uid: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("follows")
    .select("followingId")
    .eq("followerId", uid);

  if (error || !data) return [];
  return data.map((row: any) => row.followingId);
};
