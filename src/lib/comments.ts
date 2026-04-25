import { ref, get, push, set, serverTimestamp, runTransaction } from "firebase/database";
import { database } from "./firebase";

export interface CommentData {
  id: string;
  author: string;
  authorUid?: string;
  reputation: number;
  body: string;
  score: number;
  createdAt: number;
  parentId?: string; // Used to structure flat comments into a tree
  replies?: CommentData[]; // Reserved for future thread implementation
  isDeleted?: boolean;
  isEdited?: boolean;
}

export const fetchComments = async (postId: string): Promise<CommentData[]> => {
  const commentsRef = ref(database, `post-comments/${postId}`);
  const snapshot = await get(commentsRef);
  
  if (!snapshot.exists()) {
    return [];
  }

  const comments: CommentData[] = [];
  snapshot.forEach((childSnapshot) => {
    comments.push({
      id: childSnapshot.key as string,
      ...childSnapshot.val()
    });
  });

  // Simple sort by creation time (ascending)
  return comments.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
};

export const addComment = async (postId: string, commentData: Omit<CommentData, 'id' | 'createdAt' | 'score'>) => {
  const commentsRef = ref(database, `post-comments/${postId}`);
  const newCommentRef = push(commentsRef);
  
  await set(newCommentRef, {
    ...commentData,
    score: 0,
    createdAt: serverTimestamp()
  });

  // Increment Post Comment Count
  const countRef = ref(database, `posts/${postId}/commentCount`);
  await runTransaction(countRef, (currentCount) => {
    return (currentCount || 0) + 1;
  });

  return newCommentRef.key;
};

export const fetchCommentsByAuthor = async (profile: { uid: string, username: string, displayName: string }): Promise<(CommentData & { postId: string })[]> => {
  const allCommentsRef = ref(database, 'post-comments');
  const snapshot = await get(allCommentsRef);
  if (!snapshot.exists()) return [];

  const userComments: (CommentData & { postId: string })[] = [];
  snapshot.forEach((postSnapshot) => {
    const postId = postSnapshot.key as string;
    postSnapshot.forEach((commentSnapshot) => {
      const comment = commentSnapshot.val();
      if (
        !comment.isDeleted && (
          comment.authorUid === profile.uid || 
          comment.author === profile.username || 
          comment.author === profile.displayName
        )
      ) {
        userComments.push({
          id: commentSnapshot.key as string,
          postId,
          ...comment
        });
      }
    });
  });

  return userComments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

export const updateComment = async (postId: string, commentId: string, body: string) => {
  await set(ref(database, `post-comments/${postId}/${commentId}/body`), body);
  await set(ref(database, `post-comments/${postId}/${commentId}/isEdited`), true);
};

export const softDeleteComment = async (postId: string, commentId: string) => {
  await set(ref(database, `post-comments/${postId}/${commentId}/isDeleted`), true);
  // Decrement the post's comment count
  const countRef = ref(database, `posts/${postId}/commentCount`);
  await runTransaction(countRef, (currentCount) => {
    return Math.max(0, (currentCount || 0) - 1);
  });
};
