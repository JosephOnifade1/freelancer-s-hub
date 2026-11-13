# Phase 2B.2 — Neon Database Foundation & Identity Schema

**Status:** complete. First clean schema: `profiles` + `usernames`. No data migration,
no seed users, no other domains.
**Branch:** `arena/c9ffc9a0-freelancer-s-hub` (base `ab3de03` on `migration/nextjs-app-router`)
**Builds on:** `docs/PHASE_2A_DATABASE_ARCHITECTURE.md`, `docs/PHASE_2B_1_DRIVER_COMPATIBILITY.md`

> **Read this first.** The two things a reviewer most needs to know:
>
> 1. **Neon was not contacted.** No `DATABASE_URL` was present in this environment and no
>    Neon project exists. Every runtime result below is against a **local PostgreSQL 18.6**,
>    and every section marked "pending" is genuinely unverified. §1.
> 2. **The schema was derived from the application, not copied from the SQL dump.** Three
>    columns were corrected against real code, one dead column was dropped. §6, §7.

Legend used throughout: **[EXECUTED]** actually run · **[BUILD]** verified by
compiler/bundler · **[ASSUMED]** reasoned, not verified · **[RECOMMENDED]** proposal.

---

## 1. Real Neon verification results — **PENDING**

No Neon connection was made. Stated plainly because the alternative — reporting local
results as Neon results — is the failure mode this phase was told to avoid.

| Check | Result |
|---|---|
| Connection to a Neon database | **NOT PERFORMED** |
| Neon pooled (`-pooler`) endpoint | **NOT PERFORMED** |
| TLS handshake against Neon's certificate | **NOT PERFORMED** |
| Parameterized query on Neon | **NOT PERFORMED** |
| Transaction / rollback on Neon | **NOT PERFORMED** |
| `pg_try_advisory_xact_lock` on Neon | **NOT PERFORMED** |
| Drizzle + `pg` version compatibility on Neon | **NOT PERFORMED** *(verified locally)* |

Why: `DATABASE_URL` (and every plausible alias) was unset, there is no `.env` file in the
repository — only `.env.example` — and no Neon project was authorised or available. The
connected app in this session is Supabase, not Neon.

**This does not block the phase**, because the schema work is DDL generation and
constraint testing, which was executed against a real PostgreSQL server. But nothing here
should be read as evidence that Neon works.

Every check above is executable the moment a project exists — see §15.

---

## 2. Exact connection approach

Unchanged from 2B.1.1, and not re-litigated here:

```
DATABASE_URL ──▶ resolveConnectionSettings()  (strips TLS params, decides policy)
             ──▶ pg.Pool (max 10, application_name=borynx-next)
             ──▶ drizzle(pool, { schema })
```

`src/server/db/index.ts` now passes the schema barrel into `drizzle()` so query results are
inferred from the table definitions rather than `unknown`, and exports a `Database` type for
future feature modules. That is the only behavioural change to the connection module.

**[EXECUTED]** `driver-compatibility.test.ts` re-run against local PostgreSQL 18.6: 13/13
including transactions, rollback, advisory-lock re-entrancy and parameter binding.

---

## 3. TLS verification results

The 2B.1.1 policy is unchanged: remote hosts always verify, loopback is plaintext, and
TLS parameters are stripped from the URL so they cannot override the policy.

**[EXECUTED]** Re-verified live against a private-CA TLS server (`npm run test:db:tls`,
3/3): refused when the chain is untrusted, accepted with the CA, immune to
`sslmode=no-verify` / `ssl=no-verify` / `sslmode=disable`.

### New finding: `drizzle-kit migrate` does **not** use the application TLS policy

`drizzle-kit` builds its own `pg` connection from the URL and never calls
`resolveConnectionSettings()`. Verified against a server requiring TLS
(`hostssl ... trust` + `hostnossl ... reject`):

| Invocation | Result |
|---|---|
| `drizzle-kit migrate`, URL with **no** `sslmode` | **FAILS**, exit code **1**, with no readable error (the spinner is erased) |
| `drizzle-kit migrate`, `?sslmode=verify-full&sslrootcert=…` | **succeeds over TLS** |
| plaintext `pg` client (control) | rejected: `pg_hba.conf rejects connection … no encryption` |

Consequences, both recorded as risks:

