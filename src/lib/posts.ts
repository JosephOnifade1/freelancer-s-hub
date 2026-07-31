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
      avatar: p.profiles?.avatarUrl,
      avatarUrl: p.profiles?.avatarUrl,
      reputation: p.profiles?.reputation || 0,
      isVerifiedPro: p.profiles?.isVerifiedPro || false,
    },
  }));
};

// Posts scoped to a single community — used by CommunityDetail.tsx instead
// of hardcoded fake posts.
export const fetchPostsByCommunity = async (slug: string): Promise<PostData[]> => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `)
    .eq("isDeleted", false)
    .eq("communitySlug", slug)
    .order("createdAt", { ascending: false });

  if (error || !data) {
    console.warn("Could not fetch community posts:", error?.message || error);
    return [];
  }

  return data.map((p: any) => ({
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
      avatar: p.profiles?.avatarUrl,
      avatarUrl: p.profiles?.avatarUrl,
      reputation: p.profiles?.reputation || 0,
      isVerifiedPro: p.profiles?.isVerifiedPro || false,
    },
  }));
};

// Posts authored by a single user — used by Profile.tsx instead of
// hardcoded fake posts.
export const fetchPostsByAuthor = async (uid: string): Promise<PostData[]> => {
  const { data, error } = await supabase
    .from("posts")
    .select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `)
    .eq("isDeleted", false)
    .eq("authorUid", uid)
    .order("createdAt", { ascending: false });

  if (error || !data) {
    console.warn("Could not fetch author posts:", error?.message || error);
    return [];
  }

  return data.map((p: any) => ({
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
      avatar: p.profiles?.avatarUrl,
      avatarUrl: p.profiles?.avatarUrl,
      reputation: p.profiles?.reputation || 0,
      isVerifiedPro: p.profiles?.isVerifiedPro || false,
    },
  }));
};

export const createPost = async (
  postData: Omit<PostData, "id"> & { pollOptions?: string[] }
) => {
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
      visibility: postData.visibility || "public",
      allowComments: postData.allowComments ?? true,
      isPinned: postData.isPinned ?? false,
      externalLink: postData.externalLink || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const postId = data?.id as string;

  // Real poll: create the poll row + its options so voting has something
  // to attach to. Silently skipped if no options were actually provided.
  const cleanOptions = (postData.pollOptions || []).map((o) => o.trim()).filter(Boolean);
  if (postData.type === "poll" && cleanOptions.length >= 2) {
    const { data: poll, error: pollError } = await supabase
      .from("polls")
      .insert({ postId })
      .select("id")
      .single();

    if (!pollError && poll?.id) {
      await supabase.from("poll_options").insert(
        cleanOptions.map((label, i) => ({ pollId: poll.id, label, position: i }))
      );
    }
  }

  return postId;
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
      avatar: (data as any).profiles?.avatarUrl,
      avatarUrl: (data as any).profiles?.avatarUrl,
      reputation: (data as any).profiles?.reputation || 0,
      isVerifiedPro: (data as any).profiles?.isVerifiedPro || false,
    },
  };
};

export const updatePost = async (id: string, body: string) => {
  await supabase.from("posts").update({ body, isEdited: true }).eq("id", id);
};

export const sharePostToCommunity = async (id: string, communitySlug: string) => {
  const { error } = await supabase
    .from("posts")
    .update({ communitySlug })
    .eq("id", id);

  if (error) throw new Error(error.message);
};

export const softDeletePost = async (id: string) => {
  await supabase.from("posts").update({ isDeleted: true }).eq("id", id);
};

export const incrementPostViews = async (id: string) => {
  await supabase.rpc("increment_post_views", { post_id: id });
};
