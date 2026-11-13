# Phase 2F — Leads, Applications & Lead Pipeline Migration

## 1. Branch, base and mandatory preflight

- Working branch: `arena/999f6900-freelancer-s-hub`.
- Base: `0e64f9ffefecdbb1c5f837d5bca80a0aa168059f`, Phase 2E PR #31 merge into `migration/nextjs-app-router`.
- Before implementation, `gh pr view 31` confirmed MERGED, the working tree was clean, and HEAD matched that merge. The checkout was shallow; fetching three generations of the migration branch made ancestry available, and `git merge-base --is-ancestor 637e03ab23131e5f914f1a141720216889513f30 HEAD` passed.
- Phase 2E stable community UUID relationships, social feature modules and migration journal 0000–0003 were inspected and present.
- Arena already supplied this dedicated Phase 2F branch from the updated base. No additional branch, checkout, reset or history rewrite was needed or performed.

Pre-implementation dependency map: `docs/PHASE_2F_DEPENDENCY_MAP.md`.

## 2. Architecture and migration files

Preserves Next.js 16 App Router, the existing server-only Neon/Drizzle `pg` pool, verified Supabase Auth sessions and the canonical Supabase UUID matching profiles.uid. No alternative driver, identity, bidding architecture or persistence fallback was introduced.

New files:

- `src/server/db/schema/marketplace.ts`
- `src/server/db/migrations/0004_leads_applications_pipeline.sql`, Drizzle snapshot and journal entry
- `src/server/features/marketplace/marketplace-queries.ts` — pure injectable SQL/domain layer
- `src/server/features/marketplace/index.ts` — verified-session service/explicit dispatch
- `src/app/api/marketplace/route.ts` — force-dynamic HTTP boundary
- `src/lib/marketplace-client.ts` — browser/API boundary, no mock fallback

The migration adds three previously unmigrated tables. It does not rewrite earlier migrations or backfill disposable legacy data. Migrations 0000–0004 were applied successfully to two fresh local PostgreSQL databases, including a dedicated fresh verification database. `drizzle-kit check` passes.

## 3. Tables, relations, indexes and constraints

### leads

UUID id; title, description, text budget, currency, location, type, status, skills array, isVerified, postedByUid, postedAt and applicantsCount. Defaults remain open/false/zero. NOT NULL defaults remove legacy nullable counter/array ambiguity.

- FK postedByUid → profiles.uid, ON DELETE RESTRICT.
- Types exactly Bounty, Project, Retainer, Full-time.
- Statuses exactly open, in-progress, closed.
- Non-negative applicantsCount; nonblank title/description and lengths matching the existing creation form.
- Owner index, postedAt/id index, status/type index.

### lead_applications

UUID id; leadId, applicantUid, proposal, status, createdAt and updatedAt.

- FKs to leads and profiles, ON DELETE RESTRICT to retain commercial audit history.
- Unique (leadId, applicantUid).
- Status CHECK: pending, accepted, rejected, withdrawn.
- Nonblank proposal, bounded to 20,000 characters (new defensive request/storage bound, no new commercial field).
- Applicant/createdAt and lead/createdAt indexes.

### lead_pipeline

UUID id; userUid, nullable leadId, clientName, title, budget, source, stage and timestamps.

- userUid FK to profiles (cascade); leadId FK to leads (set null if an operator deletes an otherwise unreferenced lead).
- Unique (userUid, leadId), allowing multiple manual rows with null leadId.
- Existing stages: new, conversation, proposal, negotiation, won.
- Existing title/client/budget/source length constraints and owner/updatedAt index.

Profile deletion with owned leads/applications is now restricted rather than cascading away commercial history. Account deletion is not an implemented product workflow. No application DELETE API or lead hard-delete API was introduced; closure is the actual existing lead removal behavior.

## 4. Lead workflows migrated

Public discovery, details, creation, owner editing, lifecycle status updates and archival now run against Neon. Existing leads were publicly readable even when closed, so that remains true; the discovery page filters to open opportunities. No private-lead field or unsupported privacy mode was invented.

- Creation derives postedByUid from the server session; ignores caller ownership, verification, status and counter claims.
- Editing whitelists metadata/status and verifies ownership inside a locked transaction.
- Closing archives rather than deletes a lead. Applications and tracked opportunities remain attached.
- Reopening and transitions among the three existing statuses remain supported; invalid status strings are rejected. No terminal lifecycle or single-hire rule was invented.
- Optional server filters support type, status, owner, literal search and batched IDs. Existing discovery filtering/sorting UI remains unchanged.
- Lead author information is hydrated by one Neon join with a public profile projection, never role.

