# Phase 2E — Community & Social Graph Migration

## 1. Architecture and scope

Branch: `arena/2128516b-freelancer-s-hub`, based on `1d2e80b1cbc7bfd677320fb0ce07354149c86f41` of `migration/nextjs-app-router`.

Communities, community memberships and follows now use the existing server-only Neon/Drizzle architecture with `drizzle-orm/node-postgres` and the shared `pg` pool. Supabase Auth UUID remains the canonical identity. No new identity, connection architecture, community role system, approval workflow or UI redesign was introduced.

The pre-implementation audit is `docs/PHASE_2E_DEPENDENCY_MAP.md`. In particular, this checkout stored **follow relationships in Supabase**, not Neon. The old relationship write, target-counter RPC and own-counter Neon write were three separate operations. All three are now one Neon transaction.

## 2. Tables, constraints, indexes and migrations

`src/server/db/schema/social.ts` adds:

- **communities**: UUID primary key `id`, unique mutable `slug`, name, description, icon, category, topics, text `ownerId`, memberCount, createdAt. Indexes on ownerId and memberCount; checks for slug format, UUID-or-`system` owner and non-negative member count.
- **community_members**: composite primary key `(userId, communityId)`, FK to profiles, FK to communities and reverse community index. Community deletion cascades memberships; profile deletion is restricted while memberships exist, so it cannot silently invalidate member counts.
- **follows**: composite primary key `(followerId, followingId)`, both FKs to profiles, reverse followingId index and a database self-follow CHECK. Profile deletion is restricted while relationships exist, preventing silent count drift. Account deletion is not an implemented product workflow.

`posts.communitySlug` is replaced with nullable UUID `communityId`, indexed and FK-constrained to communities.id with **ON DELETE RESTRICT**. The restricted-post-requires-community CHECK now uses communityId. No duplicate stored community identity is retained.

Migration: `0003_community_social_graph.sql`, accompanying Drizzle snapshot and journal. `db:check` passes. Migration history 0000–0003 was applied successfully to **two fresh local PostgreSQL databases** during this work; the second run included the final SQL.

### Existing-data policy

No legacy data was imported or fabricated. The brief explicitly permits disposable users/test data and does not require backfill. The migration begins with a guard: if old posts have a non-null communitySlug, it **raises an exception before any destructive schema changes**. Such a populated deployment needs an explicit operator-approved import/disposition, not invented community rows or silent detachment. No automatic deletion of those posts was added. The guard is exercised against an old-shape transaction-local fixture.

The newly-created follows table starts empty. The migration explicitly resets its derived profiles.followers/following counters to zero; preserving non-zero legacy cross-database counters with no corresponding relationships would start the new system inconsistent. This is deliberate and must be considered before applying to a populated deployment.

## 3. Community workflows

`social-queries.ts` provides real database-backed create, list, lookup and update operations. `social/index.ts` is the server-only session boundary. `GET/POST/PATCH /api/social` dispatches a fixed set of operations, not arbitrary table or function names.

Creation inserts the community, creator membership and memberCount=1 in a single transaction. This fixes the old double count (initial count=1, followed by auto-join increment). Duplicate slug conflicts do not leave partial initialization.

Owners and global **admins** may edit metadata and change slugs. Moderators do not gain community ownership/edit authority merely by being staff. No delete/archive workflow existed in the audited UI or library; none was invented. A community with dependent posts cannot be hard-deleted accidentally because the FK restricts deletion.

## 4. Membership workflows

Join and leave are explicit, idempotent set-state operations. Each locks the community row, inserts with ON CONFLICT DO NOTHING or deletes the membership, and changes the counter **only when a row actually changed**, within the same transaction. Repeated joins/leaves and concurrent mixed operations cannot inflate or underflow counts.

Membership status, joined-community lists and public member lists are database-backed. Member profiles are hydrated by a single Neon join selecting only public fields; role is never projected. The creator may leave without losing ownership, matching the prior independent ownership/membership model.

## 5. Follow workflows

