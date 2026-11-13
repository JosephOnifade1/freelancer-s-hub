# BORYNX Phase 2H — integration and Supabase Database cleanup

## A. Audit and disposition

Pre-implementation inventory and usage-level A/B/C/D classifications: **[PHASE_2H_AUDIT.md](PHASE_2H_AUDIT.md)**. Repository searches covered `.from/.rpc/.insert/.update/.delete/.select`, SDK construction, embedded joins, triggers/functions, mocks, compatibility routes, imports/callers and all five prior schema modules/journal. Initial tree was clean, base `a9bd8bacb255fdb1e98002eedfc2e017c9642a34`; fetched shallow ancestry and verified exact Phase 2G `50a6fcbe963ddedc452f2f2e65f0b820e43477d0` present before implementation.

**A — retained:** Supabase Auth/session/cookies/JWT/OAuth/password/email infrastructure and public SDK configuration; Storage upload/download/removal and byte policies. Isolated new server-only Storage capability is not an application database client. Supabase SDK dependencies remain necessary.

**B — intentionally retained outside application database runtime:** historical SQL/reports as provenance/export mappings, test-only mock/RLS fixtures, local drafts/UX preferences, unrelated lexical Array.from and Drizzle query methods. Historical SQL must not be run as current app setup. Existing staff/public Neon API surfaces remain supported; they are not Supabase compatibility fallbacks.

**C — removed/retired:** runtime content-demo and twenty delegates, runtime mock DB/Auth seeding factory, shared demo-account creation/login and mock-recovery UI, fake provisioning readiness bypass, silent badge error fallbacks, unused awardBadge, client calculateReputation/saveReputation chain, independent profile reputation/follower setters and deprecated services. Reputation write URL now explicitly returns 410, like the already-retired following-counter URL. Both cannot mutate a profile. Historical mock implementations were moved to test fixtures, not deleted to make tests disappear.

**D — resolved:** badge catalog and earned-badge reads now use Neon. The policy audit also found private Storage policies and legacy Auth provisioning trigger still assuming Supabase application tables. Application code now authorizes private downloads with Neon and verifies Storage bytes before pointer registration. Operator-only forward cutover scripts remove these legacy policy/trigger assumptions. They are supplied but **not applied to any live project**; configuration and live policy verification are Phase 2I environment work, not deferred application implementation.

Final production source guard finds **no Supabase application table calls or RPC calls**. Only Storage factories/operations remain. No unexplained category D application code remains. Live provider state cannot be certified from repository scans and is explicitly a cutover prerequisite below.

## B. Final architecture

| Owner | Responsibility |
| --- | --- |
| Supabase Auth | Canonical UUID, verified identity, sessions/tokens, OAuth, password/email flows |
| Supabase Storage | Uploaded bytes; private bucket and own-folder policies; short-lived capabilities |
| Neon/Drizzle | profiles/handles, content/comments/votes/polls/bookmarks/document pointers, communities/memberships/follows, leads/applications/private pipeline, notifications/reports/moderation, badges/earned rows |
| Browser UX state | Drafts, theme/dismissals; not an authoritative application-record fallback |

Server-only services derive protected actors from verified server identity. Staff authorization reads Neon profiles, fails closed on lookup failures and never accepts browser roles. Public endpoints retain public behavior/projections. Vite is still maintained as a browser frontend but requires the Next API backend; both dev and preview now proxy same-origin `/api` server-side. Static deployment requires equivalent reverse-proxy routing; no browser localhost service URL was introduced.

### Cross-domain / integrity / counters

- Identity owns the transactional handle registry + denormalized profile username; no second user ID or cross-provider FK. Profiles link to canonical Auth UUID without pretending PostgreSQL can enforce an external FK.
- Profiles/content authors, stable community IDs, posts/comments, polls/options/votes, memberships/follows, leads/applications/pipeline and attachment pointers retain Neon relational FKs. `communities.ownerId` intentionally supports `system`; it is not converted to a fake user FK. Existing tests enforce stable IDs through slug changes and reject missing communities.
- New composite FK ensures a poll vote's valid option actually belongs to its declared poll. Existing delete behavior is preserved, not expanded. Post/comment ups/downs must be nonnegative and score must equal ups-downs.
- Polymorphic votes/notifications/reports deliberately do not have false single-table target FKs. Target existence/visibility and soft-deletion are handled by domain queries; stale report/notification refs remain safe.
- Follows and membership relationships are source truth; serialized domain transactions are sole cached-count writers. Lead application count is nonwithdrawn rows with lead-first lock ordering. Post comment count tracks nondeleted comments and is decremented once in concurrent moderation. Vote rows/counters/reputation changes and their notifications commit together. Reputation retains existing nonnegative delta/clamp semantics; independent client recomputation is gone. Unread and poll totals are query-derived, not competing stored counters.
- Product uses soft deletion/lead closure, not an account hard-delete feature. Existing cascade policies are not redesigned. Operator hard deletion/import requires dependent counter/polymorphic-reference validation; there is no hidden live cleanup job claiming otherwise.

