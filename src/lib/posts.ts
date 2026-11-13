import { supabase } from "./supabase";
import { fetchOwnRole } from "./profile-client";
import { PostData } from "@/components/PostCard";

const POST_COLUMNS = `
  id, title, body, category, tags, type, score, ups, downs, views,
  commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
  visibility, allowComments, isPinned, externalLink,
  profiles (username, displayName, avatarUrl, reputation, isVerifiedPro)
`;

const POST_COLUMNS_FKEY = `
  id, title, body, category, tags, type, score, ups, downs, views,
  commentCount, isDeleted, isEdited, createdAt, communitySlug, authorUid,
  visibility, allowComments, isPinned, externalLink,
  profiles!posts_authorUid_fkey (username, displayName, avatarUrl, reputation, isVerifiedPro)
`;

interface PostProfileJoin {
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  reputation?: number;
  isVerifiedPro?: boolean;
}

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
  profiles?: PostProfileJoin | null;
}

export function mapPostRow(p: PostRow): PostData {
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
    visibility: p.visibility || "public",
    allowComments: p.allowComments ?? true,
    isPinned: p.isPinned ?? false,
    externalLink: p.externalLink || undefined,
    author: {
      uid: p.authorUid,
      name: p.profiles?.displayName || p.profiles?.username || "Unknown",
      username: p.profiles?.username,
      avatar: p.profiles?.avatarUrl,
      avatarUrl: p.profiles?.avatarUrl,
      reputation: p.profiles?.reputation || 0,
      isVerifiedPro: p.profiles?.isVerifiedPro || false,
    },
  };
}

// ─── Visibility enforcement (client mirror of public.can_view_post) ────
// The database enforces visibility with RLS; this mirror keeps demo mode
// (no RLS) behaving identically and hides rows the API should never have
// returned. 'admins' = author + community owner + platform staff;
// 'members' additionally includes community members.
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

  // Phase 2C: the viewer's role now comes from Neon, because profiles moved. This is
  // the `can_view_post` staff check — an authorization input — so it must be the
  // server's read of the caller's own row, not a client-supplied value.
  //
  // Membership and ownership stay in Supabase: `community_members` and `communities`
  // are content domains that have not migrated, and reading them from two databases
  // would be the dual-read this migration exists to remove.
  const [roleResult, memberRes, ownedRes] = await Promise.all([
    fetchOwnRole(),
    supabase.from("community_members").select("communitySlug").eq("userId", uid),
    supabase.from("communities").select("slug").eq("ownerId", uid),
  ]);

  // Missing visibility context is not a "no posts" result. In particular,
  // a failed membership lookup must not make private posts vanish silently — and a
  // failed role lookup must not silently demote a moderator, which would hide posts
  // they are entitled to see. Both throw.
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

async function visibleOnly(posts: PostData[]): Promise<PostData[]> {
  if (posts.length === 0) return posts;
  const viewer = await getPostViewer();
  return posts.filter((p) => canViewPost(p, viewer));
}

export const fetchPosts = async (): Promise<PostData[]> => {
  let { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS)
    .eq("isDeleted", false)
    .order("createdAt", { ascending: false });

  if (error) {
    const retry = await supabase
      .from("posts")
      .select(POST_COLUMNS_FKEY)
      .eq("isDeleted", false)
      .order("createdAt", { ascending: false });

    data = retry.data;
    error = retry.error;
  }

  // No silent "*" fallback: a degraded feed with missing author data is
  // worse than an honest error state the UI can show and retry.
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load posts.");

  return visibleOnly((data as PostRow[]).map(mapPostRow));
};

// Posts scoped to a single community — used by CommunityDetail.tsx instead
// of hardcoded fake posts. Pinned posts float to the top of their space.
export const fetchPostsByCommunity = async (slug: string): Promise<PostData[]> => {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS_FKEY)
    .eq("isDeleted", false)
    .eq("communitySlug", slug)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load space posts.");

  const visible = await visibleOnly((data as PostRow[]).map(mapPostRow));
  return visible.sort(
    (a, b) => Number(b.isPinned ?? false) - Number(a.isPinned ?? false) || (b.createdAt || 0) - (a.createdAt || 0)
  );
};

// Posts authored by a single user — used by Profile.tsx instead of
// hardcoded fake posts.
export const fetchPostsByAuthor = async (uid: string): Promise<PostData[]> => {
  const { data, error } = await supabase
    .from("posts")
    .select(POST_COLUMNS_FKEY)
    .eq("isDeleted", false)
    .eq("authorUid", uid)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load author posts.");

  return visibleOnly((data as PostRow[]).map(mapPostRow));
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
    .select(POST_COLUMNS_FKEY)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const post = mapPostRow(data as PostRow);
  const viewer = await getPostViewer();
  // A post the viewer may not see behaves exactly like a missing post.
  if (!canViewPost(post, viewer)) return null;
  return post;
};

export const updatePost = async (id: string, body: string) => {
  const { data, error } = await supabase.from("posts").update({ body, isEdited: true }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  // PostgREST can return success with zero updated rows when RLS blocks the
  // operation. Never report a successful edit when nothing was saved.
  if (!data?.length) throw new Error("Post not found or not editable.");
};

export const softDeletePost = async (id: string) => {
  const { data, error } = await supabase.from("posts").update({ isDeleted: true }).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Post not found or not removable.");
};

export const incrementPostViews = async (id: string) => {
  // Fire-and-forget by design (called from a view effect), but never silent:
  // a failed view increment must show up in logs, not vanish.
  const { error } = await supabase.rpc("increment_post_views", { post_id: id });
  if (error) console.warn("incrementPostViews failed:", error.message);
};
