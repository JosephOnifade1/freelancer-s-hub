import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  databaseSslConfig,
  isDatabaseConfigured,
  requireDatabaseUrl,
} from "./env";

/**
 * The server-only Neon/PostgreSQL connection (Phase 2B.1).
 *
 * **No application tables are defined here.** Phase 2B.1 proves the driver,
 * connection and transaction stack works inside this Next.js 16 app; the domain
 * schema arrives in Phase 2B.2. `pgSchema`/table objects are therefore absent on
 * purpose — do not add them in this module's proof scope.
 *
 * Server-only boundary
 * --------------------
 * `next/headers` is imported for its side effect: it throws when evaluated
 * outside a request scope, which is exactly what a browser bundle is. That makes
 * any accidental `import` from a Client Component fail at build time instead of
 * silently shipping the driver — and the connection string — to the browser.
 * This mirrors the guard `src/lib/supabase-server.ts` already uses, rather than
 * introducing a second mechanism.
 *
 * Driver choice
 * -------------
 * `drizzle-orm/node-postgres` over a `pg` Pool. The decisive requirement is
 * Borynx's atomic behaviour: `cast_vote` takes row locks (`FOR UPDATE`) plus a
 * transaction-scoped advisory lock, and `pg_advisory_xact_lock` only means
 * anything inside a real interactive transaction. Drizzle's `neon-http` driver
 * *type-checks* `db.transaction()` but throws `No transactions support in
 * neon-http driver` at runtime, so it cannot host that logic. See
 * docs/PHASE_2B_1_DRIVER_COMPATIBILITY.md §2.
 *
 * Pooling
 * -------
 * One `Pool` per process, cached on `globalThis` so Next's dev-mode module
 * reloading does not leak a new pool on every hot reload. On Vercel/serverless,
 * prefer a Neon pooled connection string (`-pooler`) so PgBouncer does the
 * multiplexing; keep the Node `max` small (see `POOL_MAX_DEFAULT`).
 */
import { cookies } from "next/headers";

/**
 * Reports whether this code is running inside a Next.js request scope.
 *
 * `cookies()` throws outside one — which is exactly the situation in a browser
 * bundle. That throw is the enforcement mechanism, so this function both
 * documents the boundary and gives callers a way to assert it. It is never
 * called from request paths; the import alone is what fails a client build.
 */
export async function isRequestScoped(): Promise<boolean> {
  try {
    await cookies();
    return true;
  } catch {
    return false;
  }
}

const POOL_MAX_DEFAULT = 10;

interface DbGlobal {
  __borynxPool?: Pool;
  __borynxDb?: ReturnType<typeof drizzle>;
}

const globalForDb = globalThis as unknown as DbGlobal;

/**
 * Creates (once) the process-wide pool.
 *
 * Throws `DatabaseNotConfiguredError` when `DATABASE_URL` is absent. Callers
 * that must tolerate an unconfigured environment should check
 * `isDatabaseConfigured()` first — `getDatabase()` is the "I require a database"
 * entry point, not a nullable lookup.
 */
export function getPool(): Pool {
  if (globalForDb.__borynxPool) return globalForDb.__borynxPool;

  const pool = new Pool({
    connectionString: requireDatabaseUrl(),
    ssl: databaseSslConfig(process.env.DATABASE_URL as string),
    max: Number(process.env.DATABASE_POOL_MAX ?? POOL_MAX_DEFAULT),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // application_name makes Borynx's connections identifiable in
    // `pg_stat_activity`, which matters for diagnosing lock waits caused by the
    // advisory lock in `cast_vote`.
    application_name: "borynx-next",
  });

  // A pool-level error (a dead idle client) must not crash the process: `pg`
  // emits it asynchronously with no listener otherwise.
  pool.on("error", (error) => {
    console.error("Neon pool error:", error.message);
  });

  globalForDb.__borynxPool = pool;
  return pool;
}

/** The Drizzle client bound to the shared pool. */
export function getDatabase() {
  if (globalForDb.__borynxDb) return globalForDb.__borynxDb;
  const db = drizzle(getPool());
  globalForDb.__borynxDb = db;
  return db;
}

/**
 * Round-trip probe used by the compatibility route and the runtime test.
 *
 * Returns only non-sensitive facts: server version, the Neon compute endpoint
 * id (a hostname component, not a credential), and whether the session is inside
 * a transaction. It never returns the connection string.
 */
export interface DatabaseProbe {
  serverVersion: string;
  database: string;
  currentUser: string;
  transactionId: string | null;
  maxConnections: number;
}

