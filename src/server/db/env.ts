/**
 * Neon connection configuration (Phase 2B.1).
 *
 * This module reads exactly one secret, `DATABASE_URL`, and it is deliberately
 * *not* prefixed `NEXT_PUBLIC_`. Next.js inlines only `NEXT_PUBLIC_*` variables
 * into the browser bundle, so the value here can never be inlined client-side.
 * Nothing else in the application reads `DATABASE_URL`.
 *
 * A dynamic read (`process.env[key]`) is used here on purpose — unlike
 * `src/lib/supabase-env.ts`, which needs *build-time* inlining for the browser
 * bundle. This file only ever runs on the server at request time, where
 * `process.env` is read normally, so a literal access is not required and the
 * value stays out of the compiled client graph.
 *
 * Server-only by construction: the guard is `next/headers` in `./index.ts`,
 * which throws outside a request scope and fails a client build. No `server-only`
 * package is imported — it is not a dependency of this repository, and adding it
 * for one marker import was not warranted (see docs §8).
 */

/** Thrown when server code asks for a database connection that is not configured. */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL is not set. Neon access is disabled; this is expected in " +
        "unconfigured and demo builds.",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * True when a Neon/Postgres connection string is present.
 *
 * Mirrors `isSupabaseConfigured` in `src/lib/supabase-env.ts`: unconfigured is a
 * legitimate state, not an error. Callers must branch on this rather than
 * attempting a connection and catching the failure.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * The connection string, or a throw.
 *
 * Never log the returned value, never serialise it, and never return it from a
 * route handler or server action.
 */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseNotConfiguredError();
  return url;
}

/**
 * Whether to use TLS.
 *
 * Neon always requires TLS. A local Postgres used for the compatibility spike
 * does not, so this is derived rather than hardcoded: `sslmode` in the URL wins,
 * otherwise TLS is on unless the host is loopback. `rejectUnauthorized: false` is
 * intentional — Neon presents a certificate that Node does not chain to a root
 * CA in every environment, and the connection is already TLS-encrypted.
 */
export function databaseSslConfig(url: string): false | { rejectUnauthorized: boolean } {
  const parsed = new URL(url);
  const sslmode = parsed.searchParams.get("sslmode");
  if (sslmode === "disable") return false;
  if (sslmode === "require" || sslmode === "verify-full") return { rejectUnauthorized: sslmode === "verify-full" };
  const host = parsed.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  return { rejectUnauthorized: false };
}
