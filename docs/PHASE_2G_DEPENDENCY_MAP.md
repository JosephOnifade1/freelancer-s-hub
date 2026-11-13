# Phase 2G — preflight and audit

- Clean dedicated branch `arena/03c9b7b6-freelancer-s-hub` at base `7ede25158f02faad6a230183bd7b1f28b182249a`.
- PR #32 confirmed MERGED into migration/nextjs-app-router. Fetched shallow ancestry and verified 1513097bd47b1187c0c0cfc1aec2b78ec4d53166 is an ancestor. Existing schema/journal 0000–0004 inspected.

## Supported notification events (legacy SQL reconciled with UI)

Source: supabase_notifications_migration.sql and matching consolidated schema.

- Comment insert: post author; reply insert: parent comment author, plus post author only if different. Never self-notify.
- Vote transition to +1: target post/comment author; not downvotes/removals/unchanged +1. A genuine return to +1 after another state is a new event.
- Follow insert: followed user; no unfollow notification. A genuine refollow is a new event.
- Application INSERT: lead owner. Accepted/rejected transition: applicant (actor lead owner). Withdrawn transition: owner (actor applicant). Reactivating withdrawn to pending does NOT notify; same-state writes do not notify.
- No existing notification for profiles/identity, membership/community changes, post creation/edit/deletion, poll votes, attachments/bookmarks, lead creation/closure, or pipeline stages. Do not invent these.

All sources are now Neon-owned: emit inside each existing domain transaction; no cross-provider event delivery is needed. Notifications retain actor/recipient FKs and genuinely polymorphic entityId/contextId without false entity FK. Source-event uniqueness plus existing serialized state transitions prevents retry duplicates, while allowing legitimate refollows/upvote cycles/review cycles.

## Notifications/UI

notifications.ts still reads/writes Supabase. Inbox limit 30, unread count, single mark-read, bulk mark-all, actor public-profile hydration. NotificationBell polls every 30 seconds; Notifications page uses same adapters. No realtime transport to migrate. Preserve links (content->post, follow->profile, application owner events->inbox, review decisions->lead). Recipient always comes from verified session. Scrub stale/inaccessible content notification text rather than exposing formerly private titles.

## Reports/moderation

Reports: post/comment/lead/profile UUID polymorphic targets; nine existing reasons; open/resolved/dismissed. No duplicate uniqueness constraint: repeated reports are permitted, subject to existing rolling limit of 10/day (currently client-only). Move limit enforcement server-side under a reporter lock. Validate target existence and visibility before report creation. Own history separate from staff queue/count/details/previews; no staff-only data exposed to members.

moderate_report RPC still targets Supabase content for posts/comments. Phase 2F split lead closure and report resolution across providers. Replace the entire action with a Neon transaction: trusted staff role, lock report, soft-remove post/comment or close lead, update report status/resolvedBy/timestamp. Comment removal must decrement post commentCount exactly once. Profile reports have no automatic removal. Existing UI supports resolve/dismiss and reopening via supported status; there is no restoration/suspension/ban feature to invent. Repeated resolution is idempotent; supported terminal decisions may be changed, matching the legacy RPC.

Role/verification writes already use Neon admin-only mutations (content queries). No obsolete role RPC in production. Preserve operator bootstrap and supported member/moderator/admin model; test fail-closed reads and role writes, do not invent new audit tables absent prior audit information.

## Remaining dependencies / integration

notifications.ts and reports.ts are remaining database adapters. NotificationBell, Notifications, MyReports, ReportModal, Admin and staff indicators consume them. reports.ts preserves reason labels and existing role/verification adapters but replaces persistence/previews. Remove the cross-provider lead report action. Existing tests asserting Supabase report RPC behavior must assert the new atomic API contract, not be skipped. Shared mock/historical SQL remain audit/legacy test inputs, never production fallback.

Verification: hermetic client/route/security/static tests, real local PostgreSQL domain-event transactions/rollback/races/report privacy/role authorization, fresh ordered migrations and Drizzle check, both builds and HTTP smoke. No actual Neon credentials requested; no seed/admin, main changes or PR.
