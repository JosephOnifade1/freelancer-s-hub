# Phase 2B.3 — Identity Workflows: Neon Verification, Profile Provisioning, Atomic Username Claiming

> **Read §3 and §12 first.** The real-Neon connection was **not** executed in this
> environment because no database credentials were available. Everything below
> that touches a database was run against a **local PostgreSQL 18** server with
> the real `pg` + Drizzle `node-postgres` stack. That is stated plainly wherever
> it matters and is never reported as Neon verification.

---

## §1. Branch and starting commit

| Item | Value |
| --- | --- |
| Working branch | `arena/4f869d1b-freelancer-s-hub` |
| Starting commit | `2cc039fb321cfaa84d52253ab62c72e578134739` |
| Branched from | `migration/nextjs-app-router` |
| Base commit of that branch | `2cc039f` — *"Merge pull request #26 …"*, 2026-11-13T08:57:27Z |
| `main` | **`1d18864`, untouched.** See §14. |

The tree was clean at the start of the session. Nothing was reset, cleaned,
discarded or regenerated; no branch was switched. PR #26 (Phase 2B.2) is merged
into `migration/nextjs-app-router`; no PR was opened or merged for 2B.3.

## §2. Files inspected and changed

### Verified present before any work (by inspection, not by report)

| Artefact | Check |
| --- | --- |
| `src/server/db/schema/{_shared,identity,index}.ts` | present (3 files) |
| `src/server/db/migrations/0000_identity_foundation.sql` + `meta/` | present |
| `src/server/db/env.ts` | `grep -c "rejectUnauthorized: true"` → **2** occurrences |
| `src/server/db/index.ts` | first line `import "server-only";` |

### Inspected (read-only)

`src/lib/users.ts` (`claimUsername` L205–245, `ensureUserProfile` L35–109) ·
`src/views/Settings.tsx` (save flow, L80–130) · `src/hooks/useAuth.tsx` ·
`src/views/Login.tsx`, `src/views/Signup.tsx` · `src/app/auth/callback/route.ts` ·
`src/app/onboarding/page.tsx` · `src/components/AuthGate.tsx` ·
`tests/phase1.1-auth-callback.test.ts` · `src/server/db/index.ts`, `env.ts` ·
`package.json`.

### Created

| Path | Purpose |
| --- | --- |
| `src/server/features/identity/provision-profile.ts` | Pure DI provisioning core. |
| `src/server/features/identity/claim-username.ts` | Atomic claim, inside one transaction. |
| `src/server/features/identity/index.ts` | `server-only` orchestrator: session → Neon. |
| `src/app/api/profile/provision/route.ts` | `POST`, reads **no body**. |
| `src/app/api/profile/username/route.ts` | `POST`, body is `{ username }` only. |
| `src/lib/profile-provisioning.ts` | Thin client shim for the two routes. |
| `tests/db/provision-profile.test.ts` | 13 unit tests (fake DB). |
| `tests/db/claim-username.test.ts` | 11 unit tests (fake DB). |
| `tests/db/identity-services.test.ts` | 10 unit tests (mocked session + DB policy). |
| `tests/db/identity-integration.test.ts` | 11 tests against **real PostgreSQL**. |
| `docs/PHASE_2B_3_IDENTITY_WORKFLOWS.md` | This report. |

### Modified

| Path | Change |
| --- | --- |
| `src/hooks/useAuth.tsx` | `acceptSession` awaits server provisioning before `setUser`. |
| `src/views/Login.tsx` | `ensureUserProfile(data.user)` → `provisionProfileOnServer()`. |
| `src/views/Signup.tsx` | Same, but only when a session exists (see §6). |
| `src/views/Settings.tsx` | `claimUsername(user.uid, …)` → `claimUsernameOnServer(…)`. |
| `src/lib/users.ts` | `ensureUserProfile` and `claimUsername` marked `@deprecated`, no callers. |

No schema, migration, Supabase module, or UI layout was changed.

## §3. Neon connection results — **NOT EXECUTED**

**No database credentials exist in this environment.** Probes:

- `env | wc -l` → **17** variables; none matching `neon|database|postgres|pg`.
- `DATABASE_URL`, `NEON_DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_UNPOOLED`,
  `PGSSLMODE`, `DATABASE_SSL_CA` → **all unset**.
