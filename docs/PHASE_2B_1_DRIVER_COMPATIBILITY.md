# Phase 2B.1 — Neon + Drizzle Driver Compatibility Spike

**Status:** complete. Infrastructure proof only — no application schema, no migrations, no data.
**Branch:** `arena/5aa6a3c8-freelancer-s-hub` (base `540812b` on `migration/nextjs-app-router`)
**Date:** 2026-11-12
**Follows:** `docs/PHASE_2A_DATABASE_ARCHITECTURE.md`

> **Scope boundary.** This phase answers one question: *which Neon + Drizzle connection
> stack is compatible with this repository, and can it support the atomic behaviour Borynx
> already depends on?* It does not design the schema. The 20-table schema, the `cast_vote`
> RPC and the visibility rules remain Phase 2B.2 work.

---

## 1. Driver options evaluated

Four candidates, each compiled against this repository's real `tsconfig.json`
(`module: esnext`, `moduleResolution: bundler`, `strict: false`) and, where applicable,
run against a live database.

| # | Driver | Package | Transactions | Verdict |
|---|--------|---------|--------------|---------|
| A | `drizzle-orm/neon-http` | `@neondatabase/serverless` | **None** | Rejected |
| B | `drizzle-orm/neon-serverless` (WebSocket) | `@neondatabase/serverless` | Yes | Viable fallback |
| C | `drizzle-orm/node-postgres` | `pg` | Yes | **Selected** |
| D | `drizzle-orm/postgres-js` | `postgres` | Yes | Rejected |

### A — `neon-http`: rejected on a hard requirement

Type-checks cleanly, including `db.transaction(...)`. Runtime behaviour:

```
$ node neonhttp-tx.mjs
runtime throw: No transactions support in neon-http driver
```

The source is unambiguous (`drizzle-orm/neon-http/session.js`):

```js
async transaction(_transaction, _config = {}) {
  throw new Error("No transactions support in neon-http driver");
}
```

This matters more than it looks. `pg_advisory_xact_lock` — the mechanism `cast_vote` uses
to serialise concurrent votes — is **transaction-scoped**: outside a transaction it is
either illegal or immediately released, so it provides no mutual exclusion at all. The
`FOR UPDATE` row locks in `cast_vote` are likewise only held for a transaction's lifetime.
On `neon-http` the vote path would silently lose its atomicity guarantee, which is exactly
the class of change Phase 2A told us to prevent (audit §5, R1-adjacent).

Note the failure mode: it **type-checks**. A `neon-http` implementation would pass `tsc`,
pass review, and only fail in production under concurrent writes. That is why this was
tested by execution rather than by reading types.

`neon-http` remains a legitimate read-only path (`db.batch()` runs some statements in one
implicit transaction), but using two drivers would mean two connection paths and two
failure modes for a 20-table app. Not worth it.

### B — `neon-serverless` (WebSocket): viable, not needed

Correct API for serverless Postgres, fully transactional, and it type-checks in this repo.
Costs: requires a `ws` implementation in Node (bundled in v1.x, but a real dependency to
justify), and it is designed for edge/HTTP-only runtimes. This app runs on **Node**
(`next start`, `pg` available), and the audit found no edge-runtime routes. It stays the
documented fallback if the app ever moves request handling to the edge — see §15.

Also worth recording: `drizzle-orm/neon` is **no longer the WebSocket driver**. It now
exports only `neon-auth` and `rls` helpers:

```
$ ls node_modules/drizzle-orm/neon/index.d.ts
export * from "./neon-auth.js";
export * from "./rls.js";
```

Importing `{ drizzle } from "drizzle-orm/neon"` fails with
`TS2305: Module '"drizzle-orm/neon"' has no exported member 'drizzle'`. Anyone following
older documentation will hit this.

### C — `node-postgres` (`pg`): selected

- Full interactive transactions, verified live (§6).
- `pg_advisory_xact_lock` behaves exactly as `cast_vote` needs (§6).
- Works on Node 22.22.3; `pg` 8.23.1 ships a native ESM entry (`node_modules/pg/esm/index.mjs`)
  and declares `engines.node >= 16`.
- Standard `pool.query` path, so `EXPLAIN`, `pg_stat_activity` and lock debugging all work
  normally.
- No edge support — acceptable, since nothing in this repo is edge-deployed.

### D — `postgres` (postgres.js): rejected

