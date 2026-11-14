# Phase 2I-A — owner-local verification and deployment preparation

## Scope and safety boundary

This phase prepares tools; **it does not execute infrastructure changes**. No owner terminal, VSCode, browser, real `.env`, Neon or Supabase instance was accessed. Do not paste credentials or environment-file contents into chat, issue trackers or logs. Do not enable shell tracing. No users, roles, admin accounts, production buckets or application records are created by these tools. Supabase retains Auth/Storage; application persistence remains Neon + Drizzle + node-postgres.

Use Node 22.6+ (tested here on 22.22.3). Commands use Node's experimental TypeScript stripping, not a new runtime/framework. `npm ci` uses existing dependencies. Never run an unfamiliar script merely because its name sounds like verification.

**Do not run `npm run test:db`, seed/bootstrap scripts, `db:push`, `db:generate` or reset tools against valuable Neon data.** The existing DB integration suite creates/drops application structures. `db:check` only validates migration files and is safe offline. The existing `db:migrate` invokes drizzle-kit directly and does not share the application's TLS URL sanitization; use the new explicit `verify:migrate` path for this procedure. No migrations are automatic during preflight, application startup or the hermetic tests.

## Environment inventory (names only)

| Name | Requirement/purpose |
|---|---|
| DATABASE_URL | Required; Neon/PostgreSQL application DB; same variable used by runtime and verifier |
| NEXT_PUBLIC_SUPABASE_URL | Required for complete Next deployment; public Auth/Storage project endpoint |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Required public Auth client credential; must not be a service credential |
| SUPABASE_SERVICE_ROLE_KEY | Required server-only private document signing/Storage capability |
| DATABASE_POOL_MAX | Optional positive integer, default 10 per Node process |
| DATABASE_SSL_CA | Optional PEM or local CA file; normally unnecessary for Neon |
| VITE_SUPABASE_URL | Optional legacy Vite project endpoint, must match Next endpoint when supplied |
| VITE_SUPABASE_ANON_KEY | Optional legacy Vite public credential; configure as a pair if using Vite |
| BORYNX_API_PROXY_TARGET | Optional server-side Vite proxy target; prefer Next full-stack validation |
| NEXT_PUBLIC_DEMO_MODE | Retired; if supplied must be false |
| VITE_DEMO_MODE | Retired; if supplied must be false |

There is **no separate direct migration URL variable** in this codebase. Owner chooses the intended target using DATABASE_URL in their private selected file. Never share it. `.env.example` already contains placeholders; this phase does not modify a real environment file. Only the listed names are loaded, only from the explicit `--env-file` plus shell fallback; the explicit file wins. No implicit dotenv loading in new tests/tools. Full `verify:env` requires the complete quartet; individual commands require only their dependencies. Empty optional values count as missing. Public key checks are structural (JWT role or supported key prefix), not signature/project verification. Validate matching project/credentials in owner controls without disclosing them. Enabling retired demo flags is an invalid deployment configuration; no runtime persistence fallback is added.

## Exact ordered owner-local runbook

Run from this repository root on your own computer, in a private terminal. The following are commands to perform later, **not claimed executed against your environment**. Keep credentials in your existing untracked private file. `.env.local` below denotes your selected file. Do not place a secret directly in a command line or exported snippet. Review this guide, the SQL and target identity before proceeding.

### 1. Offline gates — no provider requests

```sh
npm ci
npm run typecheck
npm run lint
npm test -- --run
npm run test:verification
npm run db:check
npm run verify:env -- --env-file .env.local
npm run build
npm run build:next
npm run verify:bundle -- --env-file .env.local
```

Expected: successful exits; env emits one `PRESENT`, `MISSING` or `INVALID` line per name with required/optional purpose, never values, then `PASS ENVIRONMENT_FORMATS`. Missing optional settings are okay. Required missing or any invalid setting exits 1. Build scan expects both `dist` and `.next/static`; it checks server credential markers and exact configured secret values in browser text outputs, does not print matches and is not a general secret-scanning service. Public anon keys are expected in browser output; DB/service credentials are not. Build only with your reviewed private configuration; inspect deployment server/client environment boundaries. Do not upload build artifacts or private logs here.

### 2. Read-only provider checks — owner authorization required

```sh
npm run verify:neon -- --env-file .env.local
npm run verify:migrations -- --env-file .env.local
npm run verify:auth -- --env-file .env.local
```

