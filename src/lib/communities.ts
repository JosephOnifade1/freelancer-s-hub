import { ref, get, set, serverTimestamp, query, orderByChild, equalTo } from "firebase/database";
import { database } from "./firebase";

export interface CommunityData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  topics: string[];
  createdAt: any;
  ownerId: string;
  memberCount: number;
}

export const createCommunity = async (slug: string, data: Omit<CommunityData, 'createdAt' | 'memberCount' | 'id'>) => {
  const communityRef = ref(database, `communities/${slug}`);
  
  // Check if it already exists
  const snapshot = await get(communityRef);
  if (snapshot.exists()) {
    throw new Error("Community with this URL slug already exists.");
  }
  
  const communityData: CommunityData = {
    ...data,
    slug,
    memberCount: 1, // The owner is the first member
    createdAt: serverTimestamp()
  };

  await set(communityRef, communityData);
  return slug;
};

export const fetchCommunity = async (slug: string): Promise<CommunityData | null> => {
  const communityRef = ref(database, `communities/${slug}`);
  const snapshot = await get(communityRef);
  
  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.key as string,
    ...snapshot.val()
  };
};