- A migration URL **must** carry its own TLS settings. Neon issues `sslmode=require`, which
  `pg` currently treats as `verify-full`; the recommendation is to write `sslmode=verify-full`
  explicitly so the meaning does not change in `pg` 9.
- Because the failure is silent, **a failed migration must be confirmed by
  `SELECT count(*) FROM pg_tables WHERE schemaname='public'`, not by the absence of an error**
  (§10).

---

## 4. Pooling approach

Unchanged: one `pg.Pool` per process, cached on `globalThis`, `max` from
`DATABASE_POOL_MAX` (default 10), `application_name = "borynx-next"`.

**[RECOMMENDED]** for Neon production: use the pooled (`-pooler`) host in `DATABASE_URL`
and keep `max` small. **[PENDING]** — the PgBouncer interaction with Drizzle's prepared
statements is still untested, and is the specific thing to check first when a Neon project
exists (it is the one known way pooling can break a working schema).

---

## 5. Schema organization

```
src/server/db/
├── index.ts              # connection, pool, server-only guard, Database type
├── env.ts                # DATABASE_URL reading + TLS policy
├── schema/
│   ├── _shared.ts        # conventions: timestamps, auth reference, counters
│   ├── identity.ts       # profiles, usernames  ← the only domain so far
│   └── index.ts          # barrel; every domain added here
└── migrations/
    ├── 0000_identity_foundation.sql
    └── meta/{_journal.json, 0000_snapshot.json}
```

`repositories/`, `queries/`, `mutations/` are **intentionally absent**. Phase 2A §10
rejected the five-layer split as needless for a 20-table schema, and there is no second
consumer yet to justify an abstraction. Feature modules will get
`src/server/features/<domain>/<domain>.queries.ts` when they have real callers — not before.

**[BUILD]** The existing protections survive: `server-only` + `next/headers` still guard
the module; both Next bundlers still fail a Client Component import (§13).

---

## 6. Profiles schema design

`src/server/db/schema/identity.ts`. 18 columns.

### The identity contract

```
Supabase Auth user.id (uuid)
        │  no FK — different database
        ▼
profiles.uid  uuid PRIMARY KEY
        │  real FK, ON DELETE CASCADE
        ▼
usernames.uid ──▶ (and every future table)
```

`uid` is the primary key. There is **no surrogate `id`** and no mapping table: the Supabase
UUID is already durable and unique across both systems, so a local id would create two
answers to "who is this".

**No foreign key to `auth.users`** — impossible across databases, and `[BUILD]` a test
asserts the schema declares no such FK (it would silently fail if someone added one).

### Columns, and why each exists

| Column | Type | Evidence |
|---|---|---|
| `uid` | `uuid` PK | Supabase Auth UUID |
| `username` | `text` NOT NULL, unique | read in ~20 join sites; ~8 modules select it |
| `displayName` | `text` | Settings, feed, lead cards |
| `initial` | `text` | rendered in `AppLayout.tsx` and `UserHoverCard.tsx` |
| `bio` | `text` NOT NULL default `''` | Settings editor |
| `location` | `text` NOT NULL default `''` | profile display |
| `website` | `text` NOT NULL default `''` | Settings editor |
| `status` | `text` default `'Available'` | `AppLayout` "open to work" toggle |
| `skills` | `text[]` default `{}` | profile display |
| `reputation` | `integer` default 0 | leaderboard; `cast_vote` delta |
| `followers` / `following` | `integer` default 0 | follow flow counters |
| `avatarUrl` | `text` | upload flow |
| `isVerifiedPro` | `boolean` default false | badge in ~6 read paths |
| `hasSeenVeteranCelebration` | `boolean` default false | onboarding |
| `role` | `text` default `'member'` | **authorization**: `posts.ts` checks admin/moderator |
| `createdAt` | `timestamptz` default now() | — |
| `updatedAt` | `timestamptz` default now() | new; see below |

### Deliberate divergences from `supabase_schema.sql`

1. **`communitiesList jsonb` dropped.** The audit (risk R12) recorded it as dead:
   membership lives in `community_members`. Copying an unenforced duplicate into a clean
   database would import a known inconsistency. **[RECOMMENDED]** and recorded here because
   it is the one column removed without the app asking for it.
2. **`favoriteTopics` not added.** It exists only in the TypeScript `UserProfile` type and
   is never written or read. The SQL does not have it either. Adding it would be a
   speculative field.