## C. Changes

### Schema and migrations

Forward-only **0006_remaining_badges_and_integrity.sql**, generated snapshot and journal entry:

1. `badges` catalog with existing checks/defaults; exact eight existing catalog records (not user seeds).
2. `user_badges` UUID id, profile/catalog FKs, unique user+badge and existing earned lookup indexes.
3. Poll-options composite uniqueness and matching poll-vote FK, preserving cascade semantics.
4. Post/comment vote counter checks.

Generated SQL initially ordered FK before its required uniqueness; reordered this **new, not-yet-successfully-applied migration** before the first successful application. No applied historical migration was edited. Invalid pre-existing imported counters/options should fail migration and require operator assessment, not be silently rewritten.

Badge API is read-only, with the legacy public catalog/earned projection. No catalog or earned writes are exposed to a browser. The unused permissive award helper had no callers or automatic trigger; no new award automation, badge notification or admin UI was invented. Existing progress/celebration calculations remain, but DB failures surface rather than becoming fake catalog/empty awards.

### Authorization fixes

- Retired the client-total reputation endpoint: callers could previously forge their own total despite being unable to target another uid. Removed its entire unused client/service/query chain.
- Removed independent follow counter query/service exports; only relationship mutation can move counters.
- Public content activity/contribution dates/resource counts/score sums/health now use the established viewer authorization filter, including parent-post deletion/visibility for comments. The old claim that counts/timestamps could not leak private activity was incorrect, especially because health returned post IDs.
- Storage download takes only attachment ID, loads stored pointer, checks current Neon post visibility/deletion/role/community facts, then signs that stored path/name. Client path/name/uid claims cannot choose a signing target. Anonymous public downloads remain allowed; inaccessible/deleted/private targets return indistinguishable 404.
- Server verifies immutable uploaded object's size/MIME before creating metadata and checks verified actor/post ownership before probing Storage. Provider/config failure leaves no new pointer. Privileged Storage credential exists in exactly one `server-only` module, never a browser prefix, response or log.

### Provider consistency and recovery

There is **no distributed transaction**:

| Boundary | Model and recovery |
| --- | --- |
| Auth -> Neon provisioning | Verified canonical UUID; existing idempotent provisioning, visible retry/cooldown state. Supabase account creation is not rolled back by Neon failure. Operator cutover retires exact legacy Auth->Supabase-profile trigger; custom trigger aborts for review. |
| Document upload -> Neon pointer | Upload first; server verifies object then transactional pointer/cap/ownership. Known refusal may compensate bytes. Ambiguous network/503/commit outcome never deletes bytes that might already have a committed pointer: UI reports recovery path and asks for metadata reload before retry. Cleanup failures are explicit. |
| Neon pointer removal -> Storage cleanup | Metadata-first hides link, then byte removal. Failed cleanup is visible; operator/user can retry with object path. No fake atomic success. |
| Document download | Neon visibility authorizes a 60-second Storage capability; response private/no-store. Missing object/sign/config failure visible. Revocation is bounded by already-issued capability expiry; no immediate revocation of existing signed URLs is claimed. |
| Public image upload -> profile/content URL | Auth own-folder byte upload then Neon pointer. Pointer failure can leave unreferenced bytes, not a fabricated successful record. Reuse/retry/operator orphan cleanup; no queue introduced. |

External operator deletion of an Auth account has no automatic cross-provider cascade into Neon; retained attribution/profile cleanup requires an explicit operator retention/reconciliation decision, not a fabricated FK or destructive webhook. Deleted Auth identities cannot select a new mutation actor through browser claims.

