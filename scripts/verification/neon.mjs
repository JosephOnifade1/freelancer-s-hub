import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { proveIsolatedTransaction } from "../../src/server/db/verification-transaction.mjs";
import { fileURLToPath } from "node:url";
import { resolveConnectionSettings } from "../../src/server/db/env.ts";
import { poolOptions } from "../../src/server/db/pool-options.mjs";
import { insist } from "./common.mjs";
export const migrationsFolder = fileURLToPath(new URL("../../src/server/db/migrations", import.meta.url));
export function createVerificationPool(env) {
  insist(typeof env.DATABASE_URL === "string" && env.DATABASE_URL.length > 0, "COMMAND_CONFIGURATION_INVALID");
  const settings = resolveConnectionSettings(env.DATABASE_URL, env.DATABASE_SSL_CA ?? "");
  const pool = new Pool({ ...poolOptions(settings, env.DATABASE_POOL_MAX), statement_timeout: 120000, lock_timeout: 5000 });
  let failed=false;
  pool.on("error", () => {failed=true;});
  return { pool, settings, hadPoolError:()=>failed };
}
export async function withPool(env, operation) {
  const { pool, settings, hadPoolError } = createVerificationPool(env);
  let result;
  try { result=await operation(pool, settings); }
  finally { await pool.end(); }
  insist(!hadPoolError(), "POOL_CONNECTION_UNAVAILABLE");
  return result;
}
export async function verifyConnection(pool, settings, output) {
  const client = await pool.connect();
  try {
    const result = await client.query("select current_database() as database, current_user as role");
    const url = new URL(settings.connectionString);
    insist(result.rows[0]?.database === decodeURIComponent(url.pathname.slice(1)) && result.rows[0]?.role === decodeURIComponent(url.username), "DATABASE_IDENTITY_MISMATCH");
    if (settings.isLocal) output("PASS CONNECTION_IDENTITY; LOCAL_LOOPBACK_TLS_NOT_REQUIRED (not Neon TLS proof)");
    else {
      const stream = client.connection?.stream;
      insist(settings.ssl?.rejectUnauthorized === true && stream?.encrypted === true && stream?.authorized === true, "TLS_NOT_VERIFIED");
      output("PASS CONNECTION_IDENTITY; REMOTE_TLS_CERTIFICATE_VERIFIED");
    }
    if (settings.downgradeAttempted) output("NOTICE URL_TLS_OVERRIDE_IGNORED_BY_APPLICATION_POLICY");
  } finally { client.release(); }
}
/** Drizzle default journal; READ ONLY. Hash+timestamp prefix, not just max timestamp. */
export async function migrationState(pool, expected = readMigrationFiles({ migrationsFolder })) {
  const exists = await pool.query("select to_regclass('drizzle.__drizzle_migrations') as journal");
  const actual = exists.rows[0]?.journal ? (await pool.query('select hash, created_at from drizzle.__drizzle_migrations order by created_at,id')).rows : [];
  insist(actual.length <= expected.length, "UNKNOWN_MIGRATION_HISTORY");
  actual.forEach((row, i) => insist(row.hash === expected[i].hash && Number(row.created_at) === expected[i].folderMillis, "MIGRATION_HISTORY_MISMATCH"));
  return { expected, applied: actual.length, pending: expected.length - actual.length };
}
export async function inspectMigrations(pool, output) {
  const state = await migrationState(pool);
  output(`MIGRATIONS applied=${state.applied} expected=${state.expected.length} pending=${state.pending}`);
  // Only source-controlled expected names are printed, never actual provider data.
  for (let i = 0; i < state.expected.length; i++) output(`MIGRATION ${String(i).padStart(4,"0")} ${i < state.applied ? "APPLIED" : "PENDING"}`);
  insist(state.pending === 0, "UNAPPLIED_MIGRATIONS");
  const expectedTables = [...new Set(state.expected.flatMap(m => [...m.sql.join("\n").matchAll(/CREATE TABLE "([a-z_]+)"/g)].map(m => m[1])))];
  const tables = await pool.query("select tablename from pg_tables where schemaname='public'");
  insist(expectedTables.every(name => tables.rows.some(r => r.tablename === name)), "EXPECTED_TABLE_MISSING");
  output("PASS MIGRATION_HASH_HISTORY_AND_EXPECTED_TABLES (not a full schema-drift check)");
}
export async function applyMigrations(pool, approved, output) {
  insist(approved, "EXPLICIT_APPLY_REQUIRED");
  const state=await migrationState(pool); // Refuse divergent history before DDL.
  if(state.applied===0){
    const existing=await pool.query("select tablename from pg_tables where schemaname='public'");
    const source=state.expected.map(m=>m.sql.join("\n")).join("\n");
    insist(!existing.rows.some(r=>source.includes(`CREATE TABLE "${r.tablename}"`)), "EXISTING_SCHEMA_WITHOUT_MIGRATION_HISTORY");
  }
  await migrate(drizzle(pool), { migrationsFolder });
  await inspectMigrations(pool, output);
  output("PASS EXPLICIT_MIGRATION_APPLICATION");
}
/** Application and CLI share the same isolated transaction proof. */
export async function verifyTransaction(db, approved, output) {
  insist(approved, "EXPLICIT_WRITE_REQUIRED");
  const proof=await proveIsolatedTransaction(db);
  insist(proof.committed && proof.rolledBack && proof.transactionId, "TRANSACTION_PROOF_FAILED");
  output("PASS TEMP_INSERT_READ_UPDATE_COMMIT_AND_ROLLBACK; application records untouched");
}
