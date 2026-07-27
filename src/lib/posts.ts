import { supabase } from "./supabase";
import { PostData } from "@/components/PostCard";

export const fetchPosts = async (): Promise<PostData[]> => {
  let { data, error } = await supabase
    .from("posts")
    .select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      profiles (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `)
    .eq("isDeleted", false)
    .order("createdAt", { ascending: false });

  if (error) {
    const retry = await supabase
      .from("posts")
      .select(`
        id, title, body, category, tags, type, score, ups, downs, views,
        commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
        profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
      `)
      .eq("isDeleted", false)
      .order("createdAt", { ascending: false });

    data = retry.data;
    error = retry.error;
  }

  if (error) {
    const fallback = await supabase
      .from("posts")
      .select("*")
      .eq("isDeleted", false)
      .order("createdAt", { ascending: false });

    data = fallback.data;
    error = fallback.error;
  }

  if (error || !data) {
    console.warn("Could not fetch posts from Supabase backend:", error?.message || error);
    return [];
  }

  return (data || []).map((p: any) => ({
    id: p.id,
    title: p.title,
    body: p.body,
    category: p.category,
    tags: p.tags || [],
    type: p.type,
    score: p.score,
    ups: p.ups,
    downs: p.downs,
    views: p.views,
    commentCount: p.commentCount,
    isDeleted: p.isDeleted,
    isEdited: p.isEdited,
    createdAt: new Date(p.createdAt).getTime(),
    communitySlug: p.communitySlug,
    author: {
      uid: p.authorUid,
      name: p.profiles?.displayName || p.profiles?.username || "Unknown",
      username: p.profiles?.username,
      avatarUrl: p.profiles?.avatarUrl,
      reputation: p.profiles?.reputation || 0,
      isVerifiedPro: p.profiles?.isVerifiedPro || false,
    },
  }));
};

export const createPost = async (postData: Omit<PostData, "id">) => {
  const { data, error } = await supabase
    .from("posts")
    .insert({
      title: postData.title,
      body: postData.body,
      category: postData.category,
      tags: postData.tags || [],
      type: postData.type || "discussion",
      score: 0,
      ups: 0,
      downs: 0,
      views: 0,
      commentCount: 0,
      isDeleted: false,
      isEdited: false,
      authorUid: postData.author?.uid,
      communitySlug: postData.communitySlug || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data?.id as string;
};

export const fetchPostById = async (id: string): Promise<PostData | null> => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    body: data.body,
    category: data.category,
    tags: data.tags || [],
    type: data.type,
    score: data.score,
    ups: data.ups,
    downs: data.downs,
    views: data.views,
    commentCount: data.commentCount,
    isDeleted: data.isDeleted,
    isEdited: data.isEdited,
    createdAt: new Date(data.createdAt).getTime(),
    communitySlug: data.communitySlug,
    author: {
      uid: data.authorUid,
      name: (data as any).profiles?.displayName || (data as any).profiles?.username || "Unknown",
      username: (data as any).profiles?.username,
      avatarUrl: (data as any).profiles?.avatarUrl,
      reputation: (data as any).profiles?.reputation || 0,
      isVerifiedPro: (data as any).profiles?.isVerifiedPro || false,
    },
  };
};

export const updatePost = async (id: string, body: string) => {
  await supabase.from("posts").update({ body, isEdited: true }).eq("id", id);
};

export const softDeletePost = async (id: string) => {
  await supabase.from("posts").update({ isDeleted: true }).eq("id", id);
};

export const incrementPostViews = async (id: string) => {
  await supabase.rpc("increment_post_views", { post_id: id });
};