It supports transactions and would work, but it brings no capability `pg` lacks here, adds
a **third** Postgres client to a dependency tree that will already carry
`@supabase/supabase-js`, and its tagged-template API overlaps `drizzle-orm`'s. Adding it
would be dependency breadth for no technical gain. Per the phase instruction, no compelling
reason existed.

### TypeScript compatibility — Phase 2A risk R9 does **not** reproduce

The audit recorded that `drizzle(pool)` was expected to fail with
`TS2345: … distinct types` under `moduleResolution: "bundler"`, and made it a day-1 blocker.
Tested directly, in three configurations:

| Configuration | Result |
|---|---|
| `tsc` with `moduleResolution: bundler` on a bare `drizzle(new Pool(...))` | **0 errors** |
| Same file under the full canonical `tsconfig.json` | **0 errors** |
| `drizzle-orm/node-postgres`, `/neon-http`, `/neon-serverless` all together | **0 errors** |

**R9 is therefore closed as "did not reproduce".** Both `drizzle-orm` 0.45.4 and `pg` 8.23.1
resolve to the same `@types/pg`, and drizzle ships `.d.ts`/`.d.cts` under proper `exports`
conditions, so the duplicate-typing situation that prompted the risk is not present.
`moduleResolution` does not need to change — which matters, because changing it repo-wide
would have been invasive.

---

## 2. Recommended driver and reasons

**`drizzle-orm/node-postgres` over a module-scoped `pg` Pool.**

1. **Atomicity is the deciding factor, not popularity.** `cast_vote` needs row locks plus a
   transaction-scoped advisory lock; only a real interactive transaction provides those.
   This alone eliminates `neon-http`.
2. **It matches the deployment target.** The app builds and runs on Node. `pg` is the
   native, first-class choice there.
3. **Fallback cost.** `neon-http` would need two drivers (one for reads, one for
   transactions). `pg` covers reads and writes with one.
4. **Debuggability.** Standard Postgres tooling (`pg_stat_activity` lock waits) applies,
   which the advisory lock in `cast_vote` makes operationally relevant.
5. **Documented fallback.** If the app later moves to edge runtimes, `neon-serverless`
   swaps in against the same Drizzle schema with no query changes.

`@neondatabase/serverless` is installed but **not imported** by application code. It is
present only so the fallback and the driver comparison remain reproducible.

---

## 3. Exact dependency versions and changes

Resolved and installed:

| Package | Version | Type | Why |
|---|---|---|---|
| `drizzle-orm` | 0.45.4 | `dependencies` | The ORM / query builder |
| `pg` | 8.23.1 | `dependencies` | Postgres client for `node-postgres` driver |
| `@neondatabase/serverless` | 1.2.0 | `dependencies` | Evaluated + documented fallback; not imported by app code |
| `@types/pg` | 8.23.1 | `devDependencies` | Types for `pg` |

`package.json` additions, beyond those four entries:

```json
"test:db": "vitest run --config vitest.db.config.ts"
```

No existing dependency was removed or upgraded. No Supabase dependency was touched.
`drizzle-kit` was **not** installed: it exists to generate and apply migrations, and
generating migrations is explicitly out of scope for this phase. It belongs in 2B.2.

`npm ci` from a clean tree resolves 16 new packages; `package-lock.json` +304/−2.

---

## 4. TypeScript compatibility findings

- Canonical `npx tsc --noEmit -p tsconfig.json` → **0 errors**.
- Legacy `npx tsc --noEmit -p tsconfig.legacy.json` → **0 errors** without modification.

The legacy config excludes `src/app`, `src/lib/server-session.ts`,
`src/lib/supabase-server.ts` and `src/proxy.ts` — and now also never reaches
`src/server/db/**`, because it type-checks only what `src/main.tsx` (the Vite entry)
imports. `src/server/db` imports `next/headers`, which the legacy shim does not provide; it
is unreachable from the Vite graph, so no exclusion entry was needed. Verified rather than
assumed: `typecheck:legacy` passes with the new code present.

One deliberate typing note: `getDatabase()` returns
`ReturnType<typeof drizzle>` rather than a hand-written `NodePgDatabase<typeof schema>`,
because **there is no schema yet**. In 2B.2 this should become
`NodePgDatabase<typeof schema>` as tables arrive, so query results are inferred.

---

## 5. Connection and pooling approach

`src/server/db/index.ts`:

