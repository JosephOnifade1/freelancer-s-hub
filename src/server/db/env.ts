/**
 * Neon connection configuration (Phase 2B.1, hardened in 2B.1.1).
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
 * TLS policy (Phase 2B.1.1)
 * -------------------------
 * Phase 2B.1 shipped `rejectUnauthorized: false` for remote hosts. That was
 * wrong: it encrypts without authenticating the server, so a machine in the
 * network path could impersonate the database. It has been removed. Remote
 * connections now **always** verify the certificate chain and hostname.
 *
 * Two behaviours of the installed `pg` 8.23.1 / `pg-connection-string` 2.14.1
 * make this easy to get wrong, so both are handled explicitly here:
 *
 *  1. **Any `sslmode` in the URL overrides an explicit `ssl` option.** `pg`
 *     merges the parsed connection string over the config with
 *     `Object.assign`, so `?sslmode=no-verify` becomes
 *     `{ rejectUnauthorized: false }` even when the caller passed a secure
 *     `ssl` object. (Measured; see the report.) The URL is therefore stripped
 *     of every TLS-related parameter before it reaches `pg`, so nothing in the
 *     connection string can override the policy decided here.
 *  2. **`PGSSLMODE` in the environment is ignored** once an explicit `ssl` is
 *     passed, which is another route to a silent downgrade that this module
 *     closes by always passing one.
 *
 * Note that `pg` currently treats `require`, `prefer` and `verify-ca` as
 * aliases for `verify-full` (and prints a one-time SECURITY WARNING saying so).
 * Stripping the parameter sidesteps that deprecation entirely: the policy is
 * expressed in code, not in a string that changes meaning in `pg` 9.
 *
 * Neon serves publicly-signed certificates chaining to ISRG Root X1/X2 (Let's
 * Encrypt), which is already in Node's bundled trust store, so **no CA file is
 * required** for Neon. `DATABASE_SSL_CA` exists for a provider that uses a
 * private CA; supplying it never disables verification.
 */
import fs from "node:fs";

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
 * Query parameters that influence TLS and must never reach `pg`.
 *
 * `sslmode` / `ssl` select the verification level; `sslrootcert` etc. change
 * which CA is trusted (and `sslmode=no-verify` disables the check outright).
 * `uselibpqcompat` re-enables libpq's weaker semantics. All are removed so the
 * connection string cannot override `resolveConnectionSettings()`.
 *
 * `channel_binding` is deliberately *not* stripped: it is a SCRAM
 * authentication parameter, not a TLS one, and `pg` ignores it. Neon's default
 * connection string includes it, so stripping it would be gratuitous.
 */
const TLS_QUERY_PARAMS = [
  "sslmode",
  "ssl",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "sslcrl",
  "sslpassword",
  "uselibpqcompat",
] as const;

/** Hosts treated as local development. */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === ""
  );
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

/** The TLS half of a connection configuration. */
export type TlsConfig = false | { rejectUnauthorized: true; ca?: string };

export interface ResolvedConnectionSettings {
  /** The connection string with every TLS parameter removed. */
  connectionString: string;
  /** TLS options that the connection string can no longer override. */
  ssl: TlsConfig;
  /** Whether this is a loopback connection (local development). */
  isLocal: boolean;
  /** Whether the original URL carried a `rejectUnauthorized`-disabling parameter. */
  downgradeAttempted: boolean;
}

/**
 * Reads an optional CA bundle for a private-CA provider.
 *
 * Accepts a path to a PEM file or inline PEM content (detected by the
 * `-----BEGIN` prefix), which keeps it usable on platforms where mounting a
 * file is awkward. A path that cannot be read is a hard error: silently
 * continuing without the CA would turn a misconfiguration into a confusing
 * handshake failure.
 */
function readCaBundle(spec: string | undefined): string | undefined {
  if (!spec) return undefined;
  if (spec.includes("-----BEGIN")) return spec;
  return fs.readFileSync(spec, "utf8");
}

/**
 * Decides the TLS policy for a connection string.
 *
 * - **Loopback** (local development): plaintext, as in Phase 2B.1. A local
 *   Postgres does not have a verifiable certificate, and this is the only
 *   situation where TLS is optional.
 * - **Everything else: TLS with full verification** (`rejectUnauthorized:
 *   true`). There is no option, environment variable or connection-string
 *   parameter that turns this off.
 *
 * The returned `connectionString` is safe to hand to `pg`: it has had every TLS
 * parameter removed, so `pg`'s `Object.assign` merge cannot weaken the policy.
 */
export function resolveConnectionSettings(
  url: string,
  caSpec: string | undefined = process.env.DATABASE_SSL_CA,
): ResolvedConnectionSettings {
  const parsed = new URL(url);
  const isLocal = isLoopbackHost(parsed.hostname);

  const downgradeAttempted = TLS_QUERY_PARAMS.some((param) => {
    if (!parsed.searchParams.has(param)) return false;
    const value = parsed.searchParams.get(param);
    return (
      param === "uselibpqcompat" ||
      value === "disable" ||
      value === "no-verify" ||
      value === "allow" ||
      value === "prefer" ||
      param === "sslrootcert" ||
      param === "sslcert" ||
      param === "sslkey"
    );
  });

  for (const param of TLS_QUERY_PARAMS) {
    parsed.searchParams.delete(param);
  }

  const connectionString = parsed.toString();

  if (isLocal) {
    return { connectionString, ssl: false, isLocal, downgradeAttempted };
  }

  const ca = readCaBundle(caSpec);
  return {
    connectionString,
    ssl: ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true },
    isLocal,
    downgradeAttempted,
  };
}

/**
 * Describes the TLS policy without revealing any credential.
 *
 * Used by the probe route and by tests. Never includes the password, the full
 * URL, or the CA contents.
 */
export function describeTlsPolicy(
  url: string,
  caSpec: string | undefined = process.env.DATABASE_SSL_CA,
): {
  isLocal: boolean;
  verifying: boolean;
  hostClass: "loopback" | "remote";
  downgradeAttempted: boolean;
  customCa: boolean;
} {
  const { ssl, isLocal, downgradeAttempted } = resolveConnectionSettings(url, caSpec);
  return {
    isLocal,
    verifying: ssl !== false && ssl.rejectUnauthorized === true,
    hostClass: isLocal ? "loopback" : "remote",
    downgradeAttempted,
    customCa: ssl !== false && Boolean(ssl.ca),
  };
}