Expected Neon output: `PASS CONNECTION_IDENTITY; REMOTE_TLS_CERTIFICATE_VERIFIED`. The tool compares current database/user to the URL without displaying either. Remote `pg` stream must be encrypted and authorized; same shared TLS resolver as application removes URL SSL overrides and requires certificate chain/hostname validation (`rejectUnauthorized: true`). No `NODE_TLS_REJECT_UNAUTHORIZED=0`, `sslmode=no-verify`, or insecure fallback. Loopback reports `LOCAL_LOOPBACK_TLS_NOT_REQUIRED`, explicitly **not** Neon proof. Non-Neon remote PostgreSQL may also pass; operator must verify target project/branch/endpoint privately. TLS capability is not proof of production identity or appropriate permissions.

Expected migrations: source-controlled indices `0000`–`0006`, `applied=7 expected=7 pending=0`, `PASS MIGRATION_HASH_HISTORY_AND_EXPECTED_TABLES`. Missing journal is pending, not silently accepted. Applied history must be an exact source hash/timestamp prefix; newer/unknown/divergent history fails. Public tables declared in migrations must exist. This is **not full column/index/constraint drift detection**. Inspect privileged catalog state separately if history could have been manually altered. Read-only commands do not create a journal/schema.

Expected Auth: `PASS AUTH_SETTINGS_REACHABLE; ... NOT tested`. This GET uses the public key against Auth settings, has no user creation/login/admin call and proves only endpoint/configuration accessibility, not OAuth/email/session/profile correctness.

### 3. Pending migrations — separate decision, explicit write permission

Stop on pending or divergent history. Identify the correct target, backup/PITR and restore procedure, review every pending SQL statement, privileges, resource locks, deployment ordering and any existing data constraints. Do not baseline an existing schema automatically. If app tables exist without migration history the apply tool refuses, requiring a separate reviewed reconciliation plan. No data backfill/import is part of this phase. Decide pooled versus direct Neon endpoint using provider recommendations; connection identity must match, TLS must remain verified. Budget pool limits across instances, not just one process.

Only after independent operator approval:

```sh
npm run verify:migrate -- --env-file .env.local --apply
npm run verify:migrations -- --env-file .env.local
```

Expected: history/table pass, `PASS EXPLICIT_MIGRATION_APPLICATION`, zero pending. Without `--apply`, command exits before connection. Application uses the same shared pg pool/TLS stack; Drizzle default journal remains `drizzle.__drizzle_migrations`. Inspection precedes any DDL; migrations use the Drizzle transactional migrator. No concurrent migrators: **serialize** this command during the change window. The history check is not a concurrency lock. Existing migrations are not rewritten or undone. Verification pool has 5s lock timeout and 120s statement timeout; timeout is a stop/review event, not permission to reset. Inspect history again after a lost connection; never blindly retry mutations. Rerunning a completed unchanged history is a no-op; that is not a promise that every pending DDL is harmless on valuable data.

### 4. Isolated transaction write proof — separate opt-in

```sh
npm run verify:transaction -- --env-file .env.local --allow-write
```

Expected: `PASS TEMP_INSERT_READ_UPDATE_COMMIT_AND_ROLLBACK; application records untouched`. Uses Drizzle transactions with pinned clients, generated TEMP names, bound values, `ON COMMIT DROP`; insert/read/update and COMMIT acknowledgement then deliberate outer ROLLBACK. No persistent tables/application writes, no fixed names, TRUNCATE, destructive cleanup or session state spanning transactions; works with transaction pooling. This is a transaction-control/visibility proof, **not durable application-data commit or concurrency/load verification**. Rollback is evidenced by driver rollback acknowledgement after a controlled exception, not an independent persistent-row query. Client/pool release is guaranteed by Drizzle and finally/end; TEMP structures disappear at transaction end. The development diagnostic shares this isolated proof now. Do not use the dev diagnostic as a production health endpoint (it is disabled in production).

### 5. Storage — existing dedicated private test bucket only

This CLI intentionally **refuses application buckets** `post-documents`, `post-images`, `avatars`. Owner must approve an **existing**, isolated private test bucket whose policies/limits permit this exact exercise. No bucket is created or policy changed. No safe bucket available means SKIP/BLOCKED, not permission to test a valuable production bucket. Review its policies first. Substitute your approved existing bucket ID for the illustrative CLI argument below (not a credential variable):

```sh
npm run verify:storage -- --env-file .env.local --allow-write --bucket borynx-verification --prefix phase2i-verification
```

