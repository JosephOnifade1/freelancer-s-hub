# Phase 2D — dependency map (working note)

## Read paths today

| Entry point | Supabase access | Notes |
| --- | --- | --- |
| `posts.ts` `fetchPosts` | `posts` + `profiles!posts_authorUid_fkey` | retries with a second alias |
| `posts.ts` `fetchPostsByCommunity` | `posts` + profile join | pinned-first sort in JS |
| `posts.ts` `fetchPostsByAuthor` | `posts` + profile join | |
| `posts.ts` `fetchPostById` | `posts` + profile join | `maybeSingle` |
| `posts.ts` `getPostViewer` | `community_members`, `communities` (**stays**), `fetchOwnRole` (**Neon, 2C**) | |
| `comments.ts` `fetchComments` | `comments` + `profiles!comments_authorUid_fkey` | flat list; UI nests |
| `comments.ts` `fetchCommentsByAuthor` | `comments` (no join) | |
| `polls.ts` `fetchPollByPostId` | `polls`, `poll_options`, `poll_votes` — 3 round trips | counts summed in JS |
| `attachments.ts` `fetchPostAttachments` | `post_attachments` | `select("*")` |
| `users.ts` `getSavedPostIds` | `saved_posts` | per-profile |
| `search.ts` `globalSearch` | `posts` + profile join; user half already Neon | |

## Write paths today

| Entry point | Supabase access | Invariant it relies on |
| --- | --- | --- |
| `createPost` | `posts` insert, then `polls` + `poll_options` inserts | three separate statements, not atomic |
| `updatePost` | `posts` update `.eq(id)` | RLS restricted to author; **no client-side author check** |
| `softDeletePost` | `posts` update `.eq(id)` | same |
| `incrementPostViews` | RPC `increment_post_views` | |
| `addComment` | reads post for `allowComments`/`isDeleted`, inserts comment | `trg_post_comment_count` maintains `commentCount` |
| `updateComment` / `softDeleteComment` | `comments` update `.eq(id)` | **no author check client-side**; `postId` arg unused |
| `handleVote` | RPC `cast_vote` | the whole vote state machine |
| `votePollOption` | `poll_votes` insert | unique `(pollId,userId)` |
| `uploadPostDocuments` | `post_attachments` insert; Storage upload | `trg_post_document_limit` (≤3, serialised) |
| `removePostAttachment` | `post_attachments` delete | uploader-only |
| `toggleBookmark` | `saved_posts` select/insert/delete | composite PK |
| `setUserRole` | RPC `set_user_role` | `is_admin(auth.uid())` |
| `setUserVerifiedPro` | RPC `set_user_verified_pro` | `is_admin(auth.uid())` |

## Authorization rules to reproduce (`can_view_post`, verbatim semantics)

```
visibility = 'public'                          -> true
auth.uid() is null                             -> false
post."authorUid" = uid                         -> true
profiles.role in ('admin','moderator')         -> true
visibility='members' and communitySlug is not null
  and exists community_members(slug, uid)      -> true
visibility='admins' and communitySlug is not null
  and exists communities(slug, ownerId=uid)    -> true
otherwise                                      -> false
```

Reads as a **flat predicate**, not a fallback: the current client mirror
(`canViewPost`) is ordered the same way but is applied *after* rows arrive, so the
API has already returned protected content. That is the defect this phase fixes.

## Dependencies that must stay in Supabase

`community_members`, `communities` — required by `can_view_post` for
`members`/`admins` visibility. Reached through the trusted server-side Supabase
client, never from a request body.

## Schema gaps to close

- `posts` → no index on `(visibility)`, has `idx_posts_createdAt`, `authorUid`,
  `communitySlug`.
- `votes` → unique `(userId, entityType, entityId)` is the vote identity.
- `saved_posts` → composite PK `(userId, postId)`.
- `post_attachments` → `storagePath` unique + `attachment_path_owned` check that
  `storagePath` begins `<uploaderUid>/<postId>/`.
- `polls` → **no unique on `postId`** in SQL despite the one-to-one comment.
  Product behaviour treats it as one-per-post (`createPost` inserts at most one).
  Enforce it: `unique("postId")`.
- `poll_votes` → unique `(pollId, userId)`.