- **One `Pool` per process**, cached on `globalThis.__borynxPool`. Next's dev-mode module
  reloading re-evaluates modules on every hot reload; without the cache each edit would leak
  a pool and eventually exhaust `max_connections`.
- `max` from `DATABASE_POOL_MAX` (default **10**). Serverless platforms multiply
  connections by concurrent instances, so a small ceiling plus Neon's pooled (`-pooler`)
  endpoint is the correct combination — PgBouncer multiplexes, and the Node pool stays small.
- `idleTimeoutMillis: 30_000`, `connectionTimeoutMillis: 10_000`.
- `application_name: "borynx-next"` so Borynx's connections are identifiable in
  `pg_stat_activity` — directly useful when diagnosing lock waits caused by the advisory
  lock in `cast_vote`.
- A `pool.on("error")` handler: `pg` emits idle-client errors asynchronously, and without a
  listener they would crash the process.

TLS is derived, not hardcoded (`databaseSslConfig` in `src/server/db/env.ts`): loopback
hosts connect without TLS, remote hosts use TLS with `rejectUnauthorized: false`
(Neon's cert does not chain to a Node root CA in every environment), and an explicit
`sslmode` in the URL wins — including `verify-full`, which sets
`rejectUnauthorized: true`.

---

## 6. Transaction support and limitations

**Supported and verified live** against PostgreSQL 18.6:

| Capability | Verified | Evidence |
|---|---|---|
| Interactive transaction | yes | a non-null `pg_current_xact_id_if_assigned()` inside `db.transaction()` |
| Rollback on throw | yes | insert + read-back inside the transaction, then rollback; table left empty |
| `pg_try_advisory_xact_lock` acquired | yes | returns `true` |
| Advisory lock re-entrant in same transaction | yes | second acquire also `true` (required: `cast_vote` may take it twice on a retry path) |
| Advisory lock auto-released at transaction end | yes | a later transaction acquires it again |
| Parameterized queries | yes | see §7 |

Limitation, documented rather than hidden: **a Drizzle `db.transaction()` callback must not
perform network I/O.** The connection is held for its duration, so an `await fetch(...)`
inside a transaction turns a 5 ms lock into a multi-second one. This is the discipline the
`cast_vote` port must follow — it is pure SQL today, and should stay that way.

Second limitation: `neon-http` exposes `db.transaction()` in its **types** but throws at
runtime (§1). Anything that later adds a second driver must not rely on the type.

---

## 7. Parameterized query proof

`echoParameterized(value)` runs:

```ts
sql`select ${value}::text as echoed, (select count(*) from pg_class) as rel_count`
```

Drizzle's tagged template binds every non-`sql.raw` interpolation as `$1`. Verified with a
hostile payload:

```
input:  "'; drop table profiles; --"
output: "'; drop table profiles; --"     (returned verbatim, not executed)
```

Live HTTP response:

```json
"parameterizedQuery": { "roundTrip": true, "injectionReturnedLiterally": true }
```

`pg_catalog` still contained zero non-system tables after the run (§11), confirming
nothing was created and nothing was dropped.

---

## 8. Server-only boundary verification

**Mechanism:** `src/server/db/index.ts` imports `{ cookies } from "next/headers"`. That
module only resolves in a server compilation target, so the driver — and `DATABASE_URL` —
cannot be bundled for the browser. No new `server-only` package was added; it is not a
dependency of this repo, and this mirrors the guard `src/lib/supabase-server.ts` already
uses (documented there for the same reason).

**Positive proof** — a Client Component importing the module breaks the build:

```
$ cp tests/boundary/boundary-probe.page.tsx src/app/boundary-probe/page.tsx
$ npx next build --turbopack
> Build error occurred
Error: You're importing a module that depends on "next/headers". This API is only
available in Server Components in the App Router, but you are using it in the Pages Router.

Import traces:
  Client Component Browser:
    ./src/server/db/index.ts [Client Component Browser]
    ./src/app/boundary-probe/page.tsx [Client Component Browser]
```

With the probe removed, the same build passes (§10). The probe file lives at
`tests/boundary/boundary-probe.page.tsx` — outside `src/app/` — so the repo still builds;
an intentionally broken route would be a trap.

Two findings worth keeping, because they are not obvious:

1. **`import "next/headers"` (side-effect only) does not work.** Turbopack rejects it in an
   *App Route* too, with the same "Pages Router" message — it seems to treat a bare
   specifier import differently from a named import. A **named** import
   (`import { cookies } from "next/headers"`) works in route handlers and Server
   Components, and still fails a Client Component. This is why `isRequestScoped()` exists
   in the module: it makes the named import genuinely used instead of dead code.
2. **A `__`-prefixed folder is a private folder.** `src/app/__boundary_probe/` is excluded
   from routing, so it never compiles and the boundary appears untested. The probe must sit
   at a normally-named path to enter the graph.

---

## 9. Client bundle security verification

After production builds, both output trees were scanned for driver internals and
credential markers:

| Marker | `.next/static` (Next client chunks) | `dist` (Vite rollback) |
|---|---|---|
| `DATABASE_URL` | 0 files | 0 files |
| `pg-pool` | 0 files | 0 files |
| `neondatabase` | 0 files | 0 files |
| `drizzle-orm` | 0 files | 0 files |
| `postgres://` | 0 files | 0 files |
| `borynx-next` (`application_name`) | 0 files | 0 files |

Additional checks:

- **No `NEXT_PUBLIC_` database variable exists.** A unit test asserts that no environment
  key starting with `NEXT_PUBLIC_` matches `/DATABASE|NEON|PG/i`.
- **`.env.example` documents the variable as server-only**, with an explicit warning not to
  prefix it.
- **Error responses redact connection strings.** With a deliberately unreachable database
  (`postgres://user:supersecretpassword@127.0.0.1:59999/nope`), the route returned:
  ```json
  { "status": "error", "message": "Error", "detail": "connect ECONNREFUSED 127.0.0.1:59999" }
  ```
  The password does not appear anywhere in the response (grepped: 0 matches). Only the
  message string is surfaced, never a stack, and a
  `postgres(ql)://…` → `[redacted]` filter runs as a second line of defence.

The probe route additionally returns **404 when `NODE_ENV=production`**, verified against a
real `next start` server. A diagnostic endpoint that performs database round-trips should
not be publicly reachable.

---

## 10. Build and test results

All commands run in this repository, in this session.

| Check | Command | Result |
|---|---|---|
| TypeScript (canonical) | `npx tsc --noEmit -p tsconfig.json` | **pass**, 0 errors |
| TypeScript (legacy / Vite) | `npx tsc --noEmit -p tsconfig.legacy.json` | **pass**, 0 errors |
| ESLint | `npx eslint .` | **pass**, 0 errors, 6 warnings (all pre-existing, unchanged) |
| Vitest (default) | `npx vitest run` | **pass**, 23 files / 251 tests |
| Vitest (DB proof) | `npm run test:db` with `DATABASE_URL` | **pass**, 8/8 |
| Vitest (DB proof, unconfigured) | `npm run test:db` without `DATABASE_URL` | **pass**, 3 passed / 5 skipped (by design) |
| Next build (Turbopack) | `npx next build --turbopack` | **pass**, `/api/db-probe` registered as `ƒ` |
| Next build (webpack) | `npx next build --webpack` | **pass** |
| Vite rollback build | `npx vite build` | **pass** (9.99 s) |
| Boundary proof | probe in `src/app/` → `next build` | **fails as designed**, `next/headers` error |
| Boundary proof (control) | probe removed → `next build` | **pass** |

### Live runtime verification

A real PostgreSQL 18.6 instance was started locally (embedded binaries, loopback only, no
credentials of any kind). Three server configurations were exercised:

**(a) Configured, reachable** — `next dev` on :3101, real database:

```json
{
  "status": "ok",
  "databaseConfigured": true,
  "driver": "drizzle-orm/node-postgres + pg Pool",
  "roundTripMs": 37,
  "server": { "version": "18.6", "database": "postgres", "currentUser": "borynx", "maxConnections": 100 },
  "parameterizedQuery": { "roundTrip": true, "injectionReturnedLiterally": true },
  "transaction": { "supported": true, "rolledBack": true },
  "advisoryLock": { "acquired": true, "reentrant": true },
  "identity": { "supabaseAuthConfigured": true, "authUidPresent": false }
}
```

`authUidPresent: false` is correct and expected: no Supabase session cookie was sent. It
proves the route reports the identity boundary honestly rather than fabricating one.

**(b) Unconfigured** — no `DATABASE_URL`, :3102 → **HTTP 503**

```json
{ "status": "not_configured", "databaseConfigured": false, "supabaseAuthConfigured": true }
```

**(c) Misconfigured** — unreachable host, :3103 → **HTTP 500**, credential redacted (§9).

Production guard: `next start` on :3100 → `GET /api/db-probe` returned **404**.

Auth behaviour unchanged, same server: `GET /settings` → **307** to
`/login?from=%2Fsettings`; `GET /` → 200; `GET /login` → 200.

---

## 11. Neon credential / connectivity limitations — what was and was not tested

Stated plainly, because the distinction is the point of this section.

**Verified at runtime:** the Drizzle `node-postgres` stack against **PostgreSQL 18.6**
(local, embedded binary). Transactions, rollback, advisory locks, parameter binding, pool
behaviour and error paths all executed against a real server.

**NOT verified — no Neon project, credentials or network access was available:**

- A connection to an actual **Neon** endpoint (§13 explains why this is low-risk).
- **Neon-specific** behaviour: `-pooler` / PgBouncer interaction with Drizzle prepared
  statements; whether PgBouncer transaction mode breaks anything in the eventual
  `cast_vote` port (it should not — the function is a single `SELECT`, but it must be
  confirmed); Neon cold-start wake-up latency after idle.
- **TLS against Neon's certificate**, including the `rejectUnauthorized: false` choice.
- **Cross-region latency** between Supabase Auth and the Neon compute.
- Postgres **version parity**: the target Neon version was never observed. Postgres 18 was
  used locally; Neon commonly runs 16/17. Nothing in this phase's code is version-sensitive,
  but `pg_current_xact_id_if_assigned()` (used only by the probe) requires ≥ 13, and any
  18-only syntax added later would need care.

**No production database was contacted. No Supabase project was contacted. No credentials
were created, read, or stored.** The local instance was reachable only on loopback and has
been stopped.

Verification that nothing was persisted: after every run, the local database contained
**0 non-system tables and 0 user-defined types in `public`** — the compatibility proof
creates no application tables.

---

## 12. Supabase Auth identity compatibility

Unchanged, as required. The intended chain is now demonstrable end to end:

```
Supabase Auth  →  supabase.auth.getUser()  →  getServerSession().uid  →  Neon profiles.uid
   (IdP)              (verified JWT)              (single server helper)      (external id)
```

- `getServerSession()` in `src/lib/server-session.ts` is untouched and remains the **only**
  source of server identity. It still returns exactly `{ uid, email, emailConfirmedAt }`
  and still reads no application data.
- The probe route imports it and reports `authUidPresent: boolean` — never the email, never
  the UUID itself. This is the shape Phase 2B.2 will use: resolve identity from Supabase,
  then key Neon reads on `uid`.
- **No second identity helper was introduced.** No new session mechanism, no JWT parsing in
  application code, no localStorage reading.
- No authentication code was modified, and `next build` output shows the same protected
  routes as before (`ƒ /settings`, `ƒ Proxy`).

The `neon-auth`/`rls` helpers that ship with Drizzle were **not** adopted. They target
Neon's own auth (`auth.user_id()`), which is not the identity provider here. Using them
would be the "new identity system without a documented reason" the audit forbade.

---

## 13. Future seed-user strategy

No seed users were created in this phase — that is 2B.2 work. The constraints that will
govern them:

1. **A login-capable seed user needs two records:** a real Supabase Auth user, and a Neon
   `profiles` row whose `uid` equals that auth user's UUID. Creating only a Neon row
   produces an orphan that no one can authenticate as — it must never be presented as an
   application user.
2. **Seeding must not invent UUIDs.** The UUID comes from Supabase Auth at creation time,
   then is copied into Neon. Deterministic UUIDs (`seed-user-1`) would silently violate the
   identity contract.
3. **Seed data should be re-runnable.** Prefer an idempotent script keyed on the auth UUID
   over a raw `INSERT` dump, so a partially-seeded environment can be repaired.
4. **Seed users must be clearly marked and environment-gated** — never run against a
   production project, and never on a database whose `DATABASE_URL` points at production.
5. **The 20-table FK graph means insertion order matters** (phase 2A §14): profiles and
   usernames first, then communities and memberships, then posts, comments, votes, leads and
   applications. A single flat fixture file will fail on FK constraints.

Existing test accounts are disposable and will not be migrated; a clean Neon database with
fresh seed users is the plan.

---

## 14. Account creation / deletion architecture recommendation

**Nothing implemented.** This is the recommended shape for a later phase.

The core constraint: **PostgreSQL foreign keys cannot cascade across two databases.**
`profiles.uid` references a Supabase Auth UUID that Neon cannot enforce with an FK, and
`auth.users` cannot cascade into Neon. Two-phase commits are not available. So account
deletion is inherently a **distributed transaction** and must be designed as one.

### Deletion: Neon first, Supabase Auth last

Order matters. Deleting the auth user first would orphan every Neon row with no way to
identify them (the UUID would be gone from the authoritative source).

```
1. Authorize       requireServerSession() → target uid; self, or admin.
2. Mark            Neon: set profiles.deleted_at = now() (soft delete), in a transaction.
                   Immediately blocks login-completion paths and hides the profile.
3. Purge domain    Neon, one transaction per aggregate: posts → comments → votes,
                   memberships, leads/applications, notifications, badges.
                   Relies on ON DELETE CASCADE from profiles.uid within Neon only.
4. Delete profile  Neon: delete profiles row (CASCADEs the remainder).
5. Delete auth     Supabase admin API: deleteUser(uid) — service-role key, server only.
6. Verify          Re-read both stores; confirm absence.
```

Steps 2–4 are one idempotent operation: re-running after a failure finds a soft-deleted
profile and continues. Step 5 is naturally idempotent (deleting an absent auth user is a
success, or a 404 treated as success).

### Recovery from partial failure

The dangerous state is **4 done, 5 not done**: an auth user exists with no profile. Detect
it by comparing `auth.users` ids against `profiles.uid` (a reconciliation query, not an FK),
and resolve it by re-running step 5. The reverse (**5 done, 4 not done**) cannot normally
occur given this ordering — which is exactly why the order is this way. If it ever does, the
Neon rows are unreachable-garbage: safe to purge, and identifiable because they carry
`deleted_at`.

Every step must be recorded (a `account_deletion_log` table, or structured logs keyed on
`uid`) so a retry knows where it stopped — and a **tombstone row** for step 4→5 is worth
considering, since it is the only way to remember a uid after its profile is gone.

### Creation

Simpler, and naturally recoverable: **Supabase Auth first, Neon second.**

1. Supabase Auth creates the user (signup, or admin create for seeds).
2. Confirm the email / complete signup.
3. On first authenticated server request, **upsert** the Neon profile keyed on `uid` —
   `insert … on conflict (uid) do nothing` for `profiles` and `usernames`.
4. Backfill derived rows (reputation, defaults) in the same transaction.

A failure between 1 and 3 leaves a valid auth user with no profile, which the next request
repairs automatically. That is why "create the Neon profile lazily on first authenticated
request" beats "create it in the signup handler": the signup handler can fail after the auth
user exists, whereas the lazy path is self-healing. This replaces the current
`handle_new_user` trigger, which cannot fire across databases.

### Invariants to enforce

- The only durable identifier is the Supabase Auth UUID. Never generate a Neon-only id.
- Deletion and creation must both be safe to run **twice**.
- No step may assume the other database is reachable; each must fail cleanly and resume.
- Account deletion is server-controlled only — never client-initiated by uid alone.

---

## 15. Remaining risks and blockers

| # | Risk | Severity | Note |
|---|------|----------|------|
| S1 | No Neon project exists yet; `-pooler` + prepared-statement interaction unverified | **Medium** | Blocker for 2B.2 load testing, not for schema work. Test with a real endpoint before committing to pooled URLs. |
| S2 | PgBouncer transaction mode vs. the eventual `cast_vote` port | **Medium** | Function is a single `SELECT`, so likely fine; must be confirmed, not assumed. A pooled connection returns to the pool between transactions — session-level `SET` does not survive, so the port must not rely on session state. |
| S3 | `neon-http` fails at runtime but type-checks | **Low now, high if forgotten** | Guard: one driver, one import site (`src/server/db/index.ts`). Recorded here so it is not rediscovered in production. |
| S4 | Drizzle transactions hold a connection — network I/O or slow work inside one causes contention | **Medium** | Discipline issue for 2B.2. Keep transactions to pure SQL. |
| S5 | `getDatabase()` return type is untyped until a schema exists | **Low** | Resolve in 2B.2 by parameterising with `typeof schema`; do not export an untyped `db` to feature code. |
| S6 | `drizzle-kit` not installed; migration workflow unproven | **Low** | Deliberate. Phase 2B.2 decision. Audit §12 recommends SQL-first migrations, which `drizzle-kit generate` supports via `--custom`. |
| S7 | No automated run of `test:db` in CI | **Medium** | It needs a database; the default suite stays hermetic by design. A CI service container (or Neon branch) should run it — decide in 2B.2. |
| S8 | The probe route lives in the app tree | **Low** | It is production-404'd and development-only, but it is still a route that performs DB work. Consider removing it once 2B.2 has real queries to verify against. |
| S9 | Postgres version parity (18 local vs. Neon 16/17) | **Low** | Phase 2B.1 code is not version-sensitive. Relevant once 2B.2 writes DDL. |
| S10 | Two runtimes' ESM/CJS interop for `pg` | **Low** | `pg` 8.23.1 ships native ESM; `drizzle-orm` has correct `exports` conditions. Verified under Turbopack, webpack and Vite. |

No blocker prevents starting Phase 2B.2 schema work. **S1 is the only item that should be
retired before load-testing anything**, and it requires a Neon project — which this phase was
not authorized to create.

---

## 16. Recommendation for the next implementation phase

**Proceed to Phase 2B.2 (schema design), with `drizzle-orm/node-postgres` + `pg` Pool, and
provision a Neon project first.**

Suggested order for 2B.2, so that each step is verifiable on its own:

1. **Retire S1/S2** — create the Neon dev project, run `npm run test:db` against the real
   endpoint (pooled *and* direct host), confirm TLS and `pg_advisory_xact_lock`. Small, and
   it de-risks everything after it.
2. **Install `drizzle-kit`** and settle the migration workflow (audit §12 recommends
   SQL-first: DDL in reviewed `.sql` files, Drizzle schema as the typed mirror). Do not
   auto-generate 20 tables in one shot.
3. **`profiles` + `usernames`** — establish `uid` as the PK, the external-identity contract,
   and the `NodePgDatabase<typeof schema>` typing pattern other modules copy.
4. **Enums as `text` + `CHECK`**, matching the audit: no `pgEnum`. This keeps the Phase 2A
   inventory faithful and avoids type-migration pain later.
5. **`can_view_post` as SQL**, plus its test matrix *before* posts exist — it gates six
   tables, and a single missing `where` leaks private content (audit R1, critical).
6. **Then** communities → posts → comments → votes (`cast_vote` ported verbatim as SQL) →
   leads/applications/pipeline → notifications → reports → badges → attachments.

Two standing rules for 2B.2, carried from the audit and unchanged:

- **`cast_vote` stays SQL.** Do not re-express the advisory lock, row locks and counter
  deltas in TypeScript.
- **`toggleFollow` and `joinCommunity`/`leaveCommunity` must not be ported as-is.** They
  are already non-atomic (5 and 2–3 round trips respectively, with `leaveCommunity`
  swallowing its decrement error). Port them as single transactions.

---

## Appendix — files added/changed in this phase

**Added**

| File | Purpose |
|---|---|
| `src/server/db/env.ts` | `DATABASE_URL` reading, configuration predicate, TLS derivation |
| `src/server/db/index.ts` | Pool + Drizzle client, server-only guard, probe/transaction/advisory-lock proofs |
| `src/app/api/db-probe/route.ts` | Development-only verification endpoint (404 in production) |
| `tests/db/driver-compatibility.test.ts` | Runtime proof, 8 tests |
| `tests/boundary/boundary-probe.page.tsx` | Deliberately-broken Client Component for the boundary proof |
| `vitest.db.config.ts` | Node-environment Vitest config, separated from the hermetic suite |
| `docs/PHASE_2B_1_DRIVER_COMPATIBILITY.md` | This document |
| `docs/PHASE_2A_DATABASE_ARCHITECTURE.md` | Phase 2A deliverable, committed with this work |

**Changed**

| File | Change |
|---|---|
| `package.json` | +4 dependencies, +1 devDependency, +`test:db` script |
| `package-lock.json` | Resolved additions (+304/−2) |
| `.env.example` | Documented `DATABASE_URL` / `DATABASE_POOL_MAX` as server-only |

**Not changed:** no application table, no migration, no query rewrite, no auth change, no UI
change, no Supabase dependency removal, no `main` commit, no `tsconfig` change.
