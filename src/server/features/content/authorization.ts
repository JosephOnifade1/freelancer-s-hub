/**
 * Content authorization (Phase 2D).
 *
 * Neon does not inherit Supabase RLS. Every query below either filters by this
 * predicate in SQL or refuses before returning rows, so "the API returned it" and
 * "the caller may see it" are the same statement.
 *
 * All production authorization facts come from Neon in Phase 2E. Community IDs
 * are stable across slug changes. Slug-only interfaces remain for the existing
 * demo predicate and legacy DI tests, never for server-session viewer resolution.
 *
 * The rules are a **transcription of `public.can_view_post`**, not a simplification.
 * The original is `stable security definer` and returns null (falsy) when the post
 * does not exist; every branch below mirrors a `when` clause in the same order.
 */
import { sql } from "drizzle-orm";

/** The viewer, already authenticated. `null` means anonymous. */
export interface ContentViewer {
  uid: string | null;
  memberIds?: string[];
  ownedIds?: string[];
  /** `profiles.role` from Neon. Only `admin` / `moderator` affect visibility. */
  role: string;
  /** Community slugs the viewer belongs to (`community_members`). */
  memberSlugs: string[];
  /** Community slugs the viewer owns (`communities."ownerId"`). */
  ownedSlugs: string[];
}

/** Anonymous viewer. Used by tests and by routes with no session. */
export function anonymousViewer(): ContentViewer {
  return { uid: null, role: "member", memberSlugs: [], ownedSlugs: [] };
}

/** Whether the viewer is platform staff. */
export function isStaff(viewer: ContentViewer): boolean {
  return viewer.role === "admin" || viewer.role === "moderator";
}

/**
 * Everything `can_view_post` needs about one post.
 *
 * Deliberately a narrow structural type rather than the full row: authorization
 * must not depend on fields the row happens to carry, and a caller cannot
 * authorize a post it has not loaded.
 */
export interface PostAuthorizationFacts {
  authorUid: string;
  visibility: string;
  communitySlug: string | null;
  communityId?: string | null;
}

/**
 * The `can_view_post` predicate, in JavaScript.
 *
 * Used for (a) the single-row decision where the row is already loaded and the
 * call must not return it, and (b) tests that pin the matrix. Feed queries do not
 * use this — they compile the same rules into the SQL `where` clause in
 * `authorizationFilter`, so protected rows are never read in the first place.
 */
export function canViewPost(post: PostAuthorizationFacts, viewer: ContentViewer): boolean {
  if (post.visibility === "public") return true;
  if (!viewer.uid) return false;
  if (post.authorUid === viewer.uid) return true;
  if (isStaff(viewer)) return true;
  if (viewer.memberIds !== undefined && viewer.ownedIds !== undefined) {
    if (!post.communityId) return false;
    if (post.visibility === "members") return viewer.memberIds.includes(post.communityId);
    if (post.visibility === "admins") return viewer.ownedIds.includes(post.communityId);
    return false;
  }
  if (!post.communitySlug) return false;
  if (post.visibility === "members") {
    return viewer.memberSlugs.includes(post.communitySlug);
  }
  if (post.visibility === "admins") {
    return viewer.ownedSlugs.includes(post.communitySlug);
  }
  // An unrecognised visibility is not "public": the CHECK constraint makes this
  // unreachable, and failing closed is the correct answer if it ever is reached.
  return false;
}

/**
 * The same predicate as a SQL fragment, for use in a `where` clause.
 *
 * Must stay behaviourally identical to `canViewPost` above; the integration suite
 * asserts the two agree by running every ordering of the matrix through both.
 *
 * Parameters are bound, not interpolated — `memberSlugs`/`ownedSlugs` are joined
 * with `sql.join` rather than bound as a JavaScript array. (A `= any(${array})`
 * binding fails under drizzle's `node-postgres` driver with SQLSTATE 42809; see
 * the Phase 2C report §8.2.)
 */
export function authorizationFilter(viewer: ContentViewer) {
  if (!viewer.uid) {
    return sql`p.visibility = 'public'`;
  }

  const branches = [sql`p.visibility = 'public'`, sql`p."authorUid" = ${viewer.uid}`];

  if (isStaff(viewer)) {
    // Staff see every post. Cheaper and clearer than enumerating visibilities.
    return sql`true`;
  }

  // Production viewers carry stable IDs. Slug-only viewers remain for the legacy
  // demo predicate/test adapters, never for server session resolution.
  if (viewer.memberIds !== undefined && viewer.ownedIds !== undefined) {
    for (const [visibility, ids] of [["members", viewer.memberIds], ["admins", viewer.ownedIds]] as const) {
      if (ids.length) branches.push(sql`(p.visibility=${visibility} and p."communityId" in (${sql.join(ids.map(id => sql`${id}`), sql`, `)}))`);
    }
    return sql`(${sql.join(branches, sql` or `)})`;
  }

  if (viewer.memberSlugs.length > 0) {
    const slugs = sql.join(
      viewer.memberSlugs.map((slug) => sql`${slug}`),
      sql`, `,
    );
    branches.push(
      sql`(p.visibility = 'members' and (select slug from communities where id=p."communityId") in (${slugs}))`,
    );
  }

  if (viewer.ownedSlugs.length > 0) {
    const slugs = sql.join(
      viewer.ownedSlugs.map((slug) => sql`${slug}`),
      sql`, `,
    );
    branches.push(
      sql`(p.visibility = 'admins' and (select slug from communities where id=p."communityId") in (${slugs}))`,
    );
  }

  return sql`(${sql.join(branches, sql` or `)})`;
}

/**
 * Whether the viewer may act on the post as its author.
 *
 * Separate from `canViewPost` on purpose: seeing a post and editing it are
 * different questions, and conflating them is how "moderators can view" turns into
 * "moderators can rewrite someone's post". Authorship is the only rule the original
 * RLS enforced for `update`/`delete` (`auth.uid() = "authorUid"`).
 */
export function isPostAuthor(post: { authorUid: string }, viewer: ContentViewer): boolean {
  return Boolean(viewer.uid) && post.authorUid === viewer.uid;
}
