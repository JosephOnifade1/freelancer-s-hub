import { ref, get, set, serverTimestamp, runTransaction } from "firebase/database";
import { database } from "./firebase";

export type UserProfile = {
  uid: string;
  username: string;
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
  followingList?: Record<string, boolean>;
  followersList?: Record<string, boolean>;
  createdAt: any;
};

export const createUserProfile = async (uid: string, name: string, email: string) => {
  const userRef = ref(database, `users/${uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    const joinedYear = new Date().getFullYear().toString();
    const newUser: UserProfile = {
      uid,
      username: name || email.split("@")[0],
      initial: name ? name.charAt(0).toUpperCase() : email.charAt(0).toUpperCase(),
      bio: "New to Soloboard!",
      location: "Earth",
      website: "",
      joined: joinedYear,
      status: "Available",
      skills: [],
      reputation: 0,
      followers: 0,
      following: 0,
      createdAt: serverTimestamp(),
    };
    await set(userRef, newUser);
    return newUser;
  }
  return snapshot.val() as UserProfile;
};

export const getUserProfile = async (uid: string) => {
  const userRef = ref(database, `users/${uid}`);
  const snapshot = await get(userRef);
  if (snapshot.exists()) {
    return snapshot.val() as UserProfile;
  }
  return null;
};

export const toggleFollow = async (currentUid: string, targetUid: string) => {
  if (currentUid === targetUid) return;

  const followingRef = ref(database, `users/${currentUid}/followingList/${targetUid}`);
  const followerRef = ref(database, `users/${targetUid}/followersList/${currentUid}`);

  const snapshot = await get(followingRef);
  const isFollowing = snapshot.exists() && snapshot.val() === true;

  if (isFollowing) {
    // Unfollow
    await set(followingRef, null);
    await set(followerRef, null);
    
    await runTransaction(ref(database, `users/${currentUid}/following`), (val) => Math.max(0, (val || 0) - 1));
    await runTransaction(ref(database, `users/${targetUid}/followers`), (val) => Math.max(0, (val || 0) - 1));
  } else {
    // Follow
    await set(followingRef, true);
    await set(followerRef, true);
    
    await runTransaction(ref(database, `users/${currentUid}/following`), (val) => (val || 0) + 1);
    await runTransaction(ref(database, `users/${targetUid}/followers`), (val) => (val || 0) + 1);
  }

  return !isFollowing;
};
