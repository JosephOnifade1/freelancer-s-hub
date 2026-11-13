import { supabase } from "./supabase";
import { fetchOwnRole } from "./profile-client";
import {
  createContentPost,
  deleteContentPost,
  fetchContentPost,
  fetchContentPosts,
  hydrateAuthor,
  hydrateAuthors,
  isContentError,
  recordContentView,
  updateContentPost,
  type ContentPost,
  type FeedQuery as ContentFeedQuery,
} from "./content-client";
import { PostData } from "@/components/PostCard";

/**
 * Posts — read and write against Neon via `/api/content` (Phase 2D).
 *
 * What changed from the Supabase implementation
 * ---------------------------------------------
 *  1. **No `profiles!` join.** Posts and profiles are now both in Neon but the API
 *     keeps them as separate authorized reads: the post payload carries `authorUid`,
 *     and the browser hydrates authors from the profile endpoint in one batched
 *     request (`hydrateAuthors`). The join existed only because both tables were in
 *     the same database; keeping it would mean the post endpoint projecting profile
 *     columns, which is exactly how `role` leaked in the old `select("*")` paths.
 *
 *  2. **Visibility is a server `where` clause, not a client filter.** `visibleOnly`
 *     used to fetch every post and filter in the browser — so protected rows crossed
 *     the network and were removed in JavaScript. The server now applies
 *     `authorizationFilter` inside the query. `canViewPost` is kept and still exported
 *     because `PostCard` and demo mode use it, but it is no longer the boundary.
 *
 *  3. **Author checks moved to the server.** `updatePost`/`softDeletePost` used to
 *     send `.eq("id", id)` and rely on RLS. The route scopes the update to the
 *     caller's own row; a non-author gets `not_found`.
 */

export interface PostRow {
  id: string;
  title: string;
  body: string;
  category?: string;
  tags?: string[];
  type: PostData["type"];
  score: number;
  ups?: number;
  downs?: number;
  views?: number;
  commentCount: number;
  isDeleted?: boolean;
  isEdited?: boolean;
  createdAt: string;
  communitySlug?: string | null;
  authorUid?: string;
  visibility?: PostData["visibility"];
  allowComments?: boolean;
  isPinned?: boolean;
  externalLink?: string | null;
  profiles?: {
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    reputation?: number;
    isVerifiedPro?: boolean;
  } | null;
}

/**
 * Maps a Neon post plus an already-hydrated author to the shape the UI renders.
 *
 * Kept as a plain function (rather than folded into the fetch calls) because
 * `search.ts` and the tests use it directly, and because the author is now supplied
 * by the caller instead of arriving as a nested object.
 */
/** The author identity `mapPostRow` accepts, from either source. */
export interface AuthorIdentity {
  name?: string;
  displayName?: string;
  username?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  reputation?: number;
  isVerifiedPro?: boolean;
}

export function mapPostRow(p: PostRow, author?: AuthorIdentity | null): PostData {
  const resolved: AuthorIdentity | undefined = author ?? p.profiles ?? undefined;
  return {
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
    communitySlug: p.communitySlug || undefined,
    visibility: (p.visibility as PostData["visibility"]) || "public",
    allowComments: p.allowComments ?? true,
    isPinned: p.isPinned ?? false,
    externalLink: p.externalLink || undefined,
    author: {
      uid: p.authorUid,
      name: resolved?.name || resolved?.displayName || "Unknown",
      username: resolved?.username,
      avatar: resolved?.avatar ?? resolved?.avatarUrl ?? undefined,
      avatarUrl: resolved?.avatarUrl ?? resolved?.avatar ?? undefined,
      reputation: resolved?.reputation || 0,
      isVerifiedPro: resolved?.isVerifiedPro || false,
    },
  };
}

/**
 * Hydrates a batch of Neon posts into `PostData`, with **one** profile request.
 *
 * Exposed because comments and search do the same thing for their own rows.
 */
export async function mapPostsWithAuthors(posts: ContentPost[]): Promise<PostData[]> {
  const authors = await hydrateAuthors(posts.map((post) => post.authorUid));
  return posts.map((post) =>
    mapPostRow(post as unknown as PostRow, authors.get(post.authorUid) ?? null),
  );
}

// ─── Visibility (client mirror of the server predicate) ────────────────────
// The server is the boundary; this mirrors the rules so demo mode (no server) and
// optimistic UI behave identically. 'admins' = author + community owner + platform
// staff; 'members' additionally includes community members.
export interface PostViewer {
  uid: string | null;
  role: string;
  memberSlugs: string[];
  ownedSlugs: string[];
}

