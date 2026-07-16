import { supabase } from "./supabase";

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

export const seedDefaultCommunities = async () => {
  // Default communities are already seeded by supabase_schema.sql.
  // This function is a no-op kept for compatibility.
};

export const createCommunity = async (
  slug: string,
  data: Omit<CommunityData, "createdAt" | "memberCount" | "id" | "slug">
) => {
  const { error } = await supabase
    .from("communities")
    .insert({ ...data, slug, memberCount: 1 });

  if (error) throw new Error(error.message);
  return slug;
};

export const fetchCommunity = async (slug: string): Promise<CommunityData | null> => {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as CommunityData;
};

export const fetchAllCommunities = async (): Promise<CommunityData[]> => {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .order("name");

  if (error) return [];
  return (data || []) as CommunityData[];
};

export const joinCommunity = async (uid: string, slug: string) => {
  const { error } = await supabase
    .from("community_members")
    .insert({ userId: uid, communitySlug: slug });

  if (error && error.code !== "23505") throw new Error(error.message); // Ignore duplicate

  await supabase.rpc("increment_community_members", { community_slug: slug });

  await supabase
    .from("profiles")
    .update({
      communitiesList: supabase.rpc("jsonb_set_community", {
        uid,
        slug,
        value: true,
      }) as any,
    })
    .eq("uid", uid);
};

export const leaveCommunity = async (uid: string, slug: string) => {
  await supabase
    .from("community_members")
    .delete()
    .eq("userId", uid)
    .eq("communitySlug", slug);

  await supabase.rpc("decrement_community_members", { community_slug: slug });
};

export const getUserCommunities = async (uid: string): Promise<string[]> => {
  const { data } = await supabase
    .from("community_members")
    .select("communitySlug")
    .eq("userId", uid);

  return (data || []).map((row: any) => row.communitySlug);
};
