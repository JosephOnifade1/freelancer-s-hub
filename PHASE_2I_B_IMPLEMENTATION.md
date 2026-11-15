# Phase 2I-B — Better Auth implementation and review handoff

## Scope and state

Implemented on Arena branch `arena/a06ebc25-freelancer-s-hub`, starting at
`f2689c09c60614f59c604818fca70aa6ef9c4655`. Arena's assigned branch was retained;
no branch switch, commit, push, PR, deployment or production cutover was performed.
Work is ready for code review, **not a claim of production/provider readiness**.
No private env files were read. No live Neon, Supabase, Google, email or R2
operations were performed. No actual database reset or external demo seed ran.

Earlier phase reports describe historical Supabase authentication and are
superseded here for active runtime auth. Storage remains Supabase.

## Implementation map

- `src/server/auth/`: lazy shared Neon/Drizzle instance, pure configuration,
  pinned Better Auth + separate Drizzle adapter **1.7.25**, guarded HTTP handler,
  explicit local-development gates. Existing pool and TLS configuration unchanged.
- `src/lib/auth-client.ts`, auth API catch-all, hooks, Login/Signup/ResetPassword,
  guards/proxy and consumers now use Better Auth. The application boundary remains
  `src/lib/server-session.ts`, validating verified email, UUID and database session.
  Proxy cookie presence is navigation UX only, **not authorization**. SDK/server
  errors propagate rather than treating an infrastructure failure as logout.
- `schema/auth.ts`, additive migration **0007** and snapshot/journal: UUID users,
  sessions, accounts, verifications and persisted rate limits. Auth generates UUIDs;
  profile UID is the very same identity, not a new mapping. Migration 0000–0006
  were not rewritten. New profile FK is `NOT VALID`: old rows are not silently
  imported/rekeyed/deleted, while new writes are enforced. Explicit approved local
  reset validates the FK. Applying 0007 does not itself delete development data.
- Provisioning: actor-specific advisory transaction lock; profile+username writes
  in one outer transaction, collision retries in savepoints, no overwrite on
  repeat, rollback on failure. Failed provisioning does not invalidate auth.
- `src/server/email/`: provider-neutral JSON gateway, disabled default, explicit
  private local-file outbox. Gateway delivery requires an owner-implemented HTTPS
  service; no fictional provider integration/delivery claim. File messages contain
  sensitive links and must remain private under gitignored `.local/auth-outbox`.
- Supabase Auth/SSR runtime consumers retired; compatibility modules empty.
  `src/server/storage/bridge.ts` is now the sole service-key reader. Authenticated,
  exact-origin server uploads use generated ownership paths and bounded input;
  documents additionally check Neon post ownership. Browser uploads contain no
  service key or Supabase auth JWT. Image URLs remain public as before. No R2,
  bucket policies, provider migration or file deletion operation was executed.
- `scripts/development/`: explicit plan/reset/seed CLI; Login demo component and
  `/api/dev/demo-login` use normal Better Auth password/session authentication.
  Test-only historical fixtures retain the old mock query API, not runtime identity.

## Security choices

Opaque database sessions: seven-day expiration, one-day refresh threshold,
five-minute freshness, no cookie cache; HTTPOnly/Lax, secure over HTTPS, host-only
cookies with `borynx` prefix. Reset revokes sessions. Password minimum 12.
Verification required. Exact trusted origins, no wildcards, HTTPS in production.
Auth POST wrapper additionally enforces origin for anonymous requests. OAuth GET
callbacks rely on Better Auth state/nonce handling; legacy Supabase callback codes
fail closed. Database HTTP rate limits cover auth endpoints; demo direct API calls
have a separate atomic database counter because server API calls bypass HTTP limits.
Deployment must configure trustworthy proxy/IP handling before relying on per-IP
rate limiting. Never expose a direct backend behind spoofable forwarding headers.

Implicit email linking disabled; different-email linking disabled; no role fields
accepted in auth metadata. Existing Neon member/moderator/admin roles remain the
sole privilege source. Explicit authenticated linking is a separate SDK feature,
not an automatic same-email migration. Google is optional and **untested**; configure
its callback at the exact app origin `/api/auth/callback/google`.

## Reset and demo safeguards

Reset is **implemented but not run**. `plan` has no database connection. All tools
require NODE_ENV=development **and** BORYNX_ENVIRONMENT=development, loopback
PostgreSQL only, name `borynx_dev`/`borynx_test` (optional alphanumeric suffix), and
matching BORYNX_DEV_DATABASE_NAME. Remote Neon/provider targets are rejected even
when development-labelled. URL `options` rejected; connected database, user and
server address must match. Reset also requires BORYNX_ALLOW_DEV_RESET=true,
`--apply`, and `--confirm=<designated-name>:DELETE-ALL-DEVELOPMENT-DATA`.

Exact child-first DELETE allowlist lives in `scripts/development/plan.ts`; includes
application/auth records, not schema or migration history. Unknown FK dependents
refuse execution. No DROP SCHEMA/DATABASE/TRUNCATE shortcut, no automatic startup,
build, migration or deployment hook. Supabase byte objects remain untouched;
this tool does not pretend to clean external Storage files.

Seed separately requires BORYNX_ALLOW_DEV_SEED=true, `--apply`, and a server-only
BORYNX_DEMO_PASSWORD of at least 20 characters. It rejects non-demo existing auth
identities; serializes owner CLI operations; signs up through Better Auth, provisions
and claims handles normally, then explicitly verifies **local seed accounts only**.
Fresh demo identities (all `.test`):

