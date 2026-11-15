# Phase 2I-B.1 — Security blocker remediation

## Starting point and branch constraint

- Starting/current Arena branch: `arena/31e69de5-freelancer-s-hub`.
- Starting/current HEAD: `7eec783f1f198343f386c962f45ee924c3c2de55`.
- Starting tree: `4ca122a6aa99971f097f73b775e773724f10ff8b`.
- Read-only GitHub query identified original feature commit
  `afaf4d3902b6a221d99ac05f139b56f9eff9e29e`, whose tree is exactly the same.
- Arena fixes this session to its assigned branch. No new branch was created or
  switched to; this active branch holds the correction work. The original
  Phase 2I-B branch and main were not modified. Changes are uncommitted, so HEAD
  remains the starting commit; the corrected working tree is not that old tree.

## H1 — Canonical document authorization and one-use upload intent

The original prefix check authorized one path spelling while URL normalization
could make the service-role SDK inspect/sign another object. New shared validator
requires lowercase canonical UUIDs (RFC variant, versions 1–8), exactly three
components, allowed extension and exact expected actor/post. It never decodes or
normalizes input into permission. Traversal, encodings, alternate separators,
extra components, URL syntax, control characters and whitespace are rejected.

A durable `document_uploads` row binds actor, owned post, bucket, generated key,
size, MIME, expiry (15 minutes), lifecycle state and eventual attachment ID. The
server authorizes the post before issuing it and generates the random object UUID.
No client-supplied actor/folder/key is accepted by the upload route.

The same intent row is locked during upload, registration and cleanup. Registration
requires a ready, unexpired, exact-match intent; object metadata is verified via
Storage before the existing post ownership/deletion/count transaction inserts the
attachment. Registration and consumption commit atomically. Valid-looking unissued
keys and another user's object-UUID aliases are refused before SDK fetch.

Privileged info/sign/delete helpers independently validate canonical key and
expected owner/post, including stored legacy pointers. Signing still follows Neon
attachment-ID/post visibility authorization and returns short-lived URLs through
private/no-store responses. No public document/media endpoint was introduced.

## M1 — Server-authorized deletion lifecycle

States: `uploading -> ready -> registered`, or `uploading/ready -> delete_pending
-> deleted`. Registered objects enter deletion only by authorized attachment-ID
removal. Tombstones are retained; pending/deleted can never register again.

- Direct orphan cleanup requires an issued row, ownership, no live pointer, and
  ready/expired-upload/pending state. A valid-looking path alone is insufficient.
- Intentional deletion removes metadata and persists delete permission/attachment
  ID together. Canonical legacy attachments may create a retirement-only row from
  their authorized stored metadata; this is NOT a fresh registration intent.
- Cleanup durably commits pending status before byte deletion. A second transaction
  holds the same row lock across another reference check and provider deletion.
- Registration takes that lock and only accepts ready. Either registration wins
  and cleanup refuses, or deletion wins and registration refuses.
- Provider failure or DB-finalization failure leaves pending permission for retry.
  A repeated attachment-ID request and owner cleanup endpoint retry the same key.
  Deleted state is idempotent. Missing-object removal relies on Storage's normal
  idempotent remove semantics; no live-provider claim is made.
- The existing browser follow-up is now an idempotent retry, not authorization.
  The compatibility metadata-deletion query delegates to durable permission too.

This is a bounded outbox/state machine, not a distributed transaction or new job
system. There is no automatic cleanup worker. A server-generated key whose upload
response is lost remains tracked even when the browser never receives its path;
owner-approved future reconciliation can retry the durable record. No key is
reused or made registrable after pending status.

## H3 — Reset scope established by schema and relation OID

The extracted executor resolves exactly the allowlisted ordinary `public` tables,
requires every relation, sets transaction-local `search_path=pg_catalog`, takes
ACCESS EXCLUSIVE locks, and rechecks identities before inspecting dependencies.
FK comparison uses relation OIDs across all schemas, not bare names. It also refuses
inheritance/partition expansion, user triggers and rewrite rules that could expand
side effects. All DELETE ONLY and constraint-validation statements are schema
qualified. DDL adding parent dependencies conflicts with the held relation locks.

