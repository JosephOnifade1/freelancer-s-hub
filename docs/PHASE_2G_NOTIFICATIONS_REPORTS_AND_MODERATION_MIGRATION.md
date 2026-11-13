# BORYNX Phase 2G — Notifications, Reports & Moderation

## 1. Branch, base and preflight

Work is isolated on `arena/03c9b7b6-freelancer-s-hub`, based on `7ede25158f02faad6a230183bd7b1f28b182249a`. Initial tree was clean. PR #32 was confirmed merged, and exact Phase 2F commit `1513097bd47b1187c0c0cfc1aec2b78ec4d53166` was verified as an ancestor after a shallow fetch. No branch switch, history rewrite, main edit, push or PR operation was performed for Phase 2G.

## 2. Dependency audit

See `PHASE_2G_DEPENDENCY_MAP.md`. Audited legacy notification/report SQL, current domain writes, adapters, notification navigation and bell polling, report modal/history, staff queue filters/actions/previews, and already-migrated role/verification paths. Legacy SQL and historical mock RPC tests remain reference inputs, not production fallbacks. The detailed search output was kept outside Git at `/home/user/phase2g-audit.txt`.

## 3. Schema and reproducible migration

New `schema/trust.ts`, ordered migration `0005_notifications_reports_moderation.sql`, journal entry and generated snapshot. Notifications retain UUID recipient/actor FKs (recipient cascade, actor set-null), eight checked types, polymorphic nullable entity/context UUIDs, message/read state/timestamp, inbox and partial unread indexes. Internal eventKey+recipient uniqueness supports source dedupe. Reports retain reporter/resolver FKs, four checked entity types, nine checked reasons, three checked statuses, details/timestamps and reporter/status indexes. Details are bounded to 10,000 characters. Polymorphic targets deliberately have no incorrect FK to a single domain table.

## 4. Notification semantics

Preserves comment, reply, upvote, follow, application_received, application_accepted, application_rejected and application_withdrawn. Actor display name/username/Someone fallback, original message phrasing, title truncation, recipient and entity/context semantics are preserved. Self events are suppressed. Replies notify parent author and, only when different, post author. No notification for downvotes, vote removal, unchanged desired follow/vote/status, pending reconsideration, pipeline stages, community membership, polls, profile edits or lead creation/closure.

## 5. Trigger replacement and cross-domain transactions

`trust/notification-events.ts` is called with the current transaction by content createComment/castVote, social setFollow, and marketplace submitApplication/setApplicationStatus. No browser event-creation operation or public notification insert endpoint exists. All event writes are atomic with domain mutation/counters. No Supabase trigger or cross-provider delivery is needed by any migrated runtime mutation.

## 6. Idempotency, retries and concurrency

Stable comment/reply/application-insert source IDs dedupe per recipient. Recurring vote/follow/status transitions use source identity plus PostgreSQL transaction ID, permitting legitimate refollow/re-upvote/re-review rather than permanently suppressing them. Existing row/advisory locks serialize desired-state mutations; repeated requests see unchanged state and do not emit. This is source-event idempotency, not an invented universal browser request-id protocol. A newly created second comment is a distinct event. Withdrawn->pending reapplication updates the same application and does not generate application_received, matching the original UPDATE trigger.

## 7. Inbox, read state and UI

`/api/trust` serves scoped inbox, unread count, individual read and bulk read. Scope is always verified session uid; compatibility uid arguments in adapters are not transmitted as authority. Inbox defaults to 30, bounded at 100, newest timestamp/id first. Only isRead can be written, with foreign single IDs returning 404 and bulk writes scoped to recipient. Actor public projection is hydrated in the query without N+1 requests. Existing bell/page polling, read interactions and navigation remain unchanged. No new realtime transport or UI redesign.

## 8. Stale targets and notification privacy

Actor deletion leaves safe nullable actor data. Content notifications are checked against current Neon post visibility/deletion, current role/membership/ownership; inaccessible/deleted post message text is scrubbed to “This content is no longer available.” Links still pass through the existing destination authorization. No proposal/private pipeline data is included in events or hydration. Lead metadata remains public as before. No private application payload is exposed through notification APIs.

## 9. Report creation, validation and duplicate policy

Reporter is server-derived. Validates UUID/type/reason/details, existence, post/comment deletion and visibility (including parent post), and public lead/profile existence. Duplicate reports remain permitted: no legacy uniqueness constraint existed. Rolling ten-per-24-hour quota is now authoritative under a reporter profile row lock in the same transaction as insertion; concurrent duplicate requests cannot bypass it. Existing client pre-check remains informational; it is no longer the enforcement boundary.

## 10. Report history, staff queue and previews

Separate own-history operation scopes in SQL. Staff queue, status filter, open count and previews require actual Neon moderator/admin role. Queue includes public reporter name projection. Preview requests take stored report IDs, not arbitrary client target claims, and batch 100 reports per request. Preview keys include entity type plus UUID, preventing cross-type collisions. Posts/comments/leads/profiles all hydrate from Neon; missing/deleted references are safe. Existing UI entity filtering and bulk actions remain; bulk actions execute individual atomic requests as before, not an invented all-or-nothing batch feature.

## 11. Atomic moderation and removal

One transaction checks staff, locks report, applies optional removal and updates status/resolver/timestamp. Posts/comments soft-delete, leads close without losing application history, profile reports never automatically remove/suspend an account. Comment removal locks parent post first and decrements commentCount once even across concurrent reports. Repeating removal is idempotent. Reopening clears resolvedBy and does not restore content. Supported terminal decisions can be changed as in the legacy RPC. A failing report update rolls back content effects. Deleted target reports can still be resolved. Automatic ban/restoration/suspension or new audit tables were not invented.