Expected: private upload/info/download/anonymous-denial/sign/retrieve pass, then `PASS STORAGE_EXACT_OBJECT_CLEANUP`. Text payload is fixed, path contains a fresh UUID, upload never overwrites. It inspects bucket privacy; downloads with service client; requires anonymous denial with an authorization/not-found status (network failure is not denial); creates a 60-second signed URL and retrieves it without printing the URL. URL origin must match configured project. This is **service capability + anonymous privacy only**, not application authorization/RLS or document MIME coverage. Privileged SDK bypass does not prove end-user access is safe.

Finally deletes **only** its generated object path and confirms absence. No listing or prefix deletion, no public bucket workaround, no upload into existing app records. If response/cleanup is ambiguous, exits 1 and prints `CLEANUP_REQUIRED` with only its generated recovery path. Owner should inspect/delete only that path in the approved test bucket and confirm absence; never bulk-clean a prefix. Avoid deleting other concurrent runs' objects. Re-run generates a new path, never restores previous data.

## Auth, profile provisioning and browser checklist (manual, NOT yet passed)

Use owner-approved controlled accounts A and B, no role escalation/admin creation. Choose a staging/safe target and disposable approved content. No automated account creation or authenticated browser framework is added. Record pass/fail/blocked privately with timestamp and redacted evidence; do not capture cookies, access/refresh tokens, signed URLs or network Authorization headers. Browser check mutations require separate owner consent and exact-record cleanup.

1. Review Supabase Site URL/redirect allowlist for local and deployment origins; OAuth provider callback setup and email delivery. Register/login only if specifically approved. Check failed/password/OAuth cancellation/expired code paths remain understandable without raw provider errors.
2. Visit a protected route logged out: correct login return path; login by approved password/OAuth flow; same-origin `from`/`next` destination preserved. External/protocol-relative/encoded unsafe return targets must stay on-site. Callback exchanges PKCE code, handles failure, and persists cookies. No user/role supplied by request may be trusted.
3. Reload protected URL, navigate directly, close/reopen tab. Observe durable SSR session. Let session refresh naturally; rotated cookies persist through proxy and redirect, no refresh loop. Logout invalidates session in browser and server; protected API mutations fail closed. Check unauthenticated provision POST denies rather than inventing a user.
4. For approved first login, verify `/api/profile/provision` uses verified `getUser()` identity and Neon `profiles.uid` equals that Auth UUID (private inspection, do not publish IDs). Existing profile is reused without overwrite, concurrent requests do not duplicate it. Browser sends no UID/role. Pending provisioning blocks profile-dependent actions; automatic attempts cap at 2 with cooldown and manual retry; transient DB failure yields recoverable failure, never writes to Supabase application tables. Repeated login/manual retry is idempotent; logout/account switch cannot apply a stale response. Do not deliberately break production connectivity to exercise failures: use a safe staging target or existing mocks.
5. Product coverage with A/B and anonymous views: feed/pagination/tags/search; create/edit/delete approved posts/comments, votes/bookmarks/follows; profile/username/identity; jobs/marketplace listings and applications; notifications/read state; badges; trust/reports/moderation/admin guards. Check allowed state persists after reload, duplicate/retry handling, unauthorized cross-account writes fail and unavailable DB shows error rather than mock persistence. Do not mutate real users' records or roles to run this list.
6. Documents: app upload accepts only reviewed MIME/size and `<verified uid>/<post UUID>/...` path; metadata stored in Neon. A (author/authorized viewer) gets signed download **only after** Neon visibility check. B without access and anonymous users must not obtain a signed URL; hidden/deleted/unpublished content must remain denied. `getAttachmentDownload` calls `findAttachmentForViewer` before `signDocument`, actor derives from verified server session. Check mismatched UID/path, other author's delete and direct anonymous private reads fail. Own-folder read/delete is deliberately possible for uploader cleanup; expired signed links stop working. Never make bucket public to fix access. Test images/avatars separately with approved app policies; the dedicated CLI is not their certification.
7. Review browser JS/network for absence of DB/service key and retired mock mode; client errors should not contain server SQL/credentials. Full Next server is the primary deployment check; legacy Vite needs its reviewed API proxy, not browser calls to another machine's localhost.

## Cutover audit — prepare/review only, NOT executed here

