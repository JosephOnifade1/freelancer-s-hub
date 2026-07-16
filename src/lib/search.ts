import { supabase } from "./supabase";
import { PostData } from "@/components/PostCard";
import { UserProfile } from "./users";

export interface SearchResults {
  posts: PostData[];
  users: UserProfile[];
}

export async function globalSearch(searchTerm: string): Promise<SearchResults> {
  if (!searchTerm || searchTerm.length < 2) return { posts: [], users: [] };

  const term = searchTerm.toLowerCase();

  // Search Posts using ilike on title, body, and tags
  const { data: postsData } = await supabase
    .from("posts")
    .select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `)
    .eq("isDeleted", false)
    .or(`title.ilike.%${term}%,body.ilike.%${term}%`)
    .limit(10);

  const posts: PostData[] = (postsData || []).map((p: any) => ({
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

  // Search Users using ilike on displayName, username, and bio
  const { data: usersData } = await supabase
    .from("profiles")
    .select("*")
    .or(`displayName.ilike.%${term}%,username.ilike.%${term}%,bio.ilike.%${term}%`)
    .limit(10);

  const users: UserProfile[] = (usersData || []) as UserProfile[];

  return {
    posts: posts.slice(0, 5),
    users: users.slice(0, 5),
  };
}