A concurrent external owner deletion after object verification can still remove bytes: unavoidable cross-provider race, download fails visibly and metadata can be removed/re-uploaded. Existing own-byte/orphan read/delete rights remain for uploader cleanup; only **other viewers** depend on the new Neon-authorized signer. No Supabase app-table RLS lookup is retained as fallback.

New operator scripts:
- `ops/supabase_storage_neon_cutover.sql`: private bucket, own-folder upload/read/delete, no legacy app-table lookup, no update/upsert; review all other policies because policies OR together.
- `ops/supabase_auth_neon_cutover.sql`: retires only repository's exact `on_auth_user_created -> public.handle_new_user`; no account/table deletion/seed/bootstrap/role changes.

Neither was executed against a live provider. Storage signing/object verification requires deployment-only `SUPABASE_SERVICE_ROLE_KEY`; absent configuration fails closed. No credentials requested. Existing Auth/session clients still use anon+user credentials, not this capability.

### Query/performance/compatibility cleanup

- Badge catalog/earned each one projected SQL read; earned rows bounded by catalog uniqueness, no N+1 profile lookup.
- Staff report/history SQL and HTTP are 100-row keyset pages using exact stored timestamp/id anchors (not millisecond client timestamps). Own anchors are reporter-scoped; staff gate precedes query. Adapters preserve full queue/history behavior, with no truncation/UI redesign. Existing status/reporter indexes support these paths.
- Public stats filter in SQL instead of exposing hidden rows and filtering in browser. Existing batched author/actor projections are retained; no privileged fields added for convenience.
- Removed mock alternate ownership and obsolete setter helpers. Old explicit 410 route tombstones preserve a meaningful response to legacy callers, not an active second mutation mechanism.
- README and environment guidance now describe Neon ownership, Storage cutover, real backend requirement and retired demo flags instead of instructing deployment of obsolete Supabase app tables/triggers.

## D. Exact verification

All completed against this implementation; logs outside Git at `/home/user/phase2h-*`.

| Gate | Result / evidence class |
| --- | --- |
| `npm run typecheck` | Passed, no TypeScript errors |
| `npm run lint` | 0 errors, 6 existing react-refresh warnings |
| `npm test` | **38 files, 414 passed**; hermetic/jsdom/mocks/static guards, not actual providers |
| `npm run test:db` without DATABASE_URL | **15 passed files / 8 skipped; 302 passed / 253 skipped**; deliberately hermetic route/query/service tests, not SQL proof |
| Configured `npm run test:db` | **22 passed files / 1 skipped; 552 passed / 3 opt-in TLS skipped**; aggregate includes mocked tests and real SQL integrations, not 552 actual SQL/provider tests |
| New real SQL suite | **13 tests passed**, local PostgreSQL **18.6**, real pg/Drizzle node-postgres; badge catalog/FKs/uniqueness/errors, mismatched and valid concurrent poll-option votes, private/deleted-parent activity privacy, counter constraints, multi-post concurrent reputation/notification updates, repeated concurrent follows and 205 equal-timestamp report rows across 100/100/5 pages with no duplicate/owner leak |
| Existing real SQL suites | Content **86**, social **31**, marketplace **53**, trust **26**, identity **11**, profile **20** passed; plus existing driver compatibility checks |
| New mocked Storage suites | **15 tests passed**: Neon authorization precedes signing, no client path authority, object verification preconditions, missing config/provider failures, fixed bucket/60-second expiry, no credential/provider error leakage; these do NOT verify actual Storage policies |
| New browser boundary tests | Badge error/progress/read projection and Storage compensation/lost-response tests; historical mock RLS UX tests still run only through explicit test fixtures |
| Fresh migrations | Dedicated empty local `phase2h` and `phase2h_fresh` accepted 0000–0006; catalog contains eight rows, no account/award seed |
| Drizzle `db:check` | Passed, coherent schema/history |
| Next production build | Passed |
| Legacy Vite production build | Passed; existing chunk-size warning retained |
| Production/proxy API smoke | **24 passed**: 12 each through Next and Vite same-origin proxy, preview-style Host accepted. Catalog8/earned, invalid uid400, no badge mutation405, both retired writes410, missing attachment404 despite forged path, private notifications/reports401, public stats/leads200. No authenticated identity mocked for these checks. |
| Existing server/document smoke | **48 PASS checks**, all server checks passed: routes/redirects, assets/styles, 404, markup, no duplicate IDs |
| Static dependency audit / whitespace | New whole-production graph guard passed; no app-table/RPC/mock fallback; `git diff --check` passed |