Follow/unfollow support explicit idempotent states and the existing compatibility toggle. Each transaction:

1. Validates authenticated actor and target, rejecting self-follow.
2. Locks both profiles in **UID order**, preventing opposite-direction deadlocks.
3. Reads the existing relationship under those locks.
4. Inserts/deletes only for a real state change.
5. Updates actor.following and target.followers in the same transaction.

Composite uniqueness prevents duplicate relationships. Failed target/counter writes roll back the relationship and both counters. Followers and following retrieval join profiles once using a public projection. The existing Profile follow-status query now uses the Neon adapter instead of a direct Supabase call; counters continue to render from Neon profiles.

The legacy `/api/profile/following-counter` route returns **410 Gone**, and its browser adapter is removed. Its deprecated server compatibility function refuses without writing. This closes the integrity bypass where a caller could change a counter independently of a relationship. The pure old counter helper remains covered by existing query tests but has no production service caller.

## 6. Stable community ID and slugs

Posts and memberships relate to communities by UUID only. A renamed community keeps its id and all attached posts/memberships. Post DTOs still expose communitySlug, but derive it from the referenced community at query time; existing UI routes and navigation therefore continue using current slugs. Community feed filtering resolves a slug to its stable id, using the existing communityId index.

Production server content viewers carry memberIds/ownedIds. Both SQL authorization and single-row authorization use those IDs. This also prevents an important subtlety: if an old slug is reused by a different community, a viewer snapshot containing the old membership cannot gain access to the new community. A real-PostgreSQL test exercises this scenario.

Slug-only predicate interfaces remain for existing demo/DI tests, not server-session authorization. Slugs in client UI state are not an authorization boundary. Old bookmarked community URLs are not aliased after a rename; no slug-history/redirect feature existed and none was introduced.

## 7. Authorization and actual visibility model

All protected mutations derive the acting UUID from `getServerSession()` (the existing verified Supabase Auth path). Body fields such as uid, ownerId, userId, followerId or actorUid cannot replace it. Community update metadata is explicitly whitelisted; ownerId, id and memberCount cannot be assigned by the browser. Only global admins or the actual owner can edit communities, checked inside the query transaction.

**The audited product has public communities and public membership/follow reads.** It has no community privacy column or membership approval model. Preserving actual behavior therefore means these reads remain public; no unimplemented private-community workflow is claimed. Restricted **posts** remain protected (`members` and `admins` visibility), now using Neon stable IDs. The existing content authorization matrix remains intact, including staff access, anonymous refusal and author access.

Database/authentication errors are not coerced to an empty list or permitted access. The social HTTP boundary maps unknown failures to 503 without exposing SQL parameters. Tests cover session failure, missing database configuration, connection failure and spoofed mutation identities. Content role/community-fact read failures continue to throw rather than grant privileges.

### System-owned communities

ownerId remains text and accepts the literal `system`; it is never cast to UUID. Public discovery returns such rows normally. Only a global admin can edit them through the application. New community creation always derives a user owner from the session, so sending `ownerId: 'system'` does not create an operator-owned row. No system community or account was seeded into application data. Existing Supabase records were not copied (no backfill required); the Neon schema represents system ownership faithfully rather than discarding/coercing it.

## 8. Transactions, concurrency and pooler behavior

Community creation, metadata changes, membership transitions and follow transitions use Drizzle interactive transactions. Membership operations serialize on a community row; follow operations lock both profiles in a deterministic order. Counter deltas and relationships commit/roll back together. A single read needs no extra transaction.

The existing pg driver pins a checked-out connection for each BEGIN/COMMIT transaction. These operations use transaction-scoped row locks, not session advisory locks or session state. PostgreSQL transaction-mode poolers retain a backend for the duration of the transaction; no new dependence on connection identity *between* transactions is introduced. Actual Neon pooler contention, latency and operational behavior remain unverified.

## 9. Application integration

Modified:

