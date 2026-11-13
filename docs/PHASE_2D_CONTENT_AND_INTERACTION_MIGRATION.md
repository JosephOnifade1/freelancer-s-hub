# Phase 2D — Content & Interaction Domain Migration

Branch `arena/f85aa146-freelancer-s-hub`, base `cf51b09`.

Migrates **posts, comments/replies, votes, polls (+ options + poll votes), attachments,
and saved posts** from Supabase Database to Neon + Drizzle. Communities/memberships,
follows, leads/applications, notifications, reports, Auth and Storage stay where they
are. This is a domain migration, not a UI redesign: routes, permissions and product
behaviour are unchanged.

The dependency map produced during inspection is in `docs/PHASE_2D_DEPENDENCY_MAP.md`
and is not repeated here.

---

## 1. Scope and what is *not* migrated

| Domain | Now | Storage |
| --- | --- | --- |
| Posts, comments, votes, polls, poll options, poll votes, post attachments, saved posts | Neon + Drizzle | **migrated** |
| Global user role, `isVerifiedPro` | Neon + Drizzle | **migrated** (2C gap closed) |
| Communities, community memberships | Supabase | unchanged — required by visibility rules |
| Follows (`toggleFollow` and its counters) | Supabase | unchanged (§6) |
| Leads / applications, notifications, reports | Supabase | unchanged |
| Supabase Auth, Supabase Storage | Supabase | unchanged |
| File bytes for attachments | Supabase Storage | **unchanged** — only metadata moved |

No broad dual-read or dual-write was introduced. There is exactly one transitional
straddle, `toggleFollow`, which was already there and is out of scope.

---

## 2. Schema and migrations

New schema: `src/server/db/schema/content.ts`; barrel `src/server/db/schema/index.ts`.

Migrations:

- `0001_content_domain.sql` — the eight tables, their constraints and indexes.
- `0002_signed_content_score.sql` — drops two constraints this phase had invented
  (`posts_score_non_negative`, `comments_score_non_negative`).

Conventions follow `_shared.ts`: `timestamptz`, camelCase quoted column names matching
the Supabase schema, `text` + `CHECK` rather than enums, soft delete only.

### Constraints preserved from the Supabase schema

- `posts`: author reference, `type` and `visibility` IN-lists, `posts_restricted_requires_community`
  (a `members`/`admins` post must name a community), non-negative `views` and
  `commentCount`, timestamps.
- `comments`: post reference (cascade), self-referencing `parentId`, non-negative
  `commentCount`, soft delete.
- `votes`: unique `(voterUid, entityType, entityId)` — the constraint the atomic vote
  path relies on.
- `polls`: `postId` UNIQUE (one poll per post); `poll_options` ordered by `position`;
  `poll_votes` unique `(pollId, userId)`.
- `post_attachments`: uploader, post reference, the ≤3 cap (enforced in the write path,
  under a row lock, not by a trigger).
- `saved_posts`: composite primary key `(uid, postId)`.

### Documented divergences

- `polls.postId` is `UNIQUE` (relied on, and now enforced by the database rather than
  only by application code).
- `isDeleted`, `allowComments`, `isPinned` are `NOT NULL`.
- Counters are `NOT NULL DEFAULT 0`.
- `communitySlug` is plain `text` with no cross-provider foreign key — communities are
  still in Supabase, so a foreign key is impossible. **This is an integrity gap, not an
  oversight:** a post can name a community slug that does not exist. Rows are only
  created from server code that has already checked membership, and the visibility
  predicate fails closed on an unknown slug.
- **`score` is signed on both `posts` and `comments`.** `score = ups − downs`, so it is
  legitimately negative. This is called out because the first draft of the schema added
  a `>= 0` check that had no Supabase counterpart and rejected every downvote; it was
  found by the integration suite and removed. `views` and `commentCount` remain
  non-negative, which is correct because they are monotonic counters.

### A property worth stating

`votes.entityId` is a **polymorphic** reference (`entityType` + `entityId`), so no
foreign key can exist and a hard-deleted post leaves its votes behind. This is inherited
from the Supabase schema, not introduced here. The application only soft-deletes, so it
is unreachable in practice; it is covered by a test so nobody assumes a cascade.