## 12. Authoritative roles and existing privileged actions

Reuses Phase 2D Neon content role/Verified Pro mutations and Phase 2C moderation-user projection. Admin-only role assignment remains enforced by trusted DB role, supported role enum and target validation. Moderator/member self-escalation and admin self-demotion remain denied. Existing staff post/comment actions and marketplace staff close remain intact. Authorization failures/read failures fail closed; there is no Supabase fallback role authority. Legacy role/report tables had no separate immutable audit-log workflow to preserve; report status/resolvedBy/updatedAt are retained. Operator-controlled admin bootstrap remains unchanged; no seed user, admin account or public bootstrap endpoint was created.

## 13. API/session/error boundaries

Server-only trust entry uses established verified Supabase getUser session and canonical UUID = profiles.uid; injectable SQL module follows the established architecture. Browser role/uid/reporter/status/resolver claims cannot assign authority. JSON must be a non-array object; unknown operations reject. Domain refusals map to 400/401/403/404/429, FK/unique errors to 400/409, infrastructure failures to 503 without leaking SQL/parameters. Existing content write logging was hardened to SQLSTATE-only because Drizzle wrapped messages can contain notification titles/user content.

## 14. Removed runtime dependencies

Removed Supabase notifications/reports table reads/writes and moderate_report RPC from production adapters. Removed the Phase 2F non-atomic Neon lead close + Supabase report resolve sequence. Updated superseded static provider assertions and six obsolete mocked cross-provider tests to assert the atomic API contract, not to skip them. Extended allowed profile-SQL feature boundary specifically to the new server trust feature. Existing final-hydration rollback injection now targets statement seven because notification source-read and insertion precede it; the required rollback assertion remains.

## 15. Auth/Storage and unrelated infrastructure preserved

Supabase Auth and Storage are unchanged. Next 16 App Router, Neon Drizzle/pg connection policy, profile UUID identity, content/social/marketplace behavior, independent private tracker semantics and existing UI infrastructure remain. No migrated-domain dual writes/demo persistence fallback. Historical SQL/mock fixtures are not runtime database dependencies.

## 16. Hermetic/mocked/jsdom evidence

`npm test`: **35 files, 399 tests passed** (jsdom/hermetic, not authenticated browser or SQL evidence). Includes notification adapter scope/error/navigation tests, atomic report adapter tests and Phase 2G static runtime absence/architecture guards. `npm run test:db` without DATABASE_URL: **13 passed files, 7 skipped; 287 passed tests, 240 skipped**. This latter count includes mocked route/service/security tests, not 287 actual DB executions. Added trust HTTP/service tests cover unauthenticated operations, forged subjects/roles, payload stripping, configuration/Auth/DB failures, malformed JSON, HTTP refusals and absence of event/role/delete dispatch endpoints. No prior tests were disabled or weakened.

## 17. Actual local PostgreSQL evidence

Temporary external embedded PostgreSQL **18.6**, pg + real Drizzle node-postgres driver, dedicated `phase2g` database; no binaries/data added to Git. Configured `npm run test:db`: **19 passed files, 1 TLS file skipped; 524 passed tests, 3 TLS tests skipped**. This aggregate combines real integration and mocked tests. New trust integration suite: **26 real SQL tests passed**, covering event messages/fan-out/self suppression/dedupe; concurrent votes/follows/reviews; genuine recurring transitions; application reapply semantics; notification failure rollback of comments/follows/submissions and counters; scoped read/count; privacy scrubbing/actor deletion; 20 concurrent reports yielding exactly 10 inserts; target validation; staff privacy/queue/filter/previews; atomic removal/rollback; concurrent comment removals; stale targets; role denial/promotion/revocation; enum/length/auth validation. Existing marketplace **53 real SQL tests** and content/social integrations also pass.

## 18. Migrations, builds, lint and HTTP

Fresh databases `phase2g` and `phase2g_fresh` both accepted ordered migrations 0000–0005. `npm run db:check` passed. Typecheck passed. Lint: **0 errors, 6 existing react-refresh warnings**. Next production build and Vite production build passed; existing Vite chunk-size warning remains. `git diff --check` passed. Production Next server on 0.0.0.0:3000, connected to the fresh local DB, passed **12 real unauthenticated/public HTTP checks**: six private GETs 401, report/preview/moderation/read-all writes 401, malformed report body 400, public lead list 200. Preview-style Host accepted. Authenticated HTTP/browser end-to-end is not claimed; verified-session boundaries were tested with mocks and domain authorization with real SQL.

## 19. Actual Neon and operational limits

**Actual Neon verification pending**: no Neon credentials requested or used. Local SQL does not prove Neon TLS/pooler/deployment behavior; three opt-in TLS tests remain skipped. Apply migration 0005 in the deployment and verify real authenticated inbox/report/staff workflows against Neon before production cutover. This is a runtime/schema migration, not an executed historical Supabase data export/import: no historical notification/report rows were copied and no Supabase historical data was deleted. If existing production history must be retained, operator-controlled transfer/validation is still a deployment task. New writes/reads have no legacy persistence dependency. No email/push/event bus, pagination redesign, restore/ban workflow or speculative event type was added.

## 20. Final delivery and repository hygiene

All Phase 2G runtime work is coordinated in this branch, not schema-only or deferred domain subphases. New tests and reports are versioned; generated runtime dependencies, PG data and logs remain outside Git. The final implementation commit is the commit containing this report; obtain its full hash with `git log -1 --format=%H` (also supplied in the delivery response), avoiding a self-referential hash inside its own contents. Main/base branches remain untouched, no history rewrite and no Phase 2G PR opened/merged.