- `src/lib/communities.ts`: existing public adapter signatures preserved; real Neon API operations, stable community id in returned DTOs; new update adapter.
- `src/lib/social-client.ts`: community facts, follower/following public hydration and explicit follow state.
- `src/lib/users.ts`: toggleFollow and getFollowingIds now use social API; no counter RPCs or independent profile-counter requests.
- `src/lib/posts.ts`: client viewer facts use the social API, not Supabase Database.
- `src/server/features/content/{index,authorization,content-queries}.ts`: Neon viewer facts, ID authorization, FK writes, current-slug projection and community-feed filtering.
- `src/views/Profile.tsx`: removed direct Supabase follows lookup; invalidates target and actor profile caches after changes.
- `src/lib/profile-client.ts`, profile service and following-counter route: independent counter writes retired.

Unchanged UI components consume the migrated adapters: Communities, CommunityDetail, CommunityHoverCard, CreateCommunityModal, CreatePost, FeedSidebar and Landing. Search receives current community information through migrated post queries; there is no separate direct community search query to replace. There was no edit form or follower-list component to redesign; working update and follower-list APIs/adapters are supplied without inventing pages.

## 10. Supabase Database dependencies removed

Repository-wide searches and a new static test confirm **no application** `.from('communities'|'community_members'|'follows')` or membership/follow counter RPC remains. Community profile joins are replaced by Neon joins. Content no longer requests memberships/ownership from Supabase server-side.

Historical `supabase*.sql` files remain as audit inputs, not a runtime fallback. The shared `mockSupabase.ts` still contains old local fixture support used by existing content RLS mirror tests; it was not broadly deleted. **No migrated social adapter calls it**, and no social adapter falls back to localStorage or mock data. Social mutations require a real server-verifiable session, even when the old browser-local demo is active.

## 11. Boundaries preserved

Supabase Auth, cookie verification, UUID identity, Storage file-upload and file-access code were not changed. No attachment bytes moved. Leads, applications, pipelines, notifications and reports remain unmigrated; their tables and clients were not rewritten. Operator-controlled admin bootstrap documentation is unchanged. No public bootstrap route, administrator or application seed users were created.

**Notification limitation:** the historical Supabase `after insert on follows` trigger cannot observe new Neon follows. This phase does not introduce a cross-provider notification write/outbox or claim that automatic follow notifications continue. Existing notification records/read UI remain in Supabase. Reliable cross-provider notification delivery is outstanding; it is not hidden behind a fallback to old follow persistence.

## 12. Tests and exact results

Final verification commands:

| Category | Command | Result |
| --- | --- | --- |
| Default hermetic suite | `npm test` | **30 files, 353 passed** |
| Node/database-configured suite | `DATABASE_URL=<local PostgreSQL> npm run test:db` | **15 files passed, 1 skipped; 389 passed, 3 skipped** |
| New actual SQL integration | `tests/db/social-integration.test.ts` | **31 passed**, local PostgreSQL 18.6 + actual Drizzle transactions |
| New mocked security boundary | `tests/db/social-security.test.ts` | **18 passed**, mocked session/database dispatch |
| New static regression tests | `src/test/phase2e-social-migration.test.ts` | **7 passed**, included in default suite |

The database-configured suite contains both actual database tests and pre-existing mocked query/service/route tests: **389 is not a claim of 389 live SQL tests**. Its 3 skips are the existing live-remote TLS tests. None of the new social integration/security tests was skipped in the configured run.

31 real SQL tests cover creation/retrieval, initialization counts, duplicate/concurrent creation, initialization rollback, ownership, global admins vs moderators, system ownership, duplicate rename rollback, input validation, join/leave/idempotency, ten-way concurrent joins, mixed join/leave count parity, membership rollback on counter failure, follows/idempotency, self-follow in code and DB, ten-way concurrent follows/toggles, opposite-direction deadlock avoidance, mixed follow/unfollow counter parity, second-counter rollback, public hydration without roles, post relation/visibility through rename, reused-slug isolation, deletion restriction, the legacy migration guard and unknown-community rejection.

