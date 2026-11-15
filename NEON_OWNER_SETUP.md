# Use your existing Neon database with the development tools

This guide supersedes earlier handoff statements that owner data tools only accept
loopback PostgreSQL. You do NOT need another database, Neon branch, Docker, or a
renamed database. Use your existing Neon database only if you intentionally accept
that the reset below deletes its Borynx application/auth data. Do not share secrets.

## What changed

- Existing local targets remain supported with their original designation rules.
- Hosted tools require `BORYNX_DEV_DATABASE_TARGET=neon`,
  `BORYNX_ALLOW_NEON_DEV_DATA=true`, `BORYNX_DEV_DATA_DISPOSABLE=true`, and exact
  designated hostname, database and role matching the private DATABASE_URL.
- Only official direct `ep-…<region>…neon.tech` endpoints on the default/5432 port
  are allowed. Use Neon's Connect dialog with connection pooling OFF for owner
  tools. Do not just edit a hostname by guesswork; copy the direct connection.
- Direct connections are needed for the existing session advisory serialization
  lock. This changes no application's shared pool/TLS code and no schema.
- Query parameters cannot override host/database/user/port/search_path. Only
  sslmode=require/verify-full and channel_binding=require/prefer are accepted.
  The shared connection resolver still enforces certificate-verified TLS.
- Every NEW tool connection checks current_database/current_user/server IP and
  actual client TLS encryption/certificate authorization before being handed out.
  A hosted server's reported internal IP is not proof of a Neon endpoint: exact
  hostname plus verified client TLS establishes that. Proxy topologies can report
  internal/loopback server addresses, so they are not compared to a public IP pin.
- NODE_ENV/BORYNX_ENVIRONMENT must still be development. Reset/seed flags are
  separate. Neon reset confirmation now includes exact host/database/user, not just
  the database name. Plan prints the required argument without passwords.
- Reset's OID/schema/dependency locks, upload lifecycle, seed provenance, and
  production demo exclusions are unchanged. Browser demos remain loopback-only
  even when their backing database is Neon.

## On your computer

First obtain these updated source files locally. Arena changes are not automatically
pulled into a separate VS Code checkout; no PR/push is part of this change unless
separately requested. Use supported Node 22.18+ and run `npm ci` once updated.

### 1. Configure private `.env.local`

Confirm it is ignored: `git check-ignore .env.local`. Keep credentials ONLY there.
From Neon -> Connect, select your EXISTING database and database role, turn pooling
OFF, and privately set DATABASE_URL to the copied direct PostgreSQL string.

Set these additional fields. The angle-bracket fields below are instructions to
replace privately, not literal values, and are not requests to send them in chat.

```dotenv
NODE_ENV=development
BORYNX_ENVIRONMENT=development
BORYNX_DEV_DATABASE_TARGET=neon
BORYNX_ALLOW_NEON_DEV_DATA=true
BORYNX_DEV_DATA_DISPOSABLE=true
BORYNX_DEV_DATABASE_HOST=<exact direct hostname, without scheme or port>
BORYNX_DEV_DATABASE_NAME=<your existing database name>
BORYNX_DEV_DATABASE_USER=<exact database role from the connection string>
DATABASE_POOL_MAX=5
BORYNX_ALLOW_DEV_RESET=false
BORYNX_ALLOW_DEV_SEED=false
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=<new random secret, at least 32 characters>
BORYNX_DEMO_PASSWORD=<new random local-only password, at least 20 characters>
BORYNX_ENABLE_DEMO_LOGIN=true
EMAIL_DELIVERY_MODE=file
```