- `find /home/user -maxdepth 3 -name ".env*"` → only `.env.example`.
- No exports in any shell profile.

The user stated the variables "will be configured locally"; they had not been
configured at the time of this run. Consequently **every** item below is
**PENDING, not verified**:

| Requirement | Status |
| --- | --- |
| Pooled connection for runtime | **PENDING** — no credentials |
| Direct connection for migrations | **PENDING** — no credentials |
| Runtime TLS enforced (`rejectUnauthorized: true`) | Code verified; **live handshake PENDING** |
| `rejectUnauthorized: false` impossible | Verified by construction (§4) |
| Connection pooling behaviour | **PENDING** vs Neon |
| Parameterised query round trip | Verified vs **local PG** only |
| Interactive transactions | Verified vs **local PG** only |
| Rollback | Verified vs **local PG** only |
| Transaction-scoped advisory locks | **PENDING** — not exercised |
| Two concurrent operations contending for a lock | Partially: **row-level** contention proven (§7); advisory-lock contention **PENDING** |
| Cleanup / error handling | Verified vs **local PG** only |
| Failed migration leaves no partial changes | **PENDING** vs Neon (mechanism exists; see §12) |

This is the one substantive gap in the phase and it is a credentials gap, not an
implementation gap. Re-running §5 and this table against Neon requires only
`DATABASE_URL` and `DIRECT_URL`.

## §4. Runtime TLS vs Drizzle Kit TLS — verified separately

These are two independent code paths, and the phase document for 2B.1.1
established that they behave differently.

**Runtime (`src/server/db/index.ts` → `resolveConnectionSettings`)**
`rejectUnauthorized: false` is unreachable, and not by convention: the function
strips every TLS parameter (`sslmode`, `sslrootcert`, `sslcert`, `sslkey`) out of
the URL *before* `pg` parses it, then applies its own `ssl` object. The comment at
`index.ts:89–92` records the reason — `pg` merges the parsed URL over the config,
so a `?sslmode=no-verify` in the URL would otherwise silently win. Verified
statically in this session and proven live in Phase 2B.1.1 against a TLS-required
fixture.

**Drizzle Kit (`drizzle-kit migrate`)**
A separate path that **ignores** `resolveConnectionSettings()` entirely. It failed
against the TLS-required fixture in 2B.1.1 unless the URL itself carried
`?sslmode=verify-full&sslrootcert=…`. The consequence for Neon is that the
*direct* migration URL must carry its own `sslmode=verify-full`; the runtime
hardening does not extend to it. Nothing in this phase changed either path.

**Neither path can silently fall back to an insecure connection.** No
`sslmode=no-verify`, no `rejectUnauthorized: false`, no conditional that disables
verification. Confirmed by grep across `src/server/db/`.

## §5. Migration application and catalog verification

**Against local PostgreSQL 18.6 (not Neon).** `drizzle-kit migrate` reported
success — which on its own proves nothing, so the catalog was queried directly:

```
TABLES: profiles, usernames
```

Exactly the two tables the phase is allowed to create. **No unrelated tables.**

Constraints, read from `pg_constraint`:

| Table | Type | Name |
| --- | --- | --- |
| profiles | p | `profiles_pkey` |
| profiles | c | `profiles_username_format_check` |
| profiles | c | `profiles_username_lowercase_check` |
| profiles | c | `profiles_role_check` |
| profiles | c | `profiles_status_check` |
| profiles | c | `profiles_reputation_non_negative` |
| profiles | c | `profiles_followers_non_negative` |
| profiles | c | `profiles_following_non_negative` |
| usernames | p | `usernames_pkey` |
| usernames | c | `usernames_username_format_check` |
| usernames | c | `usernames_username_lowercase_check` |
| usernames | f | `usernames_uid_profiles_uid_fk` |

Indexes from `pg_indexes`:

```
profiles   profiles_pkey, profiles_reputation_idx, profiles_role_idx, profiles_username_key
usernames  usernames_pkey, usernames_uid_key
```

Migration history: **1 row** in `drizzle.__drizzle_migrations` (hash
`f0a217fb86f0…`). One migration, applied once.

`usernames_uid_key` is the unique-constraint that forced a design correction —
see §7. No Supabase resource was touched, because none exists in this database.
No seed users were inserted.