No lead edit form existed in the audited UI. Working edit/archive API and client adapters are supplied without inventing a replacement page.

## 5. Applications and bidding workflows migrated

Preserves the actual commercial model: free-text proposal plus the lead's existing text budget/currency. There is **no numeric bid, auction, bidding-credit system or proposed-price field** in the audited implementation, and none was added.

Implemented: submit, own application-to-lead lookup, sent inbox, received inbox, lead-owner application list, authorized application detail, owner accept/reject/reconsider, applicant withdrawal and withdrawn-row reapplication with a new proposal.

Applicant and lead profiles are hydrated in a single joined query per inbox (no per-application profile/lead requests). Public projections omit role. A dedicated integration test creates multiple leads/applicants and asserts that the complete received inbox requires exactly one SQL query.

### Lifecycle policy

- New submission: authenticated applicant, someone else's open lead, nonblank proposal, no active existing application.
- Reapply: only the applicant can reactivate their withdrawn row, only while the lead is open. Reuses the existing id and updates proposal/updatedAt.
- Applicant may withdraw an active application; repeated withdrawal is idempotent. Applicant cannot accept/reject or reset an active review state to pending.
- Owner may set an active application to pending, accepted or rejected, preserving the old review/reconsideration semantics. Owner cannot change proposal, lead or applicant, withdraw on the applicant's behalf, or resurrect a withdrawn application.
- Other users, including global staff, have no blanket application access/review rights.

Blocking owner resurrection of a withdrawn proposal corrects a legacy trigger inconsistency. Preventing duplicate submissions and resetting active applications through the submit flow preserves existing product behavior.

applicantsCount counts all non-withdrawn rows, including rejected applications, just as the original trigger did. Accept/reject does not automatically close the lead or imply that only one applicant may be accepted; no such rule existed.

## 6. Pipeline semantics and workflows

The audit established that lead_pipeline is an **independent, per-user private prospect tracker**, not an application-management board. A user may manually initialize a prospect or save a public opportunity; stages can be selected in any order or revisited. UpdatedAt ordering, stage filtering and client sorting remain unchanged.

Implemented list, manual creation, opportunity saving with existing metadata, unique saved-lead prevention, all existing stage changes and removal. Reads and writes always use the verified session's userUid. Deleting a tracker does not delete its lead or applications. Closing a lead does not silently erase a user's private notes/tracking record.

**Application association:** applications and saved tracker records share a stable leadId FK, but the legacy model has no applicationId relationship, automatic initialization on applying, or status-to-stage mapping. None was invented. An accepted application and a tracker at negotiation are not contradictory: one is the lead owner's review, the other the user's independent tracking choice. Acceptance/rejection therefore does not modify someone else's private pipeline. Tests exercise this independence through review and withdrawal.

## 7. Authorization and privacy

Every protected read and mutation derives identity from the existing verified server session, not any uid/applicantUid/userUid/postedByUid/actorUid supplied by the client. Compatibility uid arguments remain in the browser adapters for existing call sites, but are never sent to choose the private subject.

- Leads: public reads, authenticated own creation, owner-only metadata/status edits.
- Applications: authorization predicates inside SELECT queries; only applicant or lead owner can see proposal/details. Owner-list requests explicitly verify ownership. Staff do not bypass commercial privacy.
- Pipeline: owner-scoped SQL reads, updates and deletes; another user's row is indistinguishable from a missing row.
- Staff archive: checks the actual Neon global role inside the mutation transaction; normal users cannot enable it through a body role/actor claim.
- Failed database/authentication reads never become a successful empty inbox, public fallback or privileged viewer.
- HTTP failures return bounded error vocabulary without SQL/parameter disclosure. Domain 401/403/404/409 errors retain their intended status; unknown database failures map to 503.

No public administrator bootstrap or new role model was added.

## 8. Transactions and concurrency

All application lifecycle paths lock the lead first, then the application, in a consistent order. A transaction validates lead openness/ownership and previous application state, inserts/reactivates/updates, adjusts the count only on an active↔withdrawn transition, and commits together. Required submission hydration runs before commit; a read failure also rolls back submission and counters.

Unique constraints provide a second line of duplicate protection. Ten concurrent submissions or reapplications have one winner, not ten increments. Concurrent review/withdraw cannot revive a withdrawn proposal; repeated withdrawals decrement once. Lead closure and application submission serialize on the same lead row. A failed counter update rolls back proposal/status and relationship changes.

