import { ref, get, push, set, serverTimestamp } from "firebase/database";
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

  return newCommentRef.key;
};

export const fetchCommentsByAuthor = async (username: string): Promise<(CommentData & { postId: string })[]> => {
  const allCommentsRef = ref(database, 'post-comments');
  const snapshot = await get(allCommentsRef);
  if (!snapshot.exists()) return [];

  const userComments: (CommentData & { postId: string })[] = [];
  snapshot.forEach((postSnapshot) => {
    const postId = postSnapshot.key as string;
    postSnapshot.forEach((commentSnapshot) => {
      const comment = commentSnapshot.val();
      if (comment.author === username) {
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
