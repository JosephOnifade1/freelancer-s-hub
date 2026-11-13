# Phase 2H pre-implementation inventory

Preflight: clean arena/390b0f94-freelancer-s-hub at a9bd8bacb255fdb1e98002eedfc2e017c9642a34. Fetched three commits of migration branch; exact Phase 2G 50a6fcbe963ddedc452f2f2e65f0b820e43477d0 ancestry verified. Reviewed schemas identity/content/social/marketplace/trust, journal 0000–0005, pg/Drizzle singleton/config/TLS architecture, server-only service/session boundaries and route inventory.

Scans cover all repository .from/.rpc/.insert/.update/.delete/.select, SDK clients, embedded joins, trigger/function SQL, mock adapters, imports/callers and compatibility endpoints. Raw listings outside Git: /home/user/phase2h-{db-refs,all-supabase,consumers,query-audit}.txt.

## Exhaustive reference categories (one per usage)

A — Must remain: browser/server Supabase SDK construction, server getUser cookie verification, auth hooks/context/login/signup/OAuth/password/email/session flows, proxy/session/callback configuration, Supabase auth types and environment configuration; uploads.ts/attachments.ts Storage byte upload/download/removal. Auth/Storage deployment SQL remains required policy configuration, not application-table authority. SDK packages and lock entries support these uses.

B — Retained outside application database runtime: historical phase reports and legacy Supabase application schema/migration SQL are provenance and optional historical export mapping, not deployable Neon migrations. Historical mock database test fixtures and their tests are regression references only; detach from production module graph. Documentation/code comments naming former joins/functions are history, not calls. Array.from and non-Supabase Drizzle/SQL methods are not Supabase references. Local drafts, dismissed notices and UX preferences are intentional browser UX persistence, not fallback copies of authoritative domain records.

C — Obsolete/removable: content-demo.ts and content-client's twenty flag-dispatch branches; runtime MockSupabaseClient and seedMockData wiring (mock Auth identities cannot authorize Neon APIs). Remove stale demo account creation and misleading UI/config claims. Unused awardBadge public insert helper (no callers, permissive legacy RLS allowed forged awards). Independent profile counter setters/retired services and unused client reputation recomputation helper. Historical mock implementation remains test-only. Existing retired public route paths return explicit 410 rather than silently accepting legacy writes.

D — Remaining application Database dependency: badges.ts catalog and earned-badge table reads (Profile/Achievements callers). Migrate badges/user_badges to Neon with existing catalog and read semantics; retain FK/unique constraints. No actual awardBadge caller/automatic award trigger exists: do not invent an award workflow. Remove silent database-error->fake catalog/earned-state fallback. Badge progress remains a view of existing computed inputs, not a new persistence/authorization mechanism.

## Genuine cross-domain issues found

- SECURITY: /api/profile/reputation still accepts any client total despite vote transactions already owning reputation. Remove this competing writer and unused caller chain; preserve route as 410. Dead follow-counter setters have no production callers and should be removed as well. Add refusal and source-of-truth regressions.
- Integrity: poll_votes has independent poll/option FKs but no guarantee option belongs to its declared poll. Query validates it; add composite relational FK forward-only. No cascade-policy expansion.
- Integrity/performance: posts/comments vote counter invariants and nonnegative counters not constrained; enforce source-consistent score=ups-downs and nonnegative ups/downs. Add actual negative/race tests.
- Security/privacy: contribution date/statistics queries need visibility review, because public stats must not enumerate private author dates. Resolve any query missing the established visibility predicate.
- Cross-provider Storage compensation: metadata registration failure attempts remove but ignores cleanup errors; expose cleanup failure and recovery object path. Removal is metadata-first with explicit cleanup failure, not ACID; document recovery.
- Unbounded staff report/history lists: preserve full supported behavior with paged queries, not silent truncation. Review other listing methods for bounded public endpoints and existing caller expectations.

## Relationship/counter ownership map

profiles.uid is canonical Supabase Auth UUID; no cross-provider FK. usernames registry + profiles.username updated transactionally by identity service. Content author/community/comment/poll/attachment/bookmark relations use Neon FKs, communityId not mutable slug. Community ownerId deliberately supports system ownership and remains text; no fake profile/system user FK. Membership and follows use relational constraints and serialized domain transactions; sole writers adjust their cached counts. Votes and report/notification targets are polymorphic, validated in services, not false entity FKs. Soft deletion retains votes/reputation/history; no automatic hard-deletion feature. Poll count/unread are query-derived, not duplicate stored counters. Applications use lead-first lock and nonwithdrawn count; private pipeline has nullable lead reference and independent stage. Notifications are emitted inside source transactions with dedupe; reports/removal are one transaction. Public author hydration is batched; no profile N+1 found.

## Unavoidable provider boundaries