## §6. Provisioning implementation and integration point

### Shape

`provisionProfile(db, identity)` is a **pure dependency-injected core**: the
database arrives as a parameter and the module never imports the connection
module. That makes it unit-testable with a fake, and testable against local PG
and Neon without duplication. `src/server/features/identity/index.ts` is the only
place where a Supabase identity meets the Neon tables.

### Idempotency and concurrency

```
insert into profiles (uid, username, "displayName", initial)
values (…)
on conflict (uid) do nothing
returning uid, username
```

- **1 row** → created. The generated handle is then claimed in `usernames`.
- **0 rows** → already existed. The row is re-`select`ed and returned with
  `created: false`. Nothing is overwritten, so a user who has since changed their
  display name or bio keeps those edits (test: *"does not overwrite a profile the
  user has since edited"*).

`role` and `isVerifiedPro` are **never written**, so they hold their schema
defaults (`member`, `false`). Privilege escalation is not prevented by a check;
there is no code path that sets those columns.

### Integration point — `acceptSession` in `src/hooks/useAuth.tsx`

The smallest reliable point is the one funnel that *every* session already passes
through:

- password sign-in → `onAuthStateChange` → `acceptSession`
- OAuth/PKCE return → callback sets cookies → first `getSession()` → `acceptSession`
- token refresh → `onAuthStateChange` → `acceptSession`

`acceptSession` is now `async` and awaits provisioning **before** `setUser()`.
This is the requirement that a successful Supabase login must not be reported as a
provisioned profile: a session is not reported as a signed-in viewer until the
Neon operation has succeeded. A `catch` wrapper ensures a provisioning failure
cannot strand the app in `loading` — the session is real even when the profile
call fails.

The OAuth callback route (`src/app/auth/callback/route.ts`) was the alternative
candidate and was rejected: it covers only OAuth, so password and
email-confirmation logins would still need a second mechanism. One funnel beats
two.

`src/lib/users.ts`'s `ensureUserProfile` (a browser check-then-write with a
caller-supplied uid) had two remaining callers in `Login.tsx`/`Signup.tsx`; both
now call `provisionProfileOnServer()`, and the old function is marked
`@deprecated` with no callers. **No competing mechanisms remain.**

In `Signup.tsx` provisioning runs only when `data.user && data.session` — with
email confirmation enabled there is a user but no session, so there is nothing to
authorise a write yet.

Routes: `POST /api/profile/provision` returns 201 created / 200 existing / 401 /
503 / 400 / 500 opaque. `export const dynamic = "force-dynamic"`.

## §7. Atomic username claiming

The old implementation in `src/lib/users.ts` was a four-round-trip check-then-write
(`select` → `delete` → `upsert` → `update`) that released the caller's existing
handle **before** attempting to win the new one, so a lost race could leave a user
with no username at all.

The replacement, in `claim-username.ts`, runs entirely inside `db.transaction`:

1. Validate the uid (UUID) and normalise the handle — `^[a-z0-9_]{3,15}$`, the same
   rule `USERNAME_RE` in `src/lib/auth.ts` expresses and the same rule the database
   `CHECK` enforces. Invalid input returns before any connection is opened.
2. Read the current profile. Absent → `profile_missing`.
3. Same handle already owned → `same` (idempotent no-op, no writes).
4. **Release the old handle, then `insert … on conflict (username) do nothing
   returning`.**
5. Zero rows → throw a private `UsernameTaken` → **transaction rollback** → `taken`.
6. One row → `update profiles set username = …, "updatedAt" = now()` → `claimed`.

### A real bug this phase found

The first implementation claimed the new handle *before* releasing the old one,
and the unit tests passed. The **real database rejected it**:

```
error: duplicate key value violates unique constraint "usernames_uid_key"
```