3. **Defaults corrected.** The SQL's trigger writes `bio = 'New to Borynx!'` and
   `location = 'Earth'`; `src/lib/users.ts` writes `'New freelancer on Borynx!'`; and
   `supabase_profile_defaults_migration.sql` resets both to `''` because the app "ignores
   those two exact values". Column defaults are therefore `''`.
4. **`joined` (text year) dropped, `createdAt` kept.** `joined` duplicates a year extracted
   from `createdAt` and is stored as text, so it can disagree with the real timestamp.
   `createdAt` is the source of truth.
5. **`updatedAt` added.** No existing column tracks modification time; the settings page
   writes profile rows and nothing records when. This is a real gap, not speculation.

### Constraints

```
profiles_pkey                        uid
profiles_username_key                UNIQUE (username)
profiles_role_check                  role in ('admin','moderator','member')
profiles_status_check                status in ('Available','Busy')
profiles_username_lowercase_check    username = lower(username)
profiles_username_format_check       username ~ '^[a-z0-9_]{3,15}$'
profiles_reputation_non_negative     reputation >= 0
profiles_followers_non_negative      followers  >= 0
profiles_following_non_negative      following  >= 0
profiles_role_idx, profiles_reputation_idx
```

**[EXECUTED]** every constraint was proved to fire against a real database — see §13.

---

## 7. Username schema design

### Why a second table at all

`profiles.username` is already `UNIQUE`. The registry exists for one reason: **claiming a
handle must be atomic across two facts** — "this handle is free" and "this user now owns
it". Today `claimUsername` does check-then-write across two round trips; two concurrent
claims both see "available" and one fails *after* the UI reports success.

With `usernames` as the target, claiming is one statement whose outcome is the answer:

```sql
insert into usernames (username, uid) values ($1, $2)
on conflict (username) do nothing
returning username;      -- 1 row = claim won, 0 rows = already taken
```

**[EXECUTED]** verified: first claim returns 1 row, second (different user) returns 0.

### `citext` vs normalised lowercase — decision

**Normalised lowercase storage, with a `CHECK` that enforces it. `citext` rejected.**

- The application **already** lowercases on every write path (`claimUsername`,
  `checkUsernameAvailability`, `ensureUserProfile`, and the `handle_new_user` trigger's
  `~ '^[a-z0-9_]{3,15}$'` test), and reads case-insensitively with `ilike`. Mixed-case rows
  in the wild would already be a bug.
- `citext` hides case folding inside the type: `where username = $1` becomes
  case-insensitive everywhere, including in ways a future partial index or `ORDER BY` would
  not expect, and it needs an extension.
- A lowercase `CHECK` + ordinary `UNIQUE` gives the same guarantee, explicitly, with no
  extension and no hidden semantics. A mixed-case insert fails loudly instead of being
  silently folded.

**[ASSUMED]** The existing Supabase data contains no mixed-case handles. Nothing enforced
lowercase before (the SQL only had `unique`), so this cannot be verified without the live
database — but it is moot, since existing rows are disposable.

### Shape

```
usernames_username_pkey          PRIMARY KEY (username)
usernames_uid_key                UNIQUE (uid)             -- one handle per profile
usernames_uid_profiles_uid_fk    uid → profiles.uid ON DELETE CASCADE
usernames_username_lowercase_check
usernames_username_format_check
```

The `UNIQUE (uid)` is new: it makes "one handle per profile" a database fact. The existing
schema allows a profile to accumulate several registry rows (the trigger and
`claimUsername` both insert, and only the old row is deleted on rename).

**[EXECUTED]** cascade verified — deleting a profile releases its handle.

### Validation boundary

The regex is duplicated in exactly two places and both are asserted equal by a test:

- application: `USERNAME_RE` in `src/lib/auth.ts` (`^[a-z0-9_]{3,15}$`)
- database: `profiles_username_format_check` / `usernames_username_format_check`, built
  from the exported `USERNAME_PATTERN` constant

**[RECOMMENDED]** The application should keep validating first (for a good error message),
with the database as the backstop. The `CHECK` is not a user-facing validator — a violation
surfaces as a query error.

---

## 8. Identity relationship with Supabase Auth

Unchanged and unimplemented here. The intended flow remains:

1. Supabase Auth authenticates the user.
2. `getServerSession()` (`src/lib/server-session.ts`) returns the verified
   `{ uid, email, emailConfirmedAt }` — untouched by this phase.
