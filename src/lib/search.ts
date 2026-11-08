import { supabase } from "./supabase";
import { PostData } from "@/components/PostCard";
import { UserProfile } from "./users";
import { mapPostRow, getPostViewer, canViewPost, PostRow } from "./posts";

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
      visibility, allowComments, isPinned, externalLink,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `)
    .eq("isDeleted", false)
    .or(`title.ilike.%${term}%,body.ilike.%${term}%`)
    .limit(10);

  // Search results obey the same visibility rules as the feed.
  const viewer = await getPostViewer();
  const posts: PostData[] = ((postsData || []) as PostRow[])
    .map(mapPostRow)
    .filter((post) => canViewPost(post, viewer));

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
