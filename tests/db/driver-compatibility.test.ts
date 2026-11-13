/**
 * Runtime proof for the Neon + Drizzle driver stack (Phase 2B.1).
 *
 * Run with:   npm run test:db
 * Requires:   DATABASE_URL pointing at any PostgreSQL ≥14 with the schema unused.
 *
 * This is NOT part of `npm test`. Vitest runs under jsdom without a database, and
 * `src/server/db/index.ts` imports `next/headers` (the server-only guard), which
 * cannot resolve outside a Next request scope. Keeping this separate is the
 * point: the compatibility proof runs against a real server, the unit suite stays
 * hermetic.
 *
 * The test creates **no application tables**. It uses `pg_catalog` and a
 * session-local TEMP table, which is dropped by `proveTransaction()`.
 */
import { afterAll, describe, it, expect } from "vitest";

import {
  closeDatabase,
  echoParameterized,
  isDatabaseConfigured,
  probeDatabase,
  proveAdvisoryLock,
  proveTransaction,
} from "@/server/db";
import {
  databaseSslConfig,
  isDatabaseConfigured as envConfigured,
} from "@/server/db/env";

const configured = isDatabaseConfigured();

describe("neon + drizzle driver compatibility", { skip: !configured }, () => {
  afterAll(async () => {
    await closeDatabase();
  });

  it("connects and reads server metadata", async () => {
    const probe = await probeDatabase();
    expect(probe.serverVersion).toMatch(/^\d+\.\d+/);
    expect(probe.database.length).toBeGreaterThan(0);
    expect(probe.maxConnections).toBeGreaterThan(0);
    expect(probe.transactionId).toBeNull();
  });

  it("sends values as bind parameters, not SQL text", async () => {
    expect(await echoParameterized("borynx")).toBe("borynx");
    const hostile = "'; drop table profiles; --";
    // A quoted payload must round-trip verbatim: it was bound, not executed.
    expect(await echoParameterized(hostile)).toBe(hostile);
  });

  it("supports interactive transactions and rolls back on throw", async () => {
    const result = await proveTransaction();
    expect(result.transactionId).not.toBeNull();
    expect(result.rolledBack).toBe(true);
  });

  it("acquires a transaction-scoped advisory lock re-entrantly", async () => {
    const lock = await proveAdvisoryLock();
    expect(lock.acquired).toBe(true);
    expect(lock.reentrant).toBe(true);
  });

  it("releases the advisory lock after the transaction ends", async () => {
    // If the previous test leaked a session-level lock, this acquire would fail.
    const again = await proveAdvisoryLock();
    expect(again.acquired).toBe(true);
  });
});

describe("environment handling", () => {
  it("reports configuration from DATABASE_URL only", () => {
    expect(envConfigured()).toBe(configured);
    expect(envConfigured()).toBe(Boolean(process.env.DATABASE_URL));
  });

  it("requires TLS for remote hosts and disables it for loopback", () => {
    expect(databaseSslConfig("postgres://u:p@127.0.0.1:5432/db")).toBe(false);
    expect(databaseSslConfig("postgres://u:p@localhost:5432/db")).toBe(false);
    expect(databaseSslConfig("postgres://u:p@ep-x.eu.neon.tech/db")).toEqual({
      rejectUnauthorized: false,
    });
    expect(databaseSslConfig("postgres://u:p@ep-x.eu.neon.tech/db?sslmode=disable")).toBe(false);
    expect(databaseSslConfig("postgres://u:p@ep-x.eu.neon.tech/db?sslmode=verify-full")).toEqual({
      rejectUnauthorized: true,
    });
  });

  it("does not expose a NEXT_PUBLIC_ database variable", () => {
    const publicVars = Object.keys(process.env).filter((key) =>
      key.startsWith("NEXT_PUBLIC_") && /DATABASE|NEON|PG/i.test(key),
    );
    expect(publicVars).toEqual([]);
  });
});