Existing tests were adapted to the new boundary rather than skipped: content SQL fixtures now create a real community; content service tests mock the Neon facts port rather than Supabase; static migration expectations no longer allow transitional follow RPCs; following-counter route tests assert that direct writes are retired. One previously weak service assertion was strengthened to require the actual updated outcome and a working transaction stub, rather than accepting an outer ok with an inner invalid status.

### Environment distinction

1. **Hermetic/unit:** results above require no real external services.
2. **Local PostgreSQL:** PostgreSQL 18.6 started in Arena, disposable test databases; fresh ordered migrations applied and real SQL/concurrency verified.
3. **Arena environment database:** the only database used was that local fixture in the Arena sandbox. No separate managed Arena database was claimed or queried.
4. **Actual Neon:** **not performed**, no credentials requested or needed for implementation.

No test fixture identities were left in the database after the suites. They are temporary integration fixtures, not application seed users.

## 13. Builds, static analysis and route smoke

- `npm run typecheck`: **0 errors**.
- `npm run lint`: **0 errors, 6 existing react-refresh warnings** in layout/navigation.
- `npm run db:check`: passed.
- Fresh migrations 0000–0003: passed on local PostgreSQL.
- `npm run build:next`: **Next.js 16.4.6 production build passed** (Turbopack).
- `npm run build`: legacy Vite production build passed; existing large-bundle warnings remain.
- `git diff --check`: clean.
- Static runtime searches: no migrated-domain Supabase calls/RPCs outside shared mocks/tests/historical SQL.

Production Next server smoke requests against the local database (not mocked HTTP):

| Request | Status |
| --- | --- |
| GET social communities | 200 |
| GET missing community members | 404 |
| GET own facts without session | 401 |
| POST join with forged userId | 401 |
| POST follow with forged followerId | 401 |
| POST retired following-counter | 410 |
| GET content feed | 200 |
| GET /communities | 200 |
| GET /u/nonexistent (client-rendered profile shell) | 200 |
| GET social directory with an Arena-style preview Host | 200 |

These are HTTP/server smoke checks, not a claim of authenticated end-to-end browser testing against Supabase. Ownership/impersonation and successful mutations are verified by the mocked service-boundary tests plus actual SQL tests respectively.

## 14. Known limitations

- No private-community/approval/archive/delete workflow exists; none is claimed as delivered. Existing restricted-post authorization is preserved and tested.
- No legacy data import, slug redirect/history, or live authenticated browser session was exercised. Existing community-scoped posts require explicit disposition before the guarded migration can run.
- Resetting derived legacy social counters is deliberate; review this before applying to a populated database.
- Supabase follow-trigger notification emission does not transfer automatically (section 11).
- Shared demo mocks remain for unrelated existing tests, but the migrated social domains have no demo persistence fallback. Browser-local mock sessions cannot authorize server mutations.
- Community ownerId remains text to preserve `system`; there is no uniform owner FK. Normal creation validates ownership through session identity and creator-membership FK. Profile/account deletion is not a product workflow; relationship FKs restrict accidental deletion with live memberships/follows.
- Public lists remain unpaginated, matching the existing product. This phase did not add a new discovery/list redesign or performance claim.

## 15. Neon verification still outstanding

Actual pooled/direct endpoint tests, TLS verification, concurrent membership/follow contention under the Neon pooler, pool capacity/timeouts, cold starts, migration behavior on a deployed database, transaction rollback under transport failure, query latency and realistic list/feed load remain outstanding. Existing content vote pooler/TLS checks also remain outstanding. Local pg transaction correctness is evidence of PostgreSQL semantics, not live Neon verification.

## 16. Branch and commit

Work is confined to `arena/2128516b-freelancer-s-hub`. The final commit hash is supplied with the completion response (a document cannot contain its own Git commit hash). No branch switches, resets or history rewrites were performed.

## 17. Operational boundaries

`main` was not modified. No PR was opened or merged. No next migration phase was started. No credentials, administrator account, application seed users or public admin-bootstrap endpoint were added. Supabase Auth/Storage and the existing operator-controlled bootstrap procedure are preserved.