export async function probeDatabase(): Promise<DatabaseProbe> {
  const db = getDatabase();
  const rows = await db.execute(sql`
    select
      current_setting('server_version') as server_version,
      current_database()            as database,
      current_user                  as current_user,
      pg_current_xact_id_if_assigned()::text as transaction_id,
      current_setting('max_connections')     as max_connections
  `);

  const row = (rows.rows ?? rows)[0] as Record<string, string | null>;
  return {
    serverVersion: row.server_version ?? "unknown",
    database: row.database ?? "unknown",
    currentUser: row.current_user ?? "unknown",
    transactionId: row.transaction_id ?? null,
    maxConnections: Number(row.max_connections ?? 0),
  };
}

/**
 * Proves the parameterized-query path: values travel as bind parameters
 * (`$1`), never interpolated into SQL text.
 *
 * Drizzle's tagged templates parameterize every non-`sql.raw` interpolation, so
 * `echo` is sent as a bind parameter. A payload such as `'; drop table x; --`
 * is returned verbatim rather than executed — asserted by the runtime test.
 */
export async function echoParameterized(value: string): Promise<string> {
  const db = getDatabase();
  const rows = await db.execute(
    sql`select ${value}::text as echoed, (select count(*) from pg_class) as rel_count`,
  );
  const row = (rows.rows ?? rows)[0] as { echoed: string };
  return row.echoed;
}

export interface TransactionProof {
  transactionId: string | null;
  rolledBack: boolean;
}

/**
 * Proves interactive transaction support *and* rollback.
 *
 * Writes inside the transaction, reads it back inside the same transaction,
 * then throws so the transaction rolls back. The read-back proves the write was
 * visible to the transaction; the post-rollback read (done by the caller) proves
 * it was not committed. Nothing is persisted: this uses a `TEMP` table that
 * exists only for the session.
 *
 * This is the capability `cast_vote` depends on — row locks and
 * `pg_advisory_xact_lock` require exactly this.
 */
export async function proveTransaction(): Promise<TransactionProof> {
  const db = getDatabase();

  // No `ON COMMIT DROP`: the table is created outside a transaction, so it would
  // be dropped immediately. It is session-local (TEMP) and dropped explicitly.
  await db.execute(sql`create temp table if not exists spike_tx_probe (v text)`);
  await db.execute(sql`truncate spike_tx_probe`);

  let transactionId: string | null = null;
  let rolledBack = false;

  try {
    await db.transaction(async (tx) => {
      // Write first: `pg_current_xact_id_if_assigned()` is null until the
      // transaction has actually done something, so reading it before the insert
      // would report "no transaction" even inside a real one.
      await tx.execute(sql`insert into spike_tx_probe (v) values ('committed?')`);

      const idRows = await tx.execute(
        sql`select pg_current_xact_id_if_assigned()::text as tid`,
      );
      const row = (idRows.rows ?? idRows)[0] as { tid: string | null };
      transactionId = row.tid;

      const check = await tx.execute(sql`select count(*)::int as n from spike_tx_probe`);
      const count = ((check.rows ?? check)[0] as { n: number }).n;
      if (count !== 1) throw new Error(`transaction visibility check failed: ${count}`);

      // Deliberate rollback.
      throw new Error("spike: intentional rollback");
    });
  } catch (error) {
    if ((error as Error).message === "spike: intentional rollback") {
      rolledBack = true;
    } else {
      throw error;
    }
  }

  await db.execute(sql`drop table if exists spike_tx_probe`);
  return { transactionId, rolledBack };
}

/**
 * Proves read-committed isolation and that a transaction-scoped advisory lock
 * behaves as `cast_vote` needs: it is released automatically at commit/rollback
 * and is re-entrant within the same transaction.
 */
export async function proveAdvisoryLock(): Promise<{ acquired: boolean; reentrant: boolean }> {
  const db = getDatabase();
  let acquired = false;
  let reentrant = false;

  await db.transaction(async (tx) => {
    const first = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('borynx:spike')) as ok`);
    acquired = ((first.rows ?? first)[0] as { ok: boolean }).ok;

    const second = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext('borynx:spike')) as ok`);
    reentrant = ((second.rows ?? second)[0] as { ok: boolean }).ok;
  });

  return { acquired, reentrant };
}

/** Closes the pool. Used by tests and by graceful shutdown; not by request paths. */
export async function closeDatabase(): Promise<void> {
  const pool = globalForDb.__borynxPool;
  if (!pool) return;
  globalForDb.__borynxPool = undefined;
  globalForDb.__borynxDb = undefined;
  await pool.end();
}

export { isDatabaseConfigured };
