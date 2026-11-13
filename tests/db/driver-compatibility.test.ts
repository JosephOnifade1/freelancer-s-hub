/**
 * Runtime proof for the Neon + Drizzle driver stack (Phase 2B.1, hardened in 2B.1.1).
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
  describeTlsPolicy,
  isDatabaseConfigured as envConfigured,
  resolveConnectionSettings,
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

  it("verifies TLS for remote hosts and disables it only for loopback", () => {
    const remote = "postgres://u:p@ep-x.eu.neon.tech/db";

    // Loopback: the one case where TLS is optional (local development).
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      expect(resolveConnectionSettings(`postgres://u:p@${host}:5432/db`).ssl).toBe(false);
    }

    // Remote: full verification. Never `rejectUnauthorized: false` (Phase 2B.1.1).
    expect(resolveConnectionSettings(remote).ssl).toEqual({ rejectUnauthorized: true });
    expect(describeTlsPolicy(remote).verifying).toBe(true);
    expect(describeTlsPolicy(remote).hostClass).toBe("remote");
  });

  it("strips TLS parameters from the connection string so pg cannot override policy", () => {
    // Measured in 2B.1.1: `pg` merges the parsed URL over the config, so a
    // `sslmode` in the URL wins over an explicit `ssl` object. The resolver
    // removes them all, which is what makes the verification policy binding.
    const downgrades = [
      "sslmode=no-verify",
      "ssl=no-verify",
      "sslmode=disable",
      "sslmode=allow",
      "sslmode=prefer",
      "uselibpqcompat=true&sslmode=require",
      "sslmode=verify-full&sslrootcert=/nonexistent/x.pem",
      "sslcert=/x.pem&sslkey=/y.pem",
    ];

    for (const query of downgrades) {
      const settings = resolveConnectionSettings(`postgres://u:p@ep-x.eu.neon.tech/db?${query}`);
      expect(settings.connectionString).not.toMatch(/sslmode|ssl=|sslrootcert|sslcert|uselibpqcompat/);
      expect(settings.ssl).toEqual({ rejectUnauthorized: true });
      expect(settings.downgradeAttempted).toBe(true);
    }
  });

  it("keeps non-TLS parameters such as channel_binding", () => {
    const settings = resolveConnectionSettings(
      "postgres://u:p@ep-x.eu.neon.tech/db?sslmode=require&channel_binding=require",
    );
    expect(settings.connectionString).toContain("channel_binding=require");
    expect(settings.connectionString).not.toContain("sslmode");
  });

  it("preserves URL credentials and encoding while sanitising", () => {
    const settings = resolveConnectionSettings(
      "postgres://user:p%40ss%2Fword@ep-x.eu.neon.tech:5432/borynx?sslmode=no-verify",
    );
    const parsed = new URL(settings.connectionString);
    expect(parsed.username).toBe("user");
    expect(parsed.password).toBe("p%40ss%2Fword");
    expect(parsed.hostname).toBe("ep-x.eu.neon.tech");
    expect(parsed.port).toBe("5432");
    expect(parsed.pathname).toBe("/borynx");
  });

  it("accepts a custom CA without ever disabling verification", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
    const settings = resolveConnectionSettings("postgres://u:p@private.example/db", pem);
    expect(settings.ssl).toEqual({ rejectUnauthorized: true, ca: pem });

    // A path that does not exist must fail loudly, not fall back to no CA.
    expect(() =>
      resolveConnectionSettings("postgres://u:p@private.example/db", "/nonexistent/ca.pem"),
    ).toThrow();
  });

  it("treats an explicit sslmode=verify-full as no downgrade attempt", () => {
    expect(describeTlsPolicy("postgres://u:p@ep-x.eu.neon.tech/db?sslmode=verify-full").downgradeAttempted).toBe(false);
    expect(describeTlsPolicy("postgres://u:p@ep-x.eu.neon.tech/db?sslmode=verify-full").verifying).toBe(true);
  });

  it("does not expose a NEXT_PUBLIC_ database variable", () => {
    const publicVars = Object.keys(process.env).filter((key) =>
      key.startsWith("NEXT_PUBLIC_") && /DATABASE|NEON|PG/i.test(key),
    );
    expect(publicVars).toEqual([]);
  });
});
