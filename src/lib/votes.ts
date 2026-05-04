import { ref, get, set, runTransaction } from "firebase/database";
import { database } from "./firebase";

export const fetchUserVote = async (entityId: string, userId: string, type: "post" | "comment" = "post"): Promise<number> => {
  const voteRef = ref(database, `${type}-votes/${entityId}/${userId}`);
  const snapshot = await get(voteRef);
  return snapshot.exists() ? snapshot.val() : 0;
};

export const handleVote = async (
  entityId: string, 
  authorUid: string | undefined, 
  currentUserId: string, 
  newVote: 1 | -1 | 0,
  type: "post" | "comment" = "post",
  postIdForComment?: string // Required if type === 'comment' to locate the comment inside post-comments
) => {
  if (!currentUserId) throw new Error("Must be logged in to vote");

  const voteRef = ref(database, `${type}-votes/${entityId}/${currentUserId}`);
  const snapshot = await get(voteRef);
  const previousVote: number = snapshot.exists() ? snapshot.val() : 0;

  if (previousVote === newVote) return; // No change

  const diff = newVote - previousVote;
  const upDiff = (newVote === 1 ? 1 : 0) - (previousVote === 1 ? 1 : 0);
  const downDiff = (newVote === -1 ? 1 : 0) - (previousVote === -1 ? 1 : 0);

  // 1. Save new user vote
  await set(voteRef, newVote);

  // 2. Update entity score, ups, and downs
  const entityBaseRef = type === "post" ? `posts/${entityId}` : `post-comments/${postIdForComment}/${entityId}`;
  
  const scoreRef = ref(database, `${entityBaseRef}/score`);
  await runTransaction(scoreRef, (currentScore) => {
    return (currentScore || 0) + diff;
  });

  if (upDiff !== 0) {
    const upsRef = ref(database, `${entityBaseRef}/ups`);
    await runTransaction(upsRef, (currentUps) => (currentUps || 0) + upDiff);
  }

  if (downDiff !== 0) {
    const downsRef = ref(database, `${entityBaseRef}/downs`);
    await runTransaction(downsRef, (currentDowns) => (currentDowns || 0) + downDiff);
  }

  // 3. Update author reputation (Reddit style: 1:1 karma)
  if (authorUid && authorUid !== currentUserId) {
    const repRef = ref(database, `users/${authorUid}/reputation`);
    await runTransaction(repRef, (currentRep) => {
      return (currentRep || 0) + diff; // changed from diff * 10
    });
  }
};
