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
  hasSeenVeteranCelebration?: boolean;
  favoriteTopics?: string[];
};

export const createUserProfile = async (uid: string, name: string, email: string) => {
  // Profile is auto-created by the SQL trigger on auth.users insert.
  // This function now simply fetches the profile, which should already exist.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("uid", uid)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching profile:", error);
  }

  // If profile doesn't exist yet (trigger may be slow), try updating displayName
  if (!data?.displayName && name) {
    await supabase
      .from("profiles")
      .update({ displayName: name, initial: name.charAt(0).toUpperCase() })
      .eq("uid", uid);
  }

  return data as UserProfile | null;
};

export const getUserProfile = async (uid: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("uid", uid)
    .single();

  if (error) return null;
  return data as UserProfile;
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
  const isValidFormat = /^[a-zA-Z0-9_]{3,15}$/.test(username);
  if (!isValidFormat) return false;

  const { data } = await supabase
    .from("usernames")
    .select("username")
    .eq("username", username.toLowerCase())
    .single();

  return !data;
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
  const { data } = await supabase
    .from("usernames")
    .select("uid")
    .eq("username", username.toLowerCase())
    .single();

  return data?.uid ?? null;
};

export const toggleBookmark = async (uid: string, postId: string) => {
  if (!uid || !postId) return false;

  const { data: existing } = await supabase
    .from("saved_posts")
    .select("postId")
    .eq("userId", uid)
    .eq("postId", postId)
    .single();

  if (existing) {
    await supabase.from("saved_posts").delete().eq("userId", uid).eq("postId", postId);
    return false;
  } else {
    await supabase.from("saved_posts").insert({ userId: uid, postId });
    return true;
  }
};

export const updateUserAvatar = async (uid: string, base64Image: string) => {
  if (!uid) return;
  await supabase.from("profiles").update({ avatarUrl: base64Image }).eq("uid", uid);
  return base64Image;
};

export const toggleFollow = async (currentUid: string, targetUid: string) => {
  if (currentUid === targetUid) return;

  const { data: existing } = await supabase
    .from("follows")
    .select("followingId")
    .eq("followerId", currentUid)
    .eq("followingId", targetUid)
    .single();

  const isFollowing = !!existing;

  if (isFollowing) {
    await supabase.from("follows").delete().eq("followerId", currentUid).eq("followingId", targetUid);
    await supabase.rpc("decrement_followers", { target_uid: targetUid });
    await supabase.rpc("decrement_following", { target_uid: currentUid });
  } else {
    await supabase.from("follows").insert({ followerId: currentUid, followingId: targetUid });
    await supabase.rpc("increment_followers", { target_uid: targetUid });
    await supabase.rpc("increment_following", { target_uid: currentUid });
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
