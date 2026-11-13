/**
 * Live TLS verification proof (Phase 2B.1.1).
 *
 * Run with:   npm run test:db:tls
 * Requires:   DATABASE_TLS_TEST_URL  — a Postgres server using a certificate
 *             signed by a CA that Node does NOT trust (see docs §2B.1.1).
 *             DATABASE_TLS_TEST_CA   — path to that CA's PEM file.
 *
 * Why a separate file: these assertions are only meaningful against a server
 * whose certificate chain is *untrusted by default*. A public CA (Neon, or any
 * Let's Encrypt certificate) is already in Node's store, so verification passes
 * whether or not the code is checking — such a test proves nothing about the
 * code. A private CA makes the difference observable:
 *
 *   - if verification is on, the connection is REFUSED
 *   - if verification is off (the Phase 2B.1 bug), it SUCCEEDS
 *
 * That is the pair asserted below. Skipped when the environment variables are
 * absent, so the suite stays green without the fixture.
 */
import { Client } from "pg";
import { describe, it, expect } from "vitest";

import { resolveConnectionSettings } from "@/server/db/env";

const url = process.env.DATABASE_TLS_TEST_URL;
const ca = process.env.DATABASE_TLS_TEST_CA;
const fixtureReady = Boolean(url && ca);

/** Connects with a config and reports whether the server accepted it. */
async function connectsWith(config: { connectionString: string; ssl: false | { rejectUnauthorized: boolean; ca?: string } }) {
  const client = new Client(config);
  try {
    await client.connect();
    const result = await client.query("select ssl from pg_stat_ssl where pid = pg_backend_pid()");
    await client.end();
    return { connected: true, encrypted: result.rows[0]?.ssl === true };
  } catch (error) {
    return { connected: false, error: (error as Error).message };
  }
}

describe("live TLS verification", { skip: !fixtureReady }, () => {
  it("refuses a server whose certificate chain is not trusted", async () => {
    const settings = resolveConnectionSettings(url as string, undefined);
    const outcome = await connectsWith(settings);
    expect(outcome.connected).toBe(false);
    expect(outcome.error).toMatch(/unable to verify|self[- ]signed|certificate/i);
  });

  it("connects to the same server once its CA is trusted, still verifying", async () => {
    const settings = resolveConnectionSettings(url as string, ca as string);
    expect(settings.ssl).not.toBe(false);
    if (settings.ssl !== false) expect(settings.ssl.rejectUnauthorized).toBe(true);

    const outcome = await connectsWith(settings);
    expect(outcome.connected).toBe(true);
    expect(outcome.encrypted).toBe(true);
  });

  it("cannot be downgraded by a hostile sslmode in the URL", async () => {
    // This is the regression that matters. Before 2B.1.1 the URL won and the
    // connection succeeded; now the parameter is stripped and it must fail.
    for (const query of ["sslmode=no-verify", "ssl=no-verify", "sslmode=disable"]) {
      const settings = resolveConnectionSettings(`${url}${url?.includes("?") ? "&" : "?"}${query}`, undefined);
      expect(settings.ssl).toEqual({ rejectUnauthorized: true });
      const outcome = await connectsWith(settings);
      expect(outcome.connected).toBe(false);
    }
  });
});