Auth signup/verification precedes Neon provisioning: verified server identity, idempotent retry/recoverable provisioning state, no cross-provider transaction. Storage upload then Neon pointer registration: compensate on known registration refusal; uncertain transport failures need pointer reconciliation before deleting bytes. Metadata-first removal hides link before best-effort byte cleanup; operator retry may be needed. Image upload then profile/content pointer update can leave unreferenced bytes on failure, never authorize or fabricate a successful pointer; retry and operator orphan cleanup, no distributed transaction. Historical export/import is an assessment only; current test identities disposable, no transfer required/authorized.

## Final findings / classifications after implementation

A late policy-level search found a **real hidden category D dependency**: legacy private-document Storage RLS consulted Supabase posts/post_attachments/can_view_post, and the old registration trigger checked object existence there. This was not safe to leave under the generic “Storage retained” label. Implemented Neon-authorized server download signing, server object size/MIME verification before pointer registration, and a forward operator Storage-only policy cutover. Privileged credential is server-only, Storage-only, not an application database client. Old auth.users->public.handle_new_user trigger is another category C dual-write assumption: supplied an exact-trigger-only operator retirement script. Neither script was executed against a live provider. Their application/configuration is a separate deployment environment operation for Phase 2I, not deferred application implementation.

| Usage inventory | Category | Final action |
| --- | --- | --- |
| lib/supabase.ts, lib/supabase-server.ts, lib/supabase-env.ts, lib/server-session.ts, proxy.ts; app/auth/callback and verified-session users | A | Real cookie-backed Supabase Auth, SDK/config/types retained; no mock factory |
| lib/auth.ts, hooks/useAuth/auth-context, Login/Signup/ResetPassword/Settings, AppLayout, Onboarding/Landing, posts/users auth lookups, db-probe auth configuration check | A | Auth/session/password/OAuth/profile-provisioning context retained; mock recovery/account paths removed |
| lib/uploads.ts (upload/getPublicUrl) | A | Public avatar/post-image bytes only |
| lib/attachments.ts (upload/remove); server/storage/documents.ts (info/createSignedUrl) | A | Storage bytes only, Neon owns metadata/visibility; unavoidable cross-provider precondition/compensation documented |
| ops/supabase_storage_neon_cutover.sql | A | New Storage bucket/policy configuration with no app-table queries |
| Supabase npm packages / package-lock, config env names, public bucket URLs | A | Needed by Auth/Storage; no package removal |
| Historical root Supabase SQL, previous reports, historical tests/fixtures | B | Provenance/export map and explicit test-only RLS fixtures; never application deployment setup |
| Array.from in editor/CreatePost/Admin/skeleton, Drizzle execute/SQL and query mocks | B | Not Supabase Database functionality; lexical matches explained, not removed |
| drafts/notices/theme/UX localStorage | B | Intentional local UX state, not application DB fallback |
| lib/content-demo.ts + twenty delegates | C | Deleted from runtime, no production imports |
| lib/mockSupabase.ts and seed factory wiring | C | Runtime file removed; historical mock moved to src/test/fixtures and explicitly mocked by tests only |
| Demo account handlers/buttons/mock recovery/provisioning bypass | C | Removed; deprecated env flags warn rather than enabling fake identities |
| awardBadge (no consumers), saveReputation/calculateReputation and independent profile setters | C | Removed; legacy write URLs explicitly return 410; replaced obsolete setter tests with refusal/ownership invariants |
| Existing on_auth_user_created -> public.handle_new_user trigger | C | ops/supabase_auth_neon_cutover.sql retires exact legacy trigger; custom trigger aborts for review; not executed |
| badges/user_badges reads | D, resolved | Migrated to Neon schema/API/services/client; original eight catalog rows, no user/award seed or new automation |
| Private-document old RLS/trigger dependency on app tables | D, resolved in code/config | Neon authorization + server object verification/signing and Storage-only policy cutover supplied; live deployment application pending |

Final static guard checks the entire production source graph (not a whitelist of old domains): **zero Supabase application table calls and zero RPC calls**. All six actual production .from factory calls support seven Storage operations in uploads/attachments/server Storage; four Array.from uses are unrelated. Privileged credential reader is restricted to one server-only file. No remaining category D application code is left on Supabase. Legacy live provider triggers/policies are not claimed removed until the Phase 2I operator cutover is run and verified.

Report lists now use recipient/staff-authorized 100-row keyset pages; adapters preserve full existing queue/history rather than silently truncating it. Vite dev/preview routes same-origin APIs to the maintained Next backend. Badge failures stay visible. Public activity/date/resource/score/health aggregates obey established content visibility including deleted parent posts. Migration 0006 adds original badge catalog/earned schema, composite poll-option identity FK and vote counter checks; generated FK/unique ordering was corrected before the first successful application, no historical migration rewritten.
