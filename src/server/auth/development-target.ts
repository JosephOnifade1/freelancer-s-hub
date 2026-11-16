import {isIP} from "node:net";
/** Owner-designated disposable data target. No connection or environment loading.
 * Hosted support is opt-in and restricted to an exact DIRECT Neon endpoint.
 * Direct connections are required for the tools' session advisory lock. */
export function developmentTarget(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "development" || env.BORYNX_ENVIRONMENT !== "development") throw Error("development_only");
  const url = new URL(env.DATABASE_URL ?? "");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hash) throw Error("invalid_database_target");
  // pg connection-string query options must not override the validated host/user/db.
  const allowed = new Set(["sslmode", "channel_binding"]);
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw Error("ambiguous_database_target");
  if (url.searchParams.has("sslmode") && !["require", "verify-full"].includes(url.searchParams.get("sslmode")!)) throw Error("unsafe_database_tls_option");
  if (url.searchParams.has("channel_binding") && !["require", "prefer"].includes(url.searchParams.get("channel_binding")!)) throw Error("unsafe_channel_binding_option");
  const database = decodeURIComponent(url.pathname.slice(1));
  const user = decodeURIComponent(url.username);
  if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(user) || !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(database) || env.BORYNX_DEV_DATABASE_NAME !== database) throw Error("explicit_development_database_required");
  const host = url.hostname;
  if (["localhost", "127.0.0.1", "[::1]"].includes(host)) {
    if (env.BORYNX_DEV_DATABASE_TARGET && env.BORYNX_DEV_DATABASE_TARGET !== "local") throw Error("target_kind_mismatch");
    if (!/^borynx_(dev|test)(_[a-z0-9]+)?$/.test(database)) throw Error("explicit_development_database_required");
    return { kind: "local" as const, database, host, user };
  }
  if (env.BORYNX_DEV_DATABASE_TARGET !== "neon" || env.BORYNX_ALLOW_NEON_DEV_DATA !== "true" || env.BORYNX_DEV_DATA_DISPOSABLE !== "true") throw Error("explicit_neon_disposable_approval_required");
  if (!/^ep-[a-z0-9-]+\.(?:[a-z0-9-]+\.)+neon\.tech$/.test(host) || host.includes("-pooler.") || (url.port && url.port !== "5432")) throw Error("direct_neon_endpoint_required");
  if (env.BORYNX_DEV_DATABASE_HOST !== host || env.BORYNX_DEV_DATABASE_USER !== user) throw Error("explicit_neon_identity_required");
  return { kind: "neon" as const, database, host, user };
}
export function developmentResetConfirmation(env: NodeJS.ProcessEnv = process.env) {
  const target = developmentTarget(env);
  return `${target.kind === "neon" ? `${target.host}/${target.database}/${target.user}` : target.database}:DELETE-ALL-DEVELOPMENT-DATA`;
}
/** Verify every pooled connection before it may run owner tooling. TLS authenticates
 * the designated Neon hostname; its dynamic server IP is not a stable allowlist. */
export function verifyDevelopmentConnection(target: ReturnType<typeof developmentTarget>, identity: {database:unknown;role:unknown;host:unknown;tls?:unknown}) {
  if (identity.database !== target.database || identity.role !== target.user) throw Error("target_identity_mismatch");
  const local = ["127.0.0.1", "::1", null].includes(identity.host as string|null);
  const host = typeof identity.host === "string" ? identity.host.replace(/\/\d+$/, "") : null;
  if (target.kind === "local" ? !local : typeof host !== "string" || !isIP(host) || identity.tls !== true) throw Error("target_connection_mismatch");
}