Do not add public prefixes to secrets. Keep SSL verification enabled. Generate
random secrets privately, for example `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, using separate values for auth secret and demo password.
Your actual database may be named `neondb`; it does NOT need to be `borynx_dev`.
These flags designate its data as disposable; they do not make a copy of it.

### 2. Check the designation (offline, no database connection)

```sh
npm run dev:data:plan -- --env-file .env.local
```

Review the exact public table deletion list and printed reset confirmation. Keep
that confirmation for step 4. Never paste your private env/connection string here.

### 3. Apply tracked migrations to that existing database

This step CONNECTS to and CHANGES your Neon schema when YOU run it. Check the
DATABASE_URL target privately first. Migration tools have separate gates and do
not enforce the new data-tool designation themselves.

```sh
npm run verify:migrate -- --env-file .env.local --apply
npm run verify:migrations -- --env-file .env.local
```

Expected history is migrations 0000–0008. Do not use db:push or regenerate migrations.
If history diverges, an expected table is missing, or an existing schema has no
migration history, STOP and share only the sanitized error code. Do not force,
drop the database/schema, or rewrite journal entries to get past the checks.

### 4. Reset old Borynx data ONLY if you intend to delete it

This deletes rows from the reviewed allowlist in YOUR existing Neon database,
including users, profiles, posts and the other application records. It preserves
schema/migration history, does not delete your Neon project, and does not remove
Supabase Storage files or old Supabase Auth users. It refuses unknown FK-dependent
relations, unsafe schemas/triggers, or missing expected tables rather than expanding
scope. If the database is already empty, skip this step.

Temporarily set BORYNX_ALLOW_DEV_RESET=true. Copy the exact --confirm argument
printed by step 2 into this command as ONE quoted argument:

```sh
npm run dev:data:reset -- --env-file .env.local --apply "--confirm=<paste exact confirmation here>"
```

Replace the entire placeholder argument with the actual one. Set
BORYNX_ALLOW_DEV_RESET=false immediately afterward. Reset NEVER runs implicitly.

### 5. Create the four demo accounts

Temporarily set BORYNX_ALLOW_DEV_SEED=true:

```sh
npm run dev:data:seed -- --env-file .env.local --apply
```

Repeat once to check idempotency, then set BORYNX_ALLOW_DEV_SEED=false. Seed refuses
old/unrelated identities without provenance; do not bypass that refusal. If you
want all those records removed, use the explicitly confirmed reset first.

The password must remain unchanged for repeated seed/login: seed does not silently
change an existing demo credential when the env password changes.

### 6. Run the app locally

```sh
npm run dev:next
```

Open http://localhost:3000, then test the four Demo Accounts buttons on Login.
Your local app now uses YOUR existing Neon database. Keep it firewalled; the dev
server binds all interfaces. File email delivery writes private verification/reset
messages to `.local/auth-outbox`; it sends no actual email. Storage/Google setup is
separate and not needed for this first auth/demo test.

When finished testing, disable BORYNX_ENABLE_DEMO_LOGIN. You can also disable
BORYNX_ALLOW_NEON_DEV_DATA to disarm remote owner tools/demo gating without changing
ordinary application database connectivity. Never enable these development tools
in production NODE_ENV/BORYNX_ENVIRONMENT.

## Validation and boundaries for this code change

Fresh checks: root/scoped-auth typechecks PASS; full ordinary suite 39 files /
386 tests PASS; auth/security suite 7 files / 99 tests PASS; latest targeted
designation/local-gate rerun 37 tests PASS; production webpack build PASS with
provider/DB config unset; lint 0 errors / 6 existing warnings; diff check PASS.
Manifests, lockfile and migrations are unchanged. New tests use ONLY synthetic
URLs, pure checks and mocked PoolClient callbacks; they verify target mismatches,
remote consent/production gates, URI override rejection, host-qualified destructive
confirmation, TLS and connected identity refusal, and local-only demo behavior.
Existing reset executor/seed tests use in-memory PGlite. No actual Neon endpoint,
credential, database, browser or provider integration was used here. Hosted Neon
TLS/proxy topology and real advisory-lock concurrency remain owner verification.

Historical Phase 2I-B / 2I-B.1 reports describe their original loopback-only gates;
this guide and current implementation supersede those specific restrictions only.
No dependency or migration changes, live connection, reset/seed CLI execution,
provider operation, commit/push/PR/merge or deployment was performed for this update.