Obsolete tests were updated to assert stronger retirement/field-whitelist boundaries rather than removed/skipped. Old setter test intent is replaced by refusal/absence and real relational/concurrency coverage. Historical UX tests explicitly mock APIs now; they cannot implicitly exercise a production demo fallback.

No actual Neon or live Supabase Storage/Auth operation is claimed. No privileged live policy changes, historical import or seed accounts were executed.

## E. Phase 2I / real deployment requirements

1. Apply/review Neon migrations with deployed verified-TLS/pooler runtime; run actual Neon transaction/concurrency/HTTP checks. Three TLS tests remain opt-in/skipped.
2. Configure real Auth/session/redirect origins and verify login/signup/email/OAuth/password/session refresh plus idempotent Neon provisioning in a browser. Hermetic tests preserve these boundaries but are not live flow proof.
3. Operator-review/apply the two supplied Supabase cutover scripts, including ALL existing Storage policies/custom Auth triggers. Do not re-run historical Supabase app migrations. Verify no live DB trigger remains dual-writing application records.
4. Configure server-only Storage credential and verify actual object info size/MIME response, own-folder upload/delete, public/member/staff signed downloads, deleted/hidden targets, expiry, outage/compensation recovery and old signed-capability expiration. Missing credential fails closed today.
5. Confirm no service credential appears in client build/environment/logs, production Vite reverse-proxy if used, deployment environment/schema drift, connection budgets, observability/backups and operator bootstrap unchanged.
6. Run integrity/counter checks before constraints if using historical data; review immutable/soft-deleted history and externally deleted object orphans. No automated production reconciliation/destructive purge introduced.

These are genuine provider/environment verification requirements, not another application-domain migration subphase. Repository implementation is complete; live cutover is explicitly not certified here.

## F. Historical-data assessment — NOT executed

Current users are disposable test identities; no historical production import is required or authorized. If real history existed:

1. Back up both databases and Storage metadata. Establish cutover/write freeze (no dual writes), snapshot and validation counts. Document any intervening writes; don't pretend snapshots across providers are atomic.
2. Preserve Supabase Auth UUID exactly as profiles.uid, every domain UUID, timestamps, attachment paths, polymorphic target UUID/type and referenced community identity. Never remap identity or create seed/admin accounts. Normalize/validate usernames and resolve handle registry conflicts explicitly.
3. Import profiles then usernames; communities with system/real ownership; posts with validated stable communityId mapping from slugs; comments topologically by parent; polls then options then poll_votes; content votes/bookmarks/document metadata; memberships/follows; leads then applications/pipeline; badge catalog then earned rows; notifications/reports after identities/targets. Notification event keys for imported rows need a unique historical-row namespace; do not pretend historical event delivery occurred in Neon transactions.
4. Validate row counts/checksums/samples, enum compatibility, unique handles/relationships, option->poll consistency, parent->post coherence, missing authors/targets, nullable actors/resolvers, soft-deletion/visibility, application count vs nonwithdrawn applications, member/follower/comment/vote counters, legitimate reputation clamp history, and unread states. Distinguish intentionally stale polymorphic refs from broken ordinary FKs. Verify public/private projections with real identities.
5. Storage bytes stay in Supabase: verify object paths, sizes/MIMEs and signed access against Neon. Missing bytes need explicit restore/re-upload/removal decisions, not fake pointers. No Storage data transfer is implied by SQL export/import.
6. Test restore/rollback before switching traffic. Reverting app code after Neon writes does not restore old Supabase data. Rollback requires write freeze, backups and reconciliation/export of post-cutover changes; new schema checks may reject invalid historical records. Never drop legacy data/roll back provider history automatically.

This section is assessment only. No credentials acquired, export/import run or success fabricated.

## G. Git / delivery

- Branch: **arena/390b0f94-freelancer-s-hub**.
- Base: **a9bd8bacb255fdb1e98002eedfc2e017c9642a34**, Phase 2G merge.
- Final implementation commit: the commit containing this report; full hash supplied in delivery response and available with `git log -1 --format=%H` (a commit cannot embed its own final hash).
- Working tree checked clean after final commit; generated PostgreSQL binaries/data, build outputs, dependencies and logs excluded from Git.
- Main/base branches untouched. No branch switch/history reset/rewrite. **No Phase 2H PR opened or merged.** No seed users/admin account created; operator bootstrap unchanged.