No deletion occurs until checks finish; any failure rolls back the transaction.
The existing CLI environment/loopback/designated-name/connected database-user-address
identity/explicit consent gates remain before this executor. Plan does not connect;
its output now names public-qualified targets. New lifecycle/provenance tables are
explicitly added child-first. Schema/history/provider objects remain outside reset.
After approved deletion the profile FK and canonical attachment constraint validate.

## M4 — Seed-owned identity provenance

`development_seed_identities` records exact auth UUID, email, persona and a
server-generated ownership marker. No browser endpoint can write this registry.

Every existing auth user must match provenance before any seed profile/role changes.
A matching email is no longer sufficient. Better Auth signup is instantiated on
an outer transaction's Drizzle adapter; user/credential creation and provenance
insert commit together. A failed provenance insert rolls back the identity too.

Crashes after committed identity/provenance or profile creation are restartable:
retry recognizes the exact seed-owned UUID, then provisions/claims normally. Role
assignment rechecks provenance inside its transaction and explicitly verifies only
that seed-owned identity. Demo-login also requires matching seed provenance and
verified auth identity before normal password login. Passwords are never reset to
adopt an unproven identity.

The four personas and Neon roles are unchanged (freelancer/client=member,
moderator=moderator, admin=admin). Old Phase 2I-B demo identities have no provenance
and intentionally refuse adoption; use an independently approved fresh disposable
development dataset rather than an unsafe email-based backfill.

## Additive migration

`0008_security_document_lifecycle_seed_provenance.sql` plus Drizzle snapshot/journal:

- `document_uploads`: lifecycle/intent/outbox with size/state/bucket/canonical-key
  checks, actor/post ownership fields, expiry and unique retained attachment ID.
- `development_seed_identities`: unique auth UUID/email/persona, ownership marker.
- Restrictive FKs retain lifecycle/provenance records rather than silently losing
  cleanup permission or adopting a replacement identity.
- `attachment_canonical_key` CHECK added NOT VALID: new writes enforce it; legacy
  invalid pointers are not silently rewritten/deleted, but helpers refuse them.

No migrations 0000–0007 were changed. No migration applied to any socket-connected
local or hosted database. New SQL was applied ONLY in ephemeral in-memory PGlite.

## Verification

Fresh results, not copied from the previous handoff:

| Check | Result / environment |
|---|---|
| Canonical + real SDK configured-fetch boundary | 22 passing tests; actual Supabase SDK, mock fetch only; info/sign/delete URL capture and rejected-before-fetch cases |
| Upload intents, registration/private ownership, deletion lifecycle | 14 passing tests; actual SQL in PGlite, mocked provider operations; includes unissued victim-object aliases at SDK boundary |
| Reset actual SQL executor | 9 passing tests; PGlite, all relations/migrations; ordinary scope, foreign/same-name/cascading cross-schema refs, dependency after planning, hostile search_path, missing table and user trigger refusal |
| Seed provenance/partial recovery | 6 passing tests; actual Better Auth/Drizzle/PGlite, no-op mail; fresh/repeat, unproven demo identities, identity/profile crash recovery and atomic provenance failure |
| Entire auth/security suite | 6 files / 73 tests passed (includes 22 original auth/development tests) |
| Additional existing route/capability suites | 2 files / 50 tests passed; mocked services/SDK, explicitly selected provider-free files only |
| Full ordinary suite | 39 files / 386 tests passed; jsdom/mocks |
| Root typecheck / scoped strict-null auth typecheck | Passed |
| Drizzle journal consistency | Passed; generation/check are offline only |
| Next production webpack build | Passed; provider/DB configuration explicitly unset for final build |
| Lint | Passed, 0 errors / 6 pre-existing Fast Refresh warnings |
| Historical migration and dependency manifest/lock diffs | None |

