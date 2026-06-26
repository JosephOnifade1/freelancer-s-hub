import { ref, get, set, serverTimestamp, runTransaction } from "firebase/database";
import { database } from "./firebase";

export interface CommunityData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  topics: string[];
  createdAt: any;
  ownerId: string;
  memberCount: number;
}

/** Seed default communities if they don't exist in Firebase. */
const DEFAULT_COMMUNITIES: Omit<CommunityData, 'id' | 'createdAt'>[] = [
  { slug: "design", name: "Design", description: "UI, UX, branding, illustration.", topics: ["ui", "ux", "branding"], ownerId: "system", memberCount: 0 },
  { slug: "dev", name: "Freelance Dev", description: "Web, mobile, full-stack devs going solo.", topics: ["web", "mobile", "backend"], ownerId: "system", memberCount: 0 },
  { slug: "writing", name: "Writing", description: "Copywriters, content writers, ghostwriters.", topics: ["copy", "content", "ghostwriting"], ownerId: "system", memberCount: 0 },
  { slug: "marketing", name: "Marketing", description: "Growth, SEO, paid ads, email.", topics: ["seo", "growth", "ads"], ownerId: "system", memberCount: 0 },
  { slug: "video", name: "Video & Motion", description: "Editors, motion designers, animators.", topics: ["video", "motion", "animation"], ownerId: "system", memberCount: 0 },
  { slug: "consulting", name: "Consulting", description: "Strategy, ops, advisory work.", topics: ["strategy", "ops", "advisory"], ownerId: "system", memberCount: 0 },
];

export const seedDefaultCommunities = async () => {
  for (const community of DEFAULT_COMMUNITIES) {
    const communityRef = ref(database, `communities/${community.slug}`);
    const snapshot = await get(communityRef);
    if (!snapshot.exists()) {
      await set(communityRef, { ...community, createdAt: serverTimestamp() });
    }
  }
};

export const createCommunity = async (slug: string, data: Omit<CommunityData, 'createdAt' | 'memberCount' | 'id' | 'slug'>) => {
  const communityRef = ref(database, `communities/${slug}`);
  const snapshot = await get(communityRef);
  if (snapshot.exists()) {
    throw new Error("Community with this URL slug already exists.");
  }
  const communityData: CommunityData = {
    ...data,
    slug,
    memberCount: 1,
    createdAt: serverTimestamp()
  };
  await set(communityRef, communityData);
  return slug;
};

export const fetchCommunity = async (slug: string): Promise<CommunityData | null> => {
  const communityRef = ref(database, `communities/${slug}`);
  const snapshot = await get(communityRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.key as string, ...snapshot.val() };
};

export const fetchAllCommunities = async (): Promise<CommunityData[]> => {
  const communitiesRef = ref(database, 'communities');
  const snapshot = await get(communitiesRef);
  if (!snapshot.exists()) return [];
  const communities: CommunityData[] = [];
  snapshot.forEach((child) => {
    communities.push({ id: child.key as string, ...child.val() });
  });
  return communities;
};

export const joinCommunity = async (uid: string, slug: string) => {
  // Add to user's communitiesList
  await set(ref(database, `users/${uid}/communitiesList/${slug}`), true);
  // Increment community memberCount
  await runTransaction(ref(database, `communities/${slug}/memberCount`), (val) => (val || 0) + 1);
};

export const leaveCommunity = async (uid: string, slug: string) => {
  // Remove from user's communitiesList
  await set(ref(database, `users/${uid}/communitiesList/${slug}`), null);
  // Decrement community memberCount
  await runTransaction(ref(database, `communities/${slug}/memberCount`), (val) => Math.max(0, (val || 0) - 1));
};