| Script | Impact/credentials | Rerun and failure semantics | Rollback / production safety |
|---|---|---|---|
| `ops/supabase_auth_neon_cutover.sql` | Privileged operator SQL on Supabase; exact `auth.users.on_auth_user_created` dropped only when handler resolves to `public.handle_new_user`; no account/data delete, function removal, role/bootstrap change | Transactional; absence is no-op; custom handler aborts. Added transaction-local 5s lock/30s statement timeouts | Save exact `pg_get_triggerdef`, handler definition, enabled state, dependencies and grants privately before change. After failed transaction rollback is automatic; after commit restore reviewed saved trigger/config only if old provisioning still compatible. Never blindly restore Supabase app-table writes alongside new Neon provisioning |
| `ops/supabase_storage_neon_cutover.sql` | Privileged Storage metadata/policy DDL; upserts `post-documents` PRIVATE, 10MiB and explicit MIME list, replaces six exact named policies with own-folder SELECT/INSERT/DELETE; UUID second folder only on INSERT; no UPDATE/upsert policy | Transactional, rerunnable desired-state changes, but rerun **overwrites custom bucket flags/limits/MIME and named policies**. Other policies remain and OR together. Added local timeouts | Snapshot bucket row, all applicable policy definitions/roles/commands/expressions and grants; audit all other permissive policies before approval. Restore exact reviewed snapshot transactionally after commit if reverting; do not drop bucket/objects or broadly delete policies. Never restore public access as a convenience workaround |

Take provider backup/restore checkpoints, choose change window, confirm operator permissions and test rollback on a safe clone. SQL credential requirements are provider operator permissions, not browser/service-key environment exposure. Neither script is unconditionally production-safe merely because transactional/rerunnable. The Auth script's same-name handler check does not prove function body unmodified: owner must inspect the saved function definition. Existing custom policies may still call Supabase application tables; inspect every applicable policy, not only names this script replaces. Bucket limits affect future writes, may reject previously accepted types; review existing clients before change. Do not delete historical Supabase or Neon data. No historical transfer/backfill, bootstrap changes or role mutation is authorized.

Deploy reviewed Neon schema before code that requires it, provide server-only credentials in the server environment, review Auth URLs/Storage policies and only then perform the manual checks. Neither cutover script is run by any new npm command. Never apply Neon migrations in Supabase SQL editor or apply Supabase operator scripts to Neon. Maintain old deployment version and tested restore plan. App rollback, Auth trigger restore, Storage policy restore and Neon schema/data restore are **separate** decisions; reverse SQL migrations are not generated. Rollback schema only through an independently reviewed provider restore/forward-fix plan that preserves valuable data. Stop new writers before any data restoration, assess changes made during the window, and do not replay legacy provisioning against incompatible storage.

## Troubleshooting and required operator decisions

- `ENVIRONMENT_PREFLIGHT_FAILED`/`COMMAND_CONFIGURATION_INVALID`: fix named missing/invalid field privately; no provider attempted. Use Next public pair for these commands, even when legacy Vite fallbacks exist in runtime. No need to disclose file contents.
- `OPERATION_FAILED`: generic intentionally hides provider errors/SQL/URLs. Check chosen private file existence/permissions, Node version, private provider dashboard connectivity and restricted local diagnostics yourself. Do not forward raw diagnostic output. Failure is not a license to disable TLS.
- `DATABASE_IDENTITY_MISMATCH` / `TLS_NOT_VERIFIED`: stop; confirm correct target, role/pooler naming, trusted CA and endpoint. Tool does not print observed identity. No TLS override allowed.
- `UNAPPLIED_MIGRATIONS`, `MIGRATION_HISTORY_MISMATCH`, `UNKNOWN_MIGRATION_HISTORY`, `EXPECTED_TABLE_MISSING`: stop and review history/schema; never reset/drop/adopt automatically. Pending files require explicit separate approval.
- Auth settings reachable but login fails: check approved redirect/Site URL, PKCE cookies, provider/email configuration, browser origin and provisioning separately. Endpoint reachability is not an authenticated pass.
- Storage failure: check approved bucket exists/private, text MIME/limits, server credential permissions and policy audit. Do not substitute an app bucket or make public. Service-capability pass does not settle A/B visibility.
- `BROWSER_BUILD_MISSING`: build both outputs first; secret-marker/value failure requires removing the leak and rebuilding, not deleting the scanner rule.

Outstanding owner decisions: provider project/Neon branch/role; pooled vs direct target; backup/PITR and migration change window; full schema drift review; SQL cutover/rollback snapshots and policy review; approved existing private test bucket; controlled accounts/disposable content; deployment URL/redirect allowlist and production secret placement. All real provider, local PostgreSQL and authenticated-browser execution remains unverified in this phase.