No real PostgreSQL socket/concurrency test was run. PGlite executes actual PostgreSQL
catalog/constraint/transaction SQL but its single-engine scheduling does not prove
multi-connection lock contention or hosted pg/pooler behavior. Promise.all race tests
exercise both state orderings, not an independent-session concurrency certification.

No live Storage, Neon/TLS, Google, email, browser-cookie or deployed integration was
verified. Socket-based historical test:db suites were not run; their older direct
attachment-registration fixtures predate required upload intents and require a
separate owner-approved migration to the new contract before use. This does not
turn the new embedded tests into real-Neon evidence.

## Remaining limitations / review points

- Aggregate upload quotas/rate limits, image byte validation and avatar URL policy
  from the prior audit remain separate, unchanged issues. Do not infer production
  release approval from these four corrections.
- Critical/high dependency findings remain; see the separate dependency assessment.
  Package manifests and lockfile are unchanged.
- No automatic outbox worker or provider reconciliation was added. Pending state
  is durable/retryable, not a guarantee of eventual byte removal without retries.
- There is no atomic transaction spanning PostgreSQL and Storage. A lost provider
  response can require reconciliation. Already issued signed URLs remain bearer
  access for their short remaining lifetime. DB locks span provider operations;
  production request/SDK timeout and connection-budget review remains important.
- Legacy noncanonical pointers fail closed and are not automatically repaired.
  Canonical legacy pointers can still download after normal Neon authorization and
  can be explicitly retired by ID; new registration always requires intent.
- The application DB role is trusted. This protects against HTTP callers, not a
  malicious SQL administrator able to forge provenance or bypass lifecycle writes.
- Reset refuses nonstandard relations/side effects rather than attempting to infer
  safety; this is deliberate fail-closed behavior.

## Execution boundaries and stop

No reset/seed CLI was executed. No local PostgreSQL socket/server or hosted database
operation, live upload/download/delete, email/OAuth/provider operation, deployment,
commit, push, PR or merge occurred. Read-only GitHub/npm metadata calls were used.
No private environment file or credential was read. Tests use only ephemeral PGlite,
synthetic identities and mocked SDK fetch/mail. No R2 or Phase 2I-C work performed.

Changes await review on the active correction workspace; no release/cutover approval
is implied. See file inventory below.

## File inventory

### Modified

- `scripts/development/cli.ts`
- `scripts/development/plan.ts`
- `scripts/development/seed.ts`
- `src/app/api/content/attachments/[id]/route.ts`
- `src/app/api/content/attachments/route.ts`
- `src/app/api/dev/demo-login/route.ts`
- `src/app/api/storage/objects/route.ts`
- `src/lib/attachments.ts`
- `src/server/db/migrations/meta/_journal.json`
- `src/server/db/schema/content.ts`
- `src/server/db/schema/index.ts`
- `src/server/features/content/content-queries.ts`
- `src/server/features/content/index.ts`
- `src/server/storage/documents.ts`
- `tests/db/storage-capability.test.ts`

### Added

- `DEPENDENCY_REMEDIATION_PLAN_2I_B_1.md`
- `PHASE_2I_B_1_REMEDIATION.md`
- `scripts/development/reset.ts`
- `src/server/db/migrations/0008_security_document_lifecycle_seed_provenance.sql`
- `src/server/db/migrations/meta/0008_snapshot.json`
- `src/server/db/schema/security.ts`
- `src/server/storage/document-capability.ts`
- `src/server/storage/document-key.ts`
- `src/server/storage/document-lifecycle.ts`
- `tests/auth/document-boundary.test.ts`
- `tests/auth/document-lifecycle.test.ts`
- `tests/auth/reset-executor.test.ts`
- `tests/auth/security-fixture.ts`
- `tests/auth/seed-provenance.test.ts`

### Removed

None.
