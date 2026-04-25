import { ref, get, set, serverTimestamp, runTransaction } from "firebase/database";
import { database } from "./firebase";

export type UserProfile = {
  uid: string;
  username: string; // the unique @handle (lowercase)
  displayName: string; // visual name
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
  savedPosts?: Record<string, boolean>;
  createdAt: any;
  avatarUrl?: string;
  isVerifiedPro?: boolean;
};

export const toggleBookmark = async (uid: string, postId: string) => {
  if (!uid || !postId) return false;
  const bookmarkRef = ref(database, `users/${uid}/savedPosts/${postId}`);
  const snapshot = await get(bookmarkRef);
  if (snapshot.exists()) {
    await set(bookmarkRef, null);
    return false; // unsaved
  } else {
    await set(bookmarkRef, true);
    return true; // saved
  }
};

export const updateUserAvatar = async (uid: string, base64Image: string) => {
  if (!uid) return;
  await set(ref(database, `users/${uid}/avatarUrl`), base64Image);
  return base64Image;
};

export const createUserProfile = async (uid: string, name: string, email: string) => {
  const userRef = ref(database, `users/${uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    // Generate a unique auto-username
    let isUnique = false;
    let autoUsername = "";
    while (!isUnique) {
      autoUsername = `user_${Math.random().toString(36).substring(2, 8)}`;
      const usernameRef = ref(database, `usernames/${autoUsername}`);
      const snap = await get(usernameRef);
      if (!snap.exists()) {
        isUnique = true;
      }
    }

    // Secure the auto-generated username
    await set(ref(database, `usernames/${autoUsername}`), uid);

    const joinedYear = new Date().getFullYear().toString();
    const newUser: UserProfile = {
      uid,
      username: autoUsername,
      displayName: name || email.split("@")[0],
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

  // Handle existing users who might not have a displayName or unique username
  const existingData = snapshot.val();
  if (!existingData.displayName) {
    const defaultName = name || email.split("@")[0];
    await set(ref(database, `users/${uid}/displayName`), defaultName);
    existingData.displayName = defaultName;
  }
  
  return existingData as UserProfile;
};

export const getUserResourcesCount = async (uid: string) => {
  const postsRef = ref(database, 'posts');
  const snapshot = await get(postsRef);
  if (!snapshot.exists()) return 0;

  let count = 0;
  snapshot.forEach(child => {
    const post = child.val();
    if (post.author?.uid === uid && post.type === 'resource' && !post.isDeleted) {
      count++;
    }
  });
  return count;
};

export const checkUsernameAvailability = async (username: string) => {
  if (!username) return false;
  // Regex: alphanumeric and underscores, 3-15 chars
  const isValidFormat = /^[a-zA-Z0-9_]{3,15}$/.test(username);
  if (!isValidFormat) return false;

  const usernameRef = ref(database, `usernames/${username.toLowerCase()}`);
  const snapshot = await get(usernameRef);
  return !snapshot.exists();
};

export const claimUsername = async (uid: string, desiredUsername: string, currentUsername?: string) => {
  const lowercaseUsername = desiredUsername.toLowerCase();
  
  // 1. Validate format
  const isValidFormat = /^[a-zA-Z0-9_]{3,15}$/.test(lowercaseUsername);
  if (!isValidFormat) throw new Error("Invalid username format. Use 3-15 alphanumeric characters or underscores.");

  const usernameRef = ref(database, `usernames/${lowercaseUsername}`);
  
  // 2. Use transaction to claim
  const transactionResult = await runTransaction(usernameRef, (currentData) => {
    if (currentData === null) {
      return uid; // Claim it
    } else if (currentData === uid) {
      return uid; // Already own it
    } else {
      return; // Abort transaction if taken
    }
  });

  if (!transactionResult.committed) {
    throw new Error("Username is already taken.");
  }

  // 3. Update user profile
  await set(ref(database, `users/${uid}/username`), lowercaseUsername);

  // 4. Release old username if applicable
  if (currentUsername && currentUsername !== lowercaseUsername) {
    const oldUsernameRef = ref(database, `usernames/${currentUsername}`);
    await set(oldUsernameRef, null);
  }

  return true;
};

export const getUidByUsername = async (username: string) => {
  const lowercaseUsername = username.toLowerCase();
  const usernameRef = ref(database, `usernames/${lowercaseUsername}`);
  const snapshot = await get(usernameRef);
  if (snapshot.exists()) {
    return snapshot.val() as string;
  }
  return null;
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

/**
 * Calculates total reputation by summing scores of all posts and comments by the user.
 * Note: For large scale, we'd use Cloud Functions or increment on vote. 
 * This is a manual recalculation engine as requested.
 */
export const calculateReputation = async (uid: string) => {
  let totalScore = 0;

  // 1. Get all posts scores
  const postsRef = ref(database, 'posts');
  const postsSnap = await get(postsRef);
  if (postsSnap.exists()) {
    postsSnap.forEach(postSnap => {
      const post = postSnap.val();
      if (post.author?.uid === uid) {
        totalScore += (post.score || 0);
      }
    });
  }

  // 2. Get all comments scores
  const commentsRef = ref(database, 'post-comments');
  const commentsSnap = await get(commentsRef);
  if (commentsSnap.exists()) {
    commentsSnap.forEach(postCommentsSnap => {
      postCommentsSnap.forEach(commentSnap => {
        const comment = commentSnap.val();
        if (comment.authorUid === uid) {
          totalScore += (comment.score || 0);
        }
      });
    });
  }

  // Seed Personas Benchmark: Static high starting reputation
  if (['marcelo_dev', 'designkara', 'freelance_mike'].includes(uid)) {
    totalScore = Math.max(totalScore, 1800);
  }

  // Update in DB
  await set(ref(database, `users/${uid}/reputation`), totalScore);
  return totalScore;
};

export const getTopContributors = async (count = 5) => {
  const usersRef = ref(database, 'users');
  const snapshot = await get(usersRef);
  if (!snapshot.exists()) return [];

  const users: UserProfile[] = [];
  snapshot.forEach(child => {
    users.push(child.val());
  });

  return users
    .sort((a, b) => (b.reputation || 0) - (a.reputation || 0))
    .slice(0, count);
};