3. `uid` is the key for every Neon query, including `profiles.uid`.

What this phase established:

- `profiles.uid` is the Supabase UUID, as a PK. **[BUILD]**
- No auth tables are replicated, no passwords stored, no Neon-only "users". **[BUILD]** —
  there is no `users` table at all.
- No authentication code was modified. **[EXECUTED]** `/settings` still `307`s to
  `/login?from=%2Fsettings` when unauthenticated.

**Deliberately not implemented:** the `handle_new_user` trigger. It runs inside Supabase
`auth.users` and cannot fire across databases. Its replacement is a server-side
`ON CONFLICT DO NOTHING` upsert on first authenticated request **[RECOMMENDED]** — which
also fixes the audit's "two independent profile-creation paths" problem. Profile creation is
therefore *not* yet reachable; there is no code path in this phase that inserts a profile
(§14).

---

## 9. Shared database conventions

From `schema/_shared.ts`:

| Convention | Decision |
|---|---|
| **Primary identifiers** | The Supabase UUID. Never a surrogate. `authUserReference()` for future FKs. |
| **Timestamps** | `timestamptz` only, never naive `timestamp`. Defaults `now()`. |
| **Status fields** | `text` + `CHECK`; **no `pgEnum`**. Matches the audit (zero enum types today) and keeps adding a value a one-line migration instead of an enum rewrite. |
| **Naming** | camelCase, quoted — identical to the existing columns, so the future query layer is mechanical and both schemas stay diffable. Cost: quoting in raw SQL (already the case today). |
| **Foreign keys** | Real FKs for Neon-internal relationships. None across the Supabase/Neon boundary. |
| **Deletes** | No cross-system cascade is assumed. Deleting a profile releases its Neon rows; deleting the *auth user* is a separate, coordinated step. |
| **Counters** | Denormalised counters kept (read paths depend on them) with `>= 0` checks; exact-value correctness stays the job of the transactional code ported later. |

`updatedAt` is set by the application on write, not by a trigger. A trigger would be one more
thing to port and reason about, and the write paths are already explicit. **[RECOMMENDED]**

---

## 10. Migration tooling decision

**Added `drizzle-kit@0.31.11`** as a devDependency, plus `drizzle.config.ts` and three
scripts:

| Script | Command |
|---|---|
| `npm run db:generate` | `drizzle-kit generate` |
| `npm run db:check` | `drizzle-kit check` |
| `npm run db:migrate` | `drizzle-kit migrate` |

Why required: Phase 2B.1 deliberately deferred it, but a schema without tracked migrations
is not reviewable — the phase explicitly requires migrations generated *from* the schema and
forbids schema push as a substitute.

Decisions:

- **`push` is not wired to any script.** It mutates a database with no reviewable artefact.
- **`generate` and `check` need no database.** They read the config and TypeScript only; the
  placeholder URL in `drizzle.config.ts` is never connected to.
- **Migrations are committed as SQL.** `0000_identity_foundation.sql` is 7 statements and
  readable on its own — it is the review artefact.
- **Determinism [EXECUTED]:** re-running `generate` on an unchanged schema printed
  `No schema changes, nothing to migrate` and created no second file. `check` reported
  `Everything's fine`.
- **No `drizzle-kit` for future domains** was generated. One migration exists.

---

## 11. Dependencies added or changed

| Package | Version | Type | Why |
|---|---|---|---|
| `drizzle-kit` | `^0.31.11` | devDependency | Generate/validate tracked migrations (above) |

Nothing else changed in this phase. `drizzle-orm@0.45.4`, `pg@8.23.1`, `server-only@0.0.1`
were already present from 2B.1/2B.1.1, whose changes remain uncommitted in this working tree
(see §12).

---

## 12. Files created or modified

**Created**

| File | Contents |
|---|---|
| `src/server/db/schema/_shared.ts` | Timestamp/auth-reference/counter conventions |
| `src/server/db/schema/identity.ts` | `profiles`, `usernames`, checks, indexes, types |
| `src/server/db/schema/index.ts` | Schema barrel |
| `src/server/db/migrations/0000_identity_foundation.sql` | Generated DDL (7 statements) |
| `src/server/db/migrations/meta/_journal.json`, `meta/0000_snapshot.json` | Drizzle migration metadata |
| `drizzle.config.ts` | Drizzle Kit config (generate/check/migrate) |
| `tests/db/schema-identity.test.ts` | 13 tests: 8 definition + 5 live-constraint |

