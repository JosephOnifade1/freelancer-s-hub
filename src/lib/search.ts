import { supabase } from "./supabase";
import type { PostData } from "@/components/PostCard";
import type { UserProfile } from "./users";
import { mapPostRow, getPostViewer, canViewPost, type PostRow } from "./posts";

export interface SearchResults {
  posts: PostData[];
  users: UserProfile[];
}

/** Search only posts and people; RLS and the client visibility mirror both apply. */
export async function globalSearch(searchTerm: string): Promise<SearchResults> {
  // .or() accepts a PostgREST expression, not raw user input. Restrict the
  // pattern to words/spaces to avoid filter syntax injection or wildcards.
  const term = searchTerm.trim().slice(0, 80).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (term.length < 2) return { posts: [], users: [] };

  const [postResult, userResult, viewer] = await Promise.all([
    supabase.from("posts").select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      visibility, allowComments, isPinned, externalLink,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `).eq("isDeleted", false).or(`title.ilike.%${term}%,body.ilike.%${term}%`).limit(10),
    supabase.from("profiles").select("*")
      .or(`displayName.ilike.%${term}%,username.ilike.%${term}%,bio.ilike.%${term}%`).limit(10),
    getPostViewer(),
  ]);
  if (postResult.error) throw new Error(postResult.error.message);
  if (userResult.error) throw new Error(userResult.error.message);
  if (!postResult.data || !userResult.data) throw new Error("Search is unavailable right now.");

  return {
    posts: (postResult.data as PostRow[]).map(mapPostRow).filter((post) => canViewPost(post, viewer)).slice(0, 5),
    users: (userResult.data as UserProfile[]).slice(0, 5),
  };
}