| Account/handle | Authoritative role | Purpose |
|---|---|---|
| demo_freelancer | member | Skills/bio and portfolio resource post |
| demo_client | member | Client bio and representative project opportunity |
| demo_moderator | moderator | Moderation queue example |
| demo_admin | admin | Existing admin role/UI workflows |

Freelancer/client are personas, not invented authorization roles. Seed tested twice
in a separate disposable embedded database: four identities, stable representative
records and correct roles. No real files seeded. Seed is restartable but not one
all-or-nothing four-account transaction; partial failure can be retried. Changing
local password after seeding does not silently reset existing credentials.

Demo buttons compile away in production client builds; runtime endpoint also
rejects nondevelopment configuration and nonloopback requests. Password stays on
server; no browser password field, privileged credential or bypass session. They
are intentionally unavailable in Arena's remote preview and production.

## Owner-local VS Code steps (not executed here)

1. Review diff and 0007, provision a **new disposable local** PostgreSQL database.
   Keep live/provider env entirely separate. Privately configure env names below;
   never paste values into chat or commit them. Use a random strong auth secret.
2. Install locked dependencies (`npm ci`). Apply reviewed migrations using the
   established owner-local migration workflow to the disposable database only.
   Do not run db:push. Check database name/host yourself before connecting.
3. Export the local env privately, or pass explicit `--env-file <private-local-file>`
   to dev:data tools. No automatic dotenv loading occurs in those tools. Run
   `npm run dev:data:plan`; review its exact table list and target privately.
4. **Only if local data deletion is intended**, enable reset approval and run
   `npm run dev:data:reset -- --apply --confirm=<designated-name>:DELETE-ALL-DEVELOPMENT-DATA`.
   This is destructive to that designated local database. Never use a live target.
5. Enable seed approval and run `npm run dev:data:seed -- --apply`. Repeating it
   should retain the four accounts and example records. Turn approval flags off.
6. For browser auth, run Next with explicit local env and EMAIL_DELIVERY_MODE=file,
   inspect private outbox locally for verification/reset links. Enable local demo
   login only when required. Test normal signup, verification, reset, logout,
   session refresh/expiry, role restrictions, profile retries and storage uploads.
7. Separately configure an owner-controlled email gateway and Google test project
   for provider integration review. No production cutover authorization is implied.

Environment names (no private values): existing DATABASE_URL, DATABASE_POOL_MAX,
DATABASE_SSL_CA; BETTER_AUTH_URL, BETTER_AUTH_SECRET, BETTER_AUTH_TRUSTED_ORIGINS;
GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET; EMAIL_DELIVERY_MODE, EMAIL_GATEWAY_URL,
EMAIL_API_KEY, EMAIL_FROM; NODE_ENV, BORYNX_ENVIRONMENT, BORYNX_DEV_DATABASE_NAME,
BORYNX_ALLOW_DEV_RESET, BORYNX_ALLOW_DEV_SEED, BORYNX_ENABLE_DEMO_LOGIN,
BORYNX_DEMO_PASSWORD. Retained Storage configuration: NEXT_PUBLIC_SUPABASE_URL,
VITE_SUPABASE_URL, compatibility public anon-key names, SUPABASE_SERVICE_ROLE_KEY.
No secret may use a browser public prefix. See `.env.example`.

## Verification and limitations

- Full root typecheck PASS; scoped auth strictNullChecks typecheck PASS (root
  legacy strictNullChecks remains off; explicit client projection preserves typing).
- Ordinary mocked/jsdom suite **39 files, 386 tests PASS**. Earlier suite had 418
  tests: obsolete Supabase PKCE/SSR refresh assertions were replaced with current
  callback-retirement, proxy and database-session contracts, not silently skipped.
  Full provisioning recovery and logout scenarios retained with reactive hook mocks.
- Auth suite **2 files, 22 tests PASS** using actual Better Auth/adapter and embedded
  PGlite PostgreSQL, all migrations in memory only: UUID/account hash/verification,
  unverified rejection, session/logout/expiry, password-reset/token reuse/revocation,
  provisioning idempotency/concurrency/collisions/rollback/FK, guarded CSRF,
  four-account seed idempotency/roles, development reset/demo/origin gates.
- Drizzle migration journal check PASS (no remote connection).
- Next production webpack build PASS; lint PASS with six existing Fast Refresh
  warnings. No claim that a live browser or external provider was tested.
- Static runtime tests reject Supabase Auth/SSR consumers and browser privileged
  imports. Service-key reader restricted to server Storage bridge. Historical docs,
  SQL, verification-provider scripts and test fixtures can still mention Supabase.

Unverified: actual Neon/TLS connectivity with owner configuration; Google exchange
and same-email OAuth conflict end-to-end; email gateway delivery; real browser
cookies/refresh; external Storage behavior/policies; real pg socket concurrency;
reset execution and live deployment. Reset authorization tests are pure gates,
never a destructive execution. Explicit account-linking security is configuration
coverage, not a simulated Google takeover proof. File MIME is allowlisted, not
malware scanning/byte-signature validation; existing external avatar URL semantics
are unchanged. Public image access policy and file malware scanning need separate
review. PGlite cannot certify every hosted PostgreSQL/network behavior.

Dependency install reported 66 audit findings (56 moderate, 7 high, 3 critical);
no unrelated blanket audit-fix performed. Review dependency advisories before any
release. No deployment, R2, identity import, provider decommission or next phase.