export async function getPostViewer(): Promise<PostViewer> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const uid = (data?.session?.user?.id as string | undefined) ?? null;
  if (!uid) return { uid: null, role: "member", memberSlugs: [], ownedSlugs: [] };

  // Phase 2C: the viewer's role comes from Neon, because profiles moved. This is an
  // authorization input, so it must be the server's read of the caller's own row.
  //
  // Membership and ownership stay in Supabase: `community_members` and `communities`
  // have not migrated, and reading them from two databases would be the dual-read
  // this migration exists to remove.
  const [roleResult, memberRes, ownedRes] = await Promise.all([
    fetchOwnRole(),
    supabase.from("community_members").select("communitySlug").eq("userId", uid),
    supabase.from("communities").select("slug").eq("ownerId", uid),
  ]);

  // Missing visibility context is not a "no posts" result. A failed membership lookup
  // must not make private posts vanish silently, and a failed role lookup must not
  // silently demote a moderator. Both throw.
  if (!roleResult.ok) {
    throw new Error("Could not load your permissions.");
  }
  for (const result of [memberRes, ownedRes]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    uid,
    role: roleResult.data,
    memberSlugs: ((memberRes.data || []) as { communitySlug: string }[]).map((r) => r.communitySlug),
    ownedSlugs: ((ownedRes.data || []) as { slug: string }[]).map((r) => r.slug),
  };
}

export function canViewPost(post: PostData, viewer: PostViewer): boolean {
  const visibility = post.visibility || "public";
  if (visibility === "public") return true;
  if (!viewer.uid) return false;
  if (post.author?.uid && post.author.uid === viewer.uid) return true;
  if (viewer.role === "admin" || viewer.role === "moderator") return true;
  if (!post.communitySlug) return false;
  if (visibility === "members") return viewer.memberSlugs.includes(post.communitySlug);
  return viewer.ownedSlugs.includes(post.communitySlug);
}

/** Fetches a feed page and maps it, preserving the pre-2D return type. */
async function loadFeed(query: ContentFeedQuery): Promise<PostData[]> {
  const result = await fetchContentPosts(query);
  if (isContentError(result)) throw new Error("Could not load posts.");
  return mapPostsWithAuthors(result.data);
}

export const fetchPosts = async (): Promise<PostData[]> => loadFeed({ limit: 100 });

/** Posts scoped to a single community — `CommunityDetail.tsx`. */
export const fetchPostsByCommunity = async (slug: string): Promise<PostData[]> => {
  const posts = await loadFeed({ community: slug, limit: 100 });
  // Pinned posts float to the top of their space, then newest first — the ordering
  // the previous implementation applied after fetching.
  return posts.sort(
    (a, b) =>
      Number(b.isPinned ?? false) - Number(a.isPinned ?? false) ||
      (b.createdAt || 0) - (a.createdAt || 0),
  );
};

/** Posts authored by one user — `Profile.tsx`. */
export const fetchPostsByAuthor = async (uid: string): Promise<PostData[]> =>
  loadFeed({ author: uid, limit: 100 });

export const createPost = async (
  postData: Omit<PostData, "id"> & { pollOptions?: string[] },
): Promise<string> => {
  const result = await createContentPost({
    title: postData.title,
    body: postData.body,
    category: postData.category ?? null,
    tags: postData.tags || [],
    type: postData.type || "discussion",
    communitySlug: postData.communitySlug || null,
    visibility: postData.visibility || "public",
    allowComments: postData.allowComments ?? true,
    externalLink: postData.externalLink || null,
    pollOptions: postData.pollOptions,
  });

  if (isContentError(result)) {
    throw new Error(
      result.error === "unauthenticated"
        ? "Sign in to publish a post."
        : "Could not publish your post. Please try again.",
    );
  }
  // `author.uid` is no longer sent — the server uses the session. The parameter is
  // kept in the type so call sites do not change.
  return result.data.id;
};

export const fetchPostById = async (id: string): Promise<PostData | null> => {
  const result = await fetchContentPost(id);
  if (isContentError(result)) throw new Error("Could not load this post.");
  if (!result.data) return null;

  // A post the viewer may not see is a 404 server-side, so anything returned here is
  // already authorized; the author is hydrated for rendering only.
  const author = await hydrateAuthor(result.data.authorUid);
  return mapPostRow(result.data as unknown as PostRow, author);
};

export const updatePost = async (id: string, body: string) => {
  const result = await updateContentPost(id, body);
  if (isContentError(result)) {
    // A non-author's update matches no row and comes back as `not_found`, which is
    // the same message the previous implementation produced for a blocked edit.
    throw new Error(
      result.error === "not_found"
        ? "Post not found or not editable."
        : "Could not save your edit. Please try again.",
    );
  }
};

export const softDeletePost = async (id: string) => {
  const result = await deleteContentPost(id);
  if (isContentError(result)) {
    throw new Error(
      result.error === "not_found"
        ? "Post not found or not removable."
        : "Could not remove this post. Please try again.",
    );
  }
};

export const incrementPostViews = async (id: string) => {
  // Fire-and-forget by design (called from a view effect). The failure is swallowed
  // inside the client, which matches the previous `console.warn` behaviour without
  // turning a counter into an error state.
  await recordContentView(id);
};
