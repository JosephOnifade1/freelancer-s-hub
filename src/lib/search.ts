import { searchProfiles, isProfileError } from "./profile-client";
import {
  fetchContentPosts,
  hydrateAuthors,
  isContentError,
} from "./content-client";
import type { PostData } from "@/components/PostCard";
import type { UserProfile } from "./users";
import { mapPostRow, type PostRow } from "./posts";

/**
 * Global search — **both halves now read Neon** (Phase 2D).
 *
 * The user half moved in 2C. The post half moved here, which is what finally removes
 * the last embedded `profiles!posts_authorUid_fkey` join: the post search returns
 * posts by `authorUid`, and authors are hydrated from the profile endpoint in one
 * batch, exactly as the feed does.
 *
 * The two halves stay independent on purpose: a failed profile search must not lose
 * the post results, so each failure is handled on its own rather than sharing one
 * `Promise.all` rejection. That behaviour predates the migration and is preserved.
 */

export interface SearchResults {
  posts: PostData[];
  users: UserProfile[];
}

/** Visibility over the *returned* rows is still applied by the server; see `posts.ts`. */
export async function globalSearch(searchTerm: string): Promise<SearchResults> {
  const term = searchTerm
    .trim()
    .slice(0, 80)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (term.length < 2) return { posts: [], users: [] };

  const [postResult, userResult] = await Promise.all([
    // The server does the matching, so a post older than the newest ten can still be
    // found. `limit` is the result cap, not a pre-filter window.
    fetchContentPosts({ search: term, limit: 5 }),
    searchProfiles(term),
  ]);

  // A profile-search failure degrades to "no people matched" rather than failing the
  // whole search: the posts are still useful and the user asked for content too.
  const users = isProfileError(userResult)
    ? []
    : (userResult.data as unknown as UserProfile[]).slice(0, 5);

  if (isContentError(postResult)) {
    // Symmetrically, a post-search failure must not take the people results with it.
    return { posts: [], users };
  }

  // The server already matched title/body with a bound `ilike` and applied the
  // visibility filter, so these rows are authorized *and* relevant. Nothing is
  // re-filtered here — a client-side filter on top would only be able to remove rows.
  const matches = postResult.data.slice(0, 5);

  const authors = await hydrateAuthors(matches.map((post) => post.authorUid));

  return {
    posts: matches.map((post) =>
      mapPostRow(post as unknown as PostRow, authors.get(post.authorUid) ?? null),
    ),
    users,
  };
}