---

## 3. Authorization

`src/server/features/content/authorization.ts` exposes a `ContentViewer`
(`uid`, `role`, `memberSlugs`, `ownedSlugs`), the `canViewPost` predicate, and
`authorizationFilter(viewer)` which compiles the **same** rules into a SQL fragment.

```
visibility='public'                                   -> true
viewer.uid is null                                    -> false
posts."authorUid" = uid                               -> true
role in ('admin','moderator')                         -> true   (role from Neon)
visibility='members' and communitySlug in memberSlugs -> true   (Supabase facts)
visibility='admins'  and communitySlug in ownedSlugs  -> true   (Supabase facts)
otherwise                                             -> false  (unknown visibility fails closed)
```

Three properties that matter:

1. **The filter is inside the query.** Protected rows are never fetched and then
   discarded. This is the defect the phase exists to fix: the old client mirror
   (`canViewPost` in `src/lib/posts.ts`) ran *after* the API had already returned the
   content. That mirror still exists for demo mode and optimistic UI, but it is no longer
   the boundary, and a test asserts the two agree.
2. **Fails closed.** An unrecognised `visibility` reaches no branch.
3. **Membership never comes from the request.** `resolveViewer()` reads the session for
   the uid, Neon for the role, and the **server-side** Supabase client for community
   facts. There is no route, body field or query parameter that can supply a membership
   or a role.

A failed permission lookup **throws**; it does not degrade to "anonymous viewer". An
empty membership list is a real answer ("in no communities") and must not be confused
with "we could not find out", which would silently hide content the user is entitled to.

Mutations re-check. `updatePostBody`/`softDeletePost` are scoped
`where id = $1 and "authorUid" = $2`, so a non-author matches no row and is reported as
`404` — indistinguishable from a missing post, because that person may never have been
allowed to see it.

The two refusal shapes are deliberately distinct, in `content/http.ts`:

- **Reading** something the viewer may not see → `404`, identical to "no such post". A
  `403` would confirm that a hidden post exists.
- **Mutating** something the caller can see but does not own → the author-scoped query
  matches no row → `404` as well, since the layer genuinely cannot tell the cases apart.
- `403` is reserved for refusals where no existence question arises: a self-vote, or a
  non-admin calling the admin routes.

Hiding a button is not authorization, and neither is a client-side check.

---

## 4. Read paths: batched hydration, no N+1

The embedded `profiles!posts_authorUid_fkey` / `profiles!comments_authorUid_fkey` joins
are gone from `posts.ts`, `comments.ts`, `search.ts` and the content halves of
`reports.ts`.

Rows come back from Neon and are hydrated in **one** batched call per page
(`hydrateAuthors`), which deduplicates uids and calls the Phase 2C public-profile route
(`GET /api/profiles/lookup?uids=…`) exactly once. That route serialises every branch
through the `PublicProfile` projection, so `role` cannot leak through any of them.

Missing profiles are tolerated: an author whose profile row does not exist renders as
`Unknown`, because a deleted account must not break a feed. Sorting and keyset pagination
are preserved (`order by p."createdAt" desc, p.id desc`), and the search term is now
passed to the server instead of filtering a bounded page client-side.

---

## 5. Votes: the atomic state machine, preserved

`castVote` in `content-queries.ts` is a transaction, in this order:

```
authorize -> value ∈ {-1,0,1} -> uuid valid
  -> pg_advisory_xact_lock(hashtextextended(voter:type:id))
  -> select target for update
  -> deleted / parent-deleted checks
  -> canViewPost
  -> self-vote rejected
  -> prior vote for update
  -> no-op if the value is unchanged
  -> delete / insert / update the vote row
  -> apply score/ups/downs deltas
  -> reputation = greatest(0, reputation + delta) on the author
```