Lead edits/archival lock the lead in a transaction. Pipeline creation/stage updates/removal are each single owner-scoped atomic statements; no unnecessary multi-record transaction or cross-domain stage rewrite is introduced. Concurrent stage writes use ordinary last-committed-write semantics, matching the prior UI.

The existing pg/Drizzle implementation pins a connection for BEGIN through COMMIT. New workflows use transaction row locks, not session locks/state; transaction-mode pooling is compatible with that design. Actual Neon pooler behavior was **not** exercised.

## 9. Application pages and components integrated

Existing adapter signatures are preserved in leads.ts, applications.ts and pipeline.ts. LeadsBoard, LeadDetail, CreateLead, Applications, Pipeline and LeadCard now receive Neon data through these adapters. No visual redesign or generic placeholder components were introduced.

Direct component changes:

- LeadsBoard wraps its query function so React Query context cannot be confused with filter arguments.
- LeadDetail invalidates discovery/inbox counts after application changes.
- Applications invalidates lead detail, own application and discovery caches after reviews/withdrawal, avoiding stale counters/statuses across views.

Global search currently supports posts/people, not leads; it was left unchanged rather than inventing a new search product. Lead discovery retains its existing skills/title/location/person filtering. Profile pages have no additional direct lead-persistence query to replace.

## 10. Supabase Database dependencies removed

No production `.from('leads'|'lead_applications'|'lead_pipeline')` or embedded `profiles!leads_postedByUid_fkey` join remains under src. No migrated lead workflow falls back to localStorage or the mock Supabase client. Existing unsent creation drafts remain local UI drafts, not persisted opportunities, as before.

The shared mock module and historical Supabase SQL remain for unrelated infrastructure/testing/audit purposes. Their existence is not a production fallback: migrated adapters never call them. The marketplace portion of uxPersistence now uses an explicitly mocked API fixture; real SQL/privacy is covered separately. The document-storage tests in that same file still exercise their existing content mock unchanged.

## 11. Supabase boundaries and necessary report integration

Auth, UUID identity, cookie verification, Storage uploads/downloads and bootstrap procedure are unchanged. No bytes or notification/report/moderation records were migrated. Community/social functionality was not refactored.

Only lead-specific integration in reports.ts changed:

- Batched lead previews now read Neon and its public profile projection.
- Removing a reported lead closes it through a session/staff-authorized Neon action.
- The existing Supabase moderate_report RPC still writes the report record, but its legacy lead-removal flag is disabled after Neon closure so it cannot operate on an obsolete Supabase lead row.
- Non-lead report behavior stays unchanged. Failed lookup or Neon closure prevents report resolution; a report-RPC failure remains visible for retry.

This necessary two-provider operation is **not atomically committed across providers**. It closes first, then resolves the report; if report persistence fails, the lead may be closed with the report still open. Closure is idempotent so retry is safe. No distributed transaction or report migration was invented.

Historical Supabase application-notification triggers cannot observe Neon submissions/status changes. Notifications remain unmigrated; existing records/reads are unchanged, but automatic application notification delivery is outstanding. No fake notification success or dual-written application was introduced.

## 12. Tests and exact results

| Suite | Kind | Result |
| --- | --- | --- |
| `npm test` | Hermetic browser/unit/static | **33 files, 383 passed** |
| `DATABASE_URL=<local> npm run test:db` | Mix of real PostgreSQL and mocked server suites | **17 files passed, 1 skipped; 474 passed, 3 skipped** |
| marketplace-integration.test.ts | Actual PostgreSQL SQL/concurrency/rollback | **53 passed** |
| marketplace-security.test.ts | Mocked session/query dispatch and real route functions | **32 passed** |
| marketplace-client.test.ts | Mocked fetch boundary | **16 passed** |
| marketplace-reports.test.ts | Mocked supporting report/lead integration | **6 passed** |
| phase2f-marketplace-migration.test.ts | Static absence/boundary guards | **8 passed** |

The 3 skips are the pre-existing live-remote TLS verification suite. No Phase 2F test was skipped in the configured run. **474 is not a claim of 474 live SQL tests**: the database-configured suite also contains mocked service/route tests.

