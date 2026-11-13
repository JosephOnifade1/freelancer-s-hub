import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration (Phase 2B.2).
 *
 * Used for `generate` and `check`. It reads `DATABASE_URL` only because Kit
 * insists on a dialect and a URL shape; the commands this repository runs
 * (`generate`, `check`) never open a connection, so no database is contacted
 * and no credential needs to exist for them to work.
 *
 * `push` is deliberately not wired into any npm script: schema push mutates a
 * database without leaving a reviewable artefact, so tracked migrations are the
 * only supported path (docs §10).
 *
 * TLS: `drizzle-kit` builds its own `pg` connection from the URL, bypassing
 * `resolveConnectionSettings()`. That is why `migrate`/`push` must only ever be
 * pointed at a development database, and why the URL used for them should carry
 * `sslmode=verify-full` explicitly.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./src/server/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://unused:unused@127.0.0.1:5432/unused",
  },
  // Fail loudly instead of prompting when a migration needs a decision.
  strict: true,
  verbose: true,
});