This is the `cast_vote` semantics, not a re-derivation. Specifically: it did **not**
regress to a likes-only model, and it is not a sequence of unprotected client requests —
the client calls one route, the route calls one service, which owns the whole state
change. The advisory lock is what makes concurrent votes on the same entity serialise;
the integration suite exercises a ten-way race and asserts the counters and the
reputation total are exactly consistent afterwards.

The upvote/downvote product direction is intact: `-1` is a first-class value, and
`score` is signed.

---

## 6. Polls, comments, attachments, saved posts

- **Polls.** `createPost({ type: "poll" })` creates the post, the poll and its options in
  **one transaction**. The Supabase version inserted them separately and ignored the
  failure, which could leave a poll post with nothing to vote on; a test asserts that
  inconsistent state is now unreachable. `votePollOption` validates that the option
  belongs to the poll and maps the unique-constraint conflict to `already_voted` rather
  than surfacing a 500.
- **Comments.** `createComment` mirrors the old trigger in the same transaction: lock the
  post, check not removed, check `allowComments`, check visibility, require the parent to
  belong to the same post, insert, increment `commentCount`. `softDeleteComment`
  decrements with `greatest(0, …)`.
- **Attachments.** Only metadata moved. The write path requires the storage path to start
  with `${uid}/${postId}/` (so a caller cannot register someone else's object), locks the
  post and caps at three under that lock. **File bytes remain in Supabase Storage**, and
  the attachment route contains no Storage client at all.
- **Saved posts.** Composite uniqueness plus ownership; `toggleSavedPost` is a single
  atomic statement, not a read-then-write.

---

## 7. Roles and verification (the 2C gap)

`setUserRole` and set-verification are now server-only Neon mutations behind
`POST /api/admin/roles` and `POST /api/admin/verification`.

- The acting uid comes **only** from the session. The routes read `body.uid` (the target)
  and nothing else; a test asserts that `actorUid` in a body is ignored.
- Only an admin may change a global role, checked inside the query function so a second
  caller cannot forget it.
- A normal user cannot elevate themselves; an admin cannot demote themselves (409), which
  prevents locking the last admin out.
- Existing UI and moderation screens are unchanged.

**No public bootstrap endpoint and no hardcoded administrator credentials were added.**
See §12 for the operator procedure.

---

## 8. What stays in Supabase, and why

Community membership is load-bearing for visibility, so it stays and is read through the
trusted server-side client. Follows stay (including the transitional `toggleFollow`,
which straddles the two databases until `follows` migrates — it was left alone because no
correctness defect surfaced, per §6). Leads keep the one remaining
`profiles!leads_postedByUid_fkey` join; that domain has not migrated. Auth and Storage are
untouched.

---

## 9. Honest status of each feature

A table existing is not a working feature. The distinction:

| Feature | State |
| --- | --- |
| Post feed, by community, by author, by id, search | working — real reads, authorization in-query |
| Post create / edit / soft delete | working |
| Comments, replies, counters, locking | working |
| Votes, including downvotes, reputation, concurrency | working — verified under a real-PostgreSQL race |
| Polls: create, read, vote, one-vote-per-user | working |
| Attachments: register metadata, list, remove, ≤3 cap | working; **upload still goes to Supabase Storage** |
| Saved posts | working |
| Role / verification administration | working; requires an existing admin (§12) |
| Post view counter | working |

---

## 10. Tests

`npm test` — **29 files, 346 passed, 0 failed.** Hermetic, no database.

| File | Kind | Proves |
| --- | --- | --- |
| `tests/db/content-integration.test.ts` | **local PostgreSQL** | 86 tests: the §11 matrix against real SQL |
| `tests/db/content-services.test.ts` | mocked | serving authorization policy: viewer resolution, fail-closed behaviour, staff gating, no target identity in signatures |
| `tests/db/content-routes.test.ts` | mocked | HTTP contract: status codes, `404` vs `403`, no uid accepted from a body |
| `src/test/phase2d-content-migration.test.ts` | static | the *absence*: no Supabase content reads, no content RPCs, no `profiles!` joins, no RPC for roles |
| `src/lib/postQueries.test.ts` | mocked at the client boundary | a failed read throws and never renders an empty feed |

Integration coverage (real PostgreSQL):
`canViewPost` × `authorizationFilter` parity row for row; feed visibility per viewer;
keyset pagination; post create/edit/delete ownership; a moderator cannot edit another
author's post; comment threading, counters and locking; the `cast_vote` state machine
including a ten-way concurrent race; polls; the three-attachment cap under concurrency;
storage-path ownership; saved posts; roles and verification; schema invariants.

**Labelling.** Tests marked "local PostgreSQL" run against a local PostgreSQL 18.6
instance started for this work. Tests marked "mocked" replace the database and session.
**Nothing in this phase was verified against real Neon.**

---

## 11. Verification matrix, as executed

| # | Check | Result |
| --- | --- | --- |
| 1 | `tsc --noEmit` | 0 errors |
| 2 | `eslint .` | 0 errors, 6 warnings (all pre-existing `react-refresh` in `navigation.tsx`) |
| 3 | `npm test` (hermetic) | 29 files / 346 passed |
| 4 | `vitest --config vitest.db.config.ts` (local PG 18.6) | 13 files / 341 passed, 3 skipped |
| 5 | Suite repeated twice, same counts | stable |
| 6 | `npm run build` | succeeded |
| 7 | Repo-wide grep: content tables via Supabase | none outside the demo backend |
| 8 | Repo-wide grep: `cast_vote`, `increment_post_views`, `set_user_role`, `set_user_verified_pro` RPCs | none |
| 9 | Repo-wide grep: `profiles!` joins | only the two `leads` joins |
| 10 | Real Neon | **not run** |

The 3 skips are `tests/db/tls-verification.test.ts`, which needs a live remote endpoint
and predates this phase.

---

## 12. Operator bootstrap (one-time, out of band)

Creating the first admin is deliberately **not** an HTTP endpoint. A bootstrap route is a
standing privilege-escalation hole, and a hardcoded credential is worse. Instead:

1. Sign up normally through the app. The account is provisioned as `member`.
2. An operator with database access promotes it once:

```sql
update profiles set role = 'admin' where uid = '<uid from the profiles table>';
```

3. Verify:

```sql
select uid, username, role from profiles where role = 'admin';
```

From then on every role change goes through `POST /api/admin/roles` with an
authenticated admin session.

This requires Neon credentials, so it is documented rather than executed here. Steps 1–2
are the whole procedure; there is no script that grants privileges automatically.

---

## 13. Residual risks and what is *not* proven

- **No real-Neon verification.** Everything ran against local PostgreSQL 18.6. Neon
  differs in connection pooling (pooled vs direct endpoint), TLS (`sslmode=require`),
  cold-start behaviour and advisory-lock behaviour across a pooler. The `cast_vote`
  advisory lock is the specific risk: a transaction-mode pooler must not split the
  statement from the lock. Unverified.
- **Migration atomicity on Neon** was not exercised (local runs applied incrementally).
- **Feed latency** with batched hydration was not measured; no query was profiled under
  load.
- **`communitySlug` has no referential integrity** (see §2). If a community is renamed or
  deleted in Supabase, posts keep the old slug and become invisible to non-authors. This
  is inherent to a partial migration, not a bug in this phase, and it should be resolved
  when communities migrate.
- **`votes` orphan on hard delete** (§2). Unreachable while soft-delete-only holds.
- **`toggleFollow`** remains a cross-database straddle with no compensation on partial
  failure. Left alone deliberately; it is the next phase's problem.
- The demo backend (`src/lib/content-demo.ts`) keeps its own vote implementation against
  the mock client, because demo mode has no server. It is a second implementation of the
  same semantics and can drift; the static test pins the entry-point wiring, not
  behavioural equivalence.

---

## 14. Section index

1. Scope and what is not migrated
2. Schema and migrations
3. Authorization
4. Read paths (batched hydration)
5. Votes (atomic state machine)
6. Polls, comments, attachments, saved posts
7. Roles and verification
8. What stays in Supabase, and why
9. Honest status of each feature
10. Tests
11. Verification matrix
12. Operator bootstrap
13. Residual risks
14. Section index
