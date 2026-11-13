# Phase 2E — audit and implementation plan

## Audited baseline

- `supabase_schema.sql` communities: slug primary key; ownerId is text (UUID **or `system`**). Public read; insert requires authenticated owner; updates owner or global admin. No community visibility column, approval queue, community roles, archive or delete workflow exists. Post visibility is separate (`public`, `members`, `admins`).
- Memberships: composite (userId, communitySlug); public reads, self-only writes. No approval restrictions. `communities.ts` initializes memberCount=1 then auto-joins and increments again: real double-count defect. Join/leave are separate writes and counter RPCs, unsafe under concurrency.
- Follows: composite (followerId, followingId), public read, self-only writes. `users.ts` stores relationships in Supabase, target follower counter via Supabase RPC and caller following counter in Neon. Thus the brief's suggestion that relationships already live in Neon is not true of this checkout. Profile.tsx separately queries Supabase follows. Self-follow rejected in client only.
- Content currently stores communitySlug as plain text, with no FK. Server viewer membership/ownership still reads Supabase. Client `posts.ts` has a parallel viewer loader. All must migrate together.
- UI callers: Communities, CommunityDetail, CommunityHoverCard, CreateCommunityModal, CreatePost, FeedSidebar, Landing, Profile. Search uses content/profile adapters, not a separate community table query. No community edit UI or followers list UI exists; expose working adapters/endpoints without redesigning pages.
- `profiles` has followers/following counters and a transitional following-counter mutation route. That route must retire so clients cannot corrupt transactional counts.
- Supabase follow notification trigger exists. Notifications remain out of scope; no cross-provider trigger/dual-write will be fabricated. Document lack of automatic follow notifications after migration.

## Implementation decisions

1. Stable UUID communities.id, unique mutable slug. Store only communityId FK on posts and memberships; project current slug for unchanged URLs/DTOs. Restrict community deletion with dependent posts (no existing delete workflow). No duplicated persisted slug reference.
2. Preserve ownerId text with UUID-or-system CHECK. Owner user existence validated when creating using verified session; system ownership is operator-only, not accepted from HTTP. Existing system rows retained by schema shape.
3. All existing communities are public. Do not invent private community or approval features; preserve restricted **post** visibility and test membership-dependent access. Member lists remain public as the actual policy permits.
4. Serialize membership transitions by community row lock; count changes only when a relationship insert/delete actually changes a row. Creation + creator membership in one transaction.
5. Serialize follows by locking both profile rows in UID order; update both counters in the same Drizzle transaction. Provide idempotent set-state plus compatibility toggle. Composite keys prevent duplicates.
6. Single server-only social service and API boundary; client uid compatibility arguments never authorize or choose mutation actor. No production Supabase Database fallback for migrated workflows.
7. Migrate remaining viewer membership lookups to Neon. Retain current slug-based public DTOs but not slug-based stored relationships.

## Verification plan

Hermetic service/route and static boundary tests; real local PostgreSQL migrations and integration tests (including races, rollback, system ownership, slug rename + content). Full TypeScript, ESLint, unit/database suites, both legacy and Next production builds, route smoke tests. Real Neon unavailable; do not claim it was tested. No seed users/admin, main changes or PR.