53 SQL tests cover creation, hydration, filters, public visibility, ownership, archival/history, invalid lifecycle states, staff archive, private application selection, own/received/owner/detail views, multiple-profile batched hydration, self/closed-lead rejection, duplicates, withdrawal/reapplication, review transitions, commercial privacy, concurrent submissions/reapplications/reviews/withdrawals/closure, counter and hydration rollback, independent private pipeline initialization/association/stages/order/removal, concurrent saves/stage writes and ownership isolation.

The submission-hydration failure test injects an empty required read after real PostgreSQL writes; the transaction and rollback are real, while that one read result is deliberately fault-injected. Other rollback tests use temporary failing CHECK constraints against PostgreSQL. All fixture users are removed after the suite; no application seed users/admins were created.

Existing tests were not weakened or skipped: obsolete allowlists/expected embedded joins were updated to assert the new absence, and the UX persistence tests still verify saving, deduplication, cross-account isolation and persistence across sign-out/sign-in. Their identity assertions now verify that a forged compatibility uid cannot override the API actor; unauthenticated private reads now explicitly fail rather than yielding a misleading empty list.

### Environment distinction

1. Hermetic/mocked tests: no live Auth/Neon calls.
2. Local PostgreSQL: version 18.6, actual Drizzle pg transactions, disposable databases started inside Arena.
3. Arena database results: only that sandbox-local fixture was used; no separate managed Arena database was claimed or queried.
4. Actual Neon: **not tested**, no credentials requested.

## 13. Static analysis, migrations, builds and HTTP smoke

- TypeScript: `npm run typecheck`, **0 errors**.
- ESLint: **0 errors, 6 pre-existing react-refresh warnings** in layout/navigation.
- Drizzle schema check: passed.
- Fresh migrations 0000–0004: passed on two local databases.
- Next.js 16.4.6 production build (Turbopack): passed.
- Legacy Vite build: passed; existing large-bundle warnings remain.
- git diff --check: clean.
- Static runtime grep: no migrated lead-table calls/embedded profile joins outside mocks/tests/historical SQL.

Actual production Next server against local PostgreSQL:

| Request | Result |
| --- | --- |
| Public lead list | 200 |
| Missing valid-UUID lead detail | 200 with null data (existing adapter contract) |
| Own application inbox with forged uid, signed out | 401 |
| Private pipeline with forged uid, signed out | 401 |
| Apply with forged applicantUid, signed out | 401 |
| Create lead with forged postedByUid, signed out | 401 |
| Change pipeline stage with forged userUid, signed out | 401 |
| Delete pipeline item, signed out | 401 |
| Invalid public status filter | 400 |
| `/l` and `/l/<missing UUID>` page shells | 200 |
| Public API with Arena-style preview Host | 200 |

These are real HTTP smoke requests, not authenticated browser end-to-end verification. Successful authenticated domain operations are proved through SQL integration and mocked verified-session dispatch tests, not a live Supabase user session.

## 14. Known limitations and outstanding work

- No private-lead mode, numeric bidding field, edit form, automatic application-to-pipeline stage mapping, one-hire rule or hard-delete workflow existed; none is claimed as delivered. Existing edit/archive functionality is available through working API/adapters without UI redesign.
- Historical data was not copied from Supabase. The phase brief permits disposable legacy data and requires no backfill.
- Notification trigger delivery and atomic cross-provider report resolution remain limitations (section 11).
- Lists remain unpaginated, matching the existing UI; no large-scale latency/load claim is made.
- Browser-local demo identities cannot authorize server commercial mutations. There is intentionally no mock persistence fallback.
- No real authenticated Supabase browser session was exercised in Arena. Auth/Storage code was not modified.
- Operator hard deletion of an unreferenced lead may null a saved tracker link; app archival retains it. Commercial application history prevents hard deletion via FK restrictions.

## 15. Actual Neon verification status

**Not performed.** Local PostgreSQL is evidence of SQL semantics, constraints, transactions and concurrency, not Neon operations. Outstanding: pooled/direct endpoint behavior, live TLS, pooler contention/timeouts, cold starts, transport-failure rollback/retry behavior, deployed migration execution and realistic discovery/inbox load. No Neon credentials were requested and implementation did not wait for them.

## 16. Final commit

The completion response supplies the final Git commit hash. This document is included in that commit and cannot contain its own content-addressed hash.

## 17. Operational confirmation

All work is isolated to `arena/999f6900-freelancer-s-hub`. `main` was not modified. No PR was opened or merged. No reset/history rewrite, new application seed users, administrator account or public bootstrap endpoint was introduced. Supabase Auth/Storage, operator-controlled bootstrap, and unrelated community/social persistence are preserved. No next migration phase was started.