**Modified**

| File | Change |
|---|---|
| `src/server/db/index.ts` | `drizzle(pool, { schema })`, `Database` type, docblock corrected |
| `package.json` | `drizzle-kit` devDependency; `db:generate`, `db:check`, `db:migrate` scripts |

**Carried in this branch from Phase 2B.1.1 (still uncommitted):** `.env.example`,
`docs/PHASE_2B_1_DRIVER_COMPATIBILITY.md`, `src/server/db/env.ts`,
`src/app/api/db-probe/route.ts`, `tests/db/driver-compatibility.test.ts`,
`tests/db/tls-verification.test.ts`, `vitest.db.config.ts`, `package-lock.json`. The 2B.2
work builds on that hardening; the two phases are in one working tree because no PR was
opened for 2B.1.1.

**Not created:** any repository/query layer, any seed or fixture file, any application route,
any edit to `src/lib/**`, any Supabase change.

---

## 13. Actual validation results

**[EXECUTED]** every row unless marked.

| Check | Command | Result |
|---|---|---|
| Canonical TypeScript | `tsc --noEmit -p tsconfig.json` | **pass**, 0 errors |
| Legacy TypeScript | `tsc --noEmit -p tsconfig.legacy.json` | **pass**, 0 errors |
| ESLint | `eslint .` | **pass**, 0 errors, 6 pre-existing warnings |
| Full Vitest | `vitest run` | **pass**, 23 files / **251 tests** |
| DB compatibility | `test:db` on local PG 18.6 | **pass**, 13/13 |
| Schema tests (no DB) | definition-only | **pass**, 8 |
| Schema tests (live DB) | against migrated schema | **pass**, 13/13 |
| TLS suite | `test:db:tls`, private-CA server | **pass**, 3/3 |
| Migration generate | `db:generate` twice | 1 file; second run: **no changes** |
| Migration drift check | `db:check` | **Everything's fine** |
| Migration apply (raw SQL) | 7 statements in one transaction | **applied** |
| Migration apply (`drizzle-kit migrate`) | local PG | **applied**, tables present |
| Next build (Turbopack) | `next build --turbopack` | **pass** |
| Next build (webpack) | `next build --webpack` | **pass** |
| Vite rollback build | `vite build` | **pass** |
| Boundary — Turbopack | probe in `src/app/` | **fails as designed** (`next/headers`) |
| Client bundle scan | `.next/static` + `dist` | **0** for `DATABASE_URL`, `server-only`, `pg-pool`, `drizzle`, `postgres://` |

### Constraint proof (against real PostgreSQL 18.6)

Every rule was executed, not assumed:

```
OK        valid profile
OK        valid handle claim
REJECTED  'Bob', 'aBc', 'ab', 16 chars, 'a-b'   → profiles_username_format_check
REJECTED  duplicate username                    → profiles_username_key
REJECTED  role 'owner'                          → profiles_role_check
REJECTED  status 'Vacation'                     → profiles_status_check
REJECTED  reputation -1                         → profiles_reputation_non_negative
REJECTED  duplicate uid                         → profiles_pkey
REJECTED  second handle for same uid            → usernames_uid_key
REJECTED  already-taken handle                  → usernames_pkey
REJECTED  handle for nonexistent profile        → usernames_uid_profiles_uid_fk
claim #1 → 1 row (won) · claim #2 → 0 rows (taken)
handles after profile delete → 0 (cascade works)
```

### Client bundle — the one result that needed a second look

`profiles` and `usernames` **do** appear in the client bundles (17 and 5 files). Inspected
rather than assumed:

```
…await a.N.from("profiles").select("*").eq("uid",t).maybeSingle()…
…await a.N.from("usernames").select("username").eq("username",o)…
```

These are the **pre-existing Supabase client calls** in `src/lib/users.ts`. No Drizzle code,
no SQL, no credential, and no schema definition reaches the browser. The distinction matters
because a naive "zero occurrences" assertion would have been wrong, and a naive "it's in the
bundle, ship it" reading would have been worse.

**[EXECUTED]** No application tables exist anywhere except the two test databases used for
this validation, both of which were local and have been shut down.

