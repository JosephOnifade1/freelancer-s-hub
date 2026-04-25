import { ref, get, push, set, serverTimestamp, query, orderByChild, limitToLast, runTransaction } from "firebase/database";
import { database } from "./firebase";
import { PostData } from "@/components/PostCard";

export const fetchPosts = async (): Promise<PostData[]> => {
  const postsRef = ref(database, 'posts');
  const snapshot = await get(postsRef);
  
  if (!snapshot.exists()) {
    return [];
  }

  const posts: PostData[] = [];
  snapshot.forEach((childSnapshot) => {
    const val = childSnapshot.val();
    if (!val.isDeleted) {
      posts.push({
        id: childSnapshot.key as string,
        ...val
      });
    }
  });

  // Sort locally by createdAt descending
  return posts.sort((a, b) => {
    const aTime = a.createdAt || 0;
    const bTime = b.createdAt || 0;
    return bTime - aTime;
  });
};

export const createPost = async (postData: Omit<PostData, 'id'>) => {
  const postsRef = ref(database, 'posts');
  const newPostRef = push(postsRef);
  
  await set(newPostRef, {
    ...postData,
    createdAt: serverTimestamp()
  });

  return newPostRef.key;
};

export const fetchPostById = async (id: string): Promise<PostData | null> => {
  const postRef = ref(database, `posts/${id}`);
  const snapshot = await get(postRef);
  
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.key as string,
    ...snapshot.val()
  };
};

export const updatePost = async (id: string, body: string) => {
  const postRef = ref(database, `posts/${id}`);
  await set(ref(database, `posts/${id}/body`), body);
  await set(ref(database, `posts/${id}/isEdited`), true);
};

export const softDeletePost = async (id: string) => {
  const postRef = ref(database, `posts/${id}`);
  await set(ref(database, `posts/${id}/isDeleted`), true);
  // Do not delete comments as per user requirements
};

export const incrementPostViews = async (id: string) => {
  const viewsRef = ref(database, `posts/${id}/views`);
  await runTransaction(viewsRef, (currentViews) => {
    return (currentViews || 0) + 1;
  });
};