`usernames(uid)` is UNIQUE, so a user may hold only one registry row — a second
insert is impossible while the first exists. Ordering is therefore forced by the
schema, and the safety that ordering appears to give up ("never release a handle
for a claim that fails") is recovered by putting both statements in **one
transaction**: a losing claim rolls the delete back. Atomicity, not ordering, is
what protects the user. This is exactly the class of error a fake database cannot
produce, and it is recorded in the source comment so it is not "simplified" back.

### Structural authorization

`claimUsernameForCurrentUser(desired)` takes **one** parameter. There is no uid
argument anywhere in the public API, so claiming for another UUID is not a request
the system can express — a test asserts the function's arity. Ownership is implied
by `where uid = <verified uid>` on every statement that touches a row.

Typed outcomes: `claimed | same | invalid | taken | profile_missing | failed`,
mapped to 200/200/400/409/404/500 by the route. Driver error messages can embed
the connection string, so `failed` is opaque and a test asserts no `postgres://`
or password appears in the serialised result.

## §8. Authorization decisions

| Decision | Rationale |
| --- | --- |
| Identity from `getServerSession()` only | Verifies the cookie session with Supabase Auth (`auth.getUser()`). |
| No uid accepted from any request body | The provision route reads **no body at all**; the username route reads only `{ username }`. |
| Ownership implied, not checked | Every statement is scoped `where uid = <verified uid>`. |
| Elevated fields never written | `role`, `isVerifiedPro` keep schema defaults. |
| `unauthenticated` (401) ≠ `database_not_configured` (503) | Conflating them produces login loops for an infrastructure fault. |
| `server-only` on the orchestrator | The DB layer cannot be imported into a client bundle. |
| Demo login still provisions | It is a real Supabase session; it gets the same default profile, no more. |

Neon does not inherit Supabase RLS, so none of this is delegated. Every private
read and write is authorized in this one module.

## §9. Tests and exact results

Locally the distinction demanded by the brief — unit vs local-PG vs real-Neon —
is enforced by file:

| File | Kind | Proves |
| --- | --- | --- |
| `tests/db/provision-profile.test.ts` | **unit**, fake DB | derivation, idempotency, conflict path, no privilege escalation, bind-parameter safety |
| `tests/db/claim-username.test.ts` | **unit**, fake DB | validation, typed outcomes, statement ordering, uid scoping |
| `tests/db/identity-services.test.ts` | **unit**, mocked session + DB | auth policy, 401 vs 503 vs 400, error opacity, arity |
| `tests/db/identity-integration.test.ts` | **local PostgreSQL 18** | real constraints, real concurrency, real rollback |
| — | **real Neon** | **none executed — see §3** |

Coverage of the required scenarios:

- *Provisioning*: first-time ✓, repeated ✓, preservation of edits ✓, concurrent
  (8 simultaneous for one uid, exactly 1 `created`) ✓, unauthenticated ✓, DB
  failure ✓, no privilege escalation ✓.
- *Claiming*: valid ✓, invalid ✓, duplicate ✓, concurrent users ✓ (12 simultaneous
  attempts from 3 users at one handle → exactly 1 `claimed`, registry holds 1 row),
  other-user UUID ✓, ownership preservation ✓ (loser keeps their old handle), DB
  failure ✓, rollback mid-transaction ✓.

**Exact results (final run):**

```
tsc --noEmit -p tsconfig.json     0 errors
eslint .                          0 errors, 6 warnings (all pre-existing, untouched files)
vitest run                        23 files, 251 tests passed
test:db                           6 files passed / 1 skipped, 71 passed / 3 skipped
```

The 3 skipped tests are the Phase 2B.1.1 TLS-verification cases, which require a
dedicated TLS fixture that is not running in this session.

## §10. TypeScript / ESLint / build

- `tsc --noEmit` → **0 errors**. Six initial errors were caused by
  `strictNullChecks` being **off** in `tsconfig.json`, which prevents narrowing of
  discriminated unions on `ok`; they were resolved with explicit exported type
  guards rather than by enabling the flag repo-wide.
- `eslint .` → **0 errors**; the 6 warnings are pre-existing `react-refresh` ones
  in `src/app/layout.tsx` and `src/lib/navigation.tsx`, untouched by this phase.
- `npm run build` (Vite rollback path) → **success**.
- `npm run build:next` → **success**; `/api/profile/provision` and
  `/api/profile/username` both appear as dynamic (`ƒ`) routes.
- **Client-boundary scan:** no `drizzle-orm`, `node-postgres` or `DATABASE_URL`
  string in `dist/assets/` or `.next/static/`; none of the five modified
  client-reachable files imports `server/db`.

## §11. Regression results

- **251/251** unit tests pass — no existing behaviour regressed, including the
  Phase 1.1 auth-callback, route-access, return-path and logout suites.
- **71/71** DB tests pass.
- One transient DB failure occurred during the run and was traced to my own debug
  script leaving a stray `profiles` row behind; the 2B.2 test counts `usernames`
  unfiltered. After removal it passed. **Not a code regression**, and no test was
  weakened to make it pass.
- Live route check against `next dev` (local PG, placeholder Supabase):
  `POST /api/profile/provision` → **401**, `POST /api/profile/username` → **401**,
  and provision **with a forged `{"uid": …}` body** → **401**, with
  `profiles`/`usernames` both still at **0 rows** afterwards. A client-supplied uid
  changes nothing.

## §12. Limitations

1. **No real-Neon verification.** §3 is unexecuted for want of credentials. The
   local PG results are not a substitute and are not presented as one.
2. **Advisory locks are implemented and unexercised.** Transaction-scoped advisory
   locks exist in the driver layer from 2B.1.1, but no 2B.3 code path uses one —
   the claim relies on a unique constraint, which is strictly better for this job.
   Contention was proven at the **row** level, not the advisory-lock level.
3. **Failed-migration atomicity is unverified against Neon.** Drizzle Kit wraps a
   migration in a transaction, and the local server confirms the rollback path
   works, but a deliberately failing migration was not run.
4. **`ServerSession` exposes no display name.** It carries only
   `{ uid, email, emailConfirmedAt }`, so provisioning always derives the handle
   from the UUID (`user_<6 hex>`). Widening that contract is a follow-up and was
   deliberately not done to keep this phase contained.
5. **`ensureUserProfile` / `claimUsername` still exist** in `src/lib/users.ts`,
   deprecated and uncalled. Deleting them is safe but belongs with the read-path
   migration, when their remaining helpers can go too.
6. **The app still reads profiles through Supabase in most views.** Provisioning
   writes to Neon; `Settings.tsx` still updates `displayName`/`bio` via
   `supabase.from("profiles")`. Bringing writes onto Neon is the next phase's work,
   not this one's — moving it now would have been a broad dual-write, which the
   brief forbids.

## §13. Security concerns and remaining work

**Concerns**

- The profile write path is Neon while the profile *read* path in several views is
  Supabase (§12.6). Until they converge, a newly provisioned profile may not
  appear where a view still reads Supabase. This is the largest open consistency
  risk and it is a deliberate scope boundary, not an oversight.
- `profiles.username` is denormalised alongside `usernames.username`. The claim
  transaction updates both atomically, but any future write path must do the same
  or the two can drift.
- No rate limiting on either route. Both are idempotent, so abuse costs are low,
  but a limit belongs with the general API hardening.
- The `database_error` outcome is opaque to clients by design; operators
  therefore need server-side logging, which is currently limited to
  `console.error` in the client shim.

**Remaining work, in order**

1. Supply `DATABASE_URL` + `DIRECT_URL` and execute §3 end-to-end, including the
   advisory-lock and failed-migration checks.
2. Move profile **reads** onto Neon, then delete `ensureUserProfile` and
   `claimUsername`.
3. Decide whether `ServerSession` should expose a display name so handles can be
   human-derived.
4. Only then consider the next domain. **Not started.**

## §14. `main` unmodified — confirmation

`main` is at **`1d18864`**, its value at the start of the session. No commit,
merge, rebase or push touched it. All work is on
`arena/4f869d1b-freelancer-s-hub`; on the working branch only PR #26 was merged
into `migration/nextjs-app-router`, which is history inherited from before this
phase. **No pull request was opened or merged for Phase 2B.3.**

---

### Scope confirmation

No seed users. No migration of existing or test accounts. No new authentication
provider. No `@neondatabase/serverless`, no Neon Auth, no Better Auth. No storage
migration. No messaging. No posts, comments, votes, Spaces or Leads domains. No
UI redesign. No Supabase module rewritten and no Supabase auth removed. No
dual-write or dual-read fallback. No speculative fields. No native enums, no
`citext`. No account-deletion workflow. `pg` + `drizzle-orm` retained.
`server-only` boundary, `AuthGate` and the Vite rollback path intact.

**Phase 2B.3 stops here.**