---

## 14. What was intentionally not implemented

- **No Neon connection.** §1.
- **No profile creation path.** The `handle_new_user` trigger's replacement is a server-side
  upsert in a later phase. Nothing in this phase inserts a profile.
- **No repository/query layer.** No callers exist yet; Phase 2A §10 advised against the
  abstraction.
- **No seed users.** Explicitly deferred. §16 describes the shape they must take.
- **No other domains** — no posts, comments, votes, communities, leads, applications,
  notifications, moderation, messages. `usernames` is the only non-profile table, and it is
  part of the identity schema, not a new domain.
- **No data migration, backfill, dual-read or dual-write.**
- **No application query rewritten to Neon.** `src/lib/**` is untouched; the app still reads
  Supabase.
- **No auth, storage or UI change.** Supabase Auth and Storage are untouched.
- **No `pgEnum`, no `citext`, no triggers.**
- **No `communitiesList`** (dropped, §6) and **no MFA/admin/verification tables** — those
  belong to domains that have not been designed.

---

## 15. Remaining risks

| # | Risk | Severity | Note |
|---|---|---|---|
| N1 | **Neon unverified** | **High** | Blocks confidence, not the schema. Run §1's checklist first. |
| N2 | **Pooler + prepared statements** | **Medium** | The known way a working schema breaks in production. Test on the pooled host before load. |
| N3 | **`drizzle-kit migrate` ignores the app TLS policy** | **Medium** | §3. Needs `sslmode=verify-full` in the migration URL; failure is silent with exit 1. |
| N4 | `drizzle-kit` version coupling | Low | 0.31.x targets `drizzle-orm` 0.45.x. Pin both together. |
| N5 | Profile creation not implemented | **Medium (functional)** | Nothing can create a profile yet; the account lifecycle is the next real step. |
| N6 | Handle claim is atomic but not yet *used* | Medium | The `ON CONFLICT` pattern is proven, not wired into a mutation. |
| N7 | `status` check is narrow (`Available`/`Busy`) | Low | Matches the UI today. A third value is a one-line migration; the audit notes status values are still evolving. |
| N8 | `updatedAt` not auto-maintained | Low | Application must set it; no trigger, by choice. |
| N9 | Mixed-case legacy handles | Low | Moot: existing data is disposable. |
| N10 | Two phases uncommitted in one tree | Low (process) | 2B.1.1 + 2B.2 will land together unless split. |

---

## 16. Recommended Phase 2B.3 scope

**Recommendation: profiles + usernames are live in code but unusable; close that gap before
adding a second domain.**

1. **Neon verification** (retire N1/N2) — create the dev project, run §1's list, confirm the
   pooled host, then apply `0000_identity_foundation.sql` to it.
2. **Profile provisioning service** — the `handle_new_user` replacement: a server-side
   `ensureProfile(uid, metadata)` doing
   `insert … on conflict (uid) do nothing`, deriving a candidate handle and claiming it via
   the proven `ON CONFLICT` path. Plus `claimUsername` as a single transaction.
3. **Seed users** (separately approved) — Supabase Auth users first, then matching Neon
   profiles keyed on the real UUID, idempotent and environment-gated. **Never** Neon-only
   rows presented as users.
4. **Account lifecycle** — the deferred deletion workflow from 2B.1.1 §14: Neon soft-delete →
   purge → `auth.admin.deleteUser`, ordered so partial failure is recoverable.
5. **Then** the first real domain — `communities` + `community_members`, since posts depend
   on both and it exercises the first multi-table FK graph.

**Do not** start with posts. The audit's build order puts communities before posts for a
reason: post visibility depends on membership.

---

## Appendix — reproducing the schema validation

```bash
# 1. Generate / validate migrations (no database needed)
npm run db:generate
npm run db:check

# 2. Apply to an empty PostgreSQL
DATABASE_URL="postgres://user:pass@127.0.0.1:5432/borynx?sslmode=verify-full" \
  npm run db:migrate
#    Verify it actually applied — the failure mode is silent (risk N3):
#    psql -c "select tablename from pg_tables where schemaname='public'"

# 3. Prove the constraints
DATABASE_URL="postgres://…/borynx" npm run test:db

# 4. Prove TLS
DATABASE_TLS_TEST_URL=… DATABASE_TLS_TEST_CA=… npm run test:db:tls
```
