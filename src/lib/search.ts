import { supabase } from "./supabase";
import { searchProfiles, isProfileError } from "./profile-client";
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

  // Phase 2C: the *user* half of search reads Neon. The post half still reads Supabase
  // — posts have not migrated — and keeps its embedded `profiles!` join, which is why
  // `profiles` must still exist in Supabase until content moves (see the phase report).
  //
  // The two halves are independent: a failed profile search must not lose the post
  // results, so each is handled on its own rather than sharing one `Promise.all`
  // rejection.
  const [postResult, userResult, viewer] = await Promise.all([
    supabase.from("posts").select(`
      id, title, body, category, tags, type, score, ups, downs, views,
      commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
      visibility, allowComments, isPinned, externalLink,
      profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
    `).eq("isDeleted", false).or(`title.ilike.%${term}%,body.ilike.%${term}%`).limit(10),
    searchProfiles(term),
    getPostViewer(),
  ]);
  if (postResult.error) throw new Error(postResult.error.message);
  if (!postResult.data) throw new Error("Search is unavailable right now.");

  // A profile-search failure degrades to "no people matched" rather than failing the
  // whole search: the posts are still useful and the user asked for content too.
  const users = isProfileError(userResult) ? [] : (userResult.data as unknown as UserProfile[]);

  return {
    posts: (postResult.data as PostRow[]).map(mapPostRow).filter((post) => canViewPost(post, viewer)).slice(0, 5),
    users: users.slice(0, 5),
  };
}
