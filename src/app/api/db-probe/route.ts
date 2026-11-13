import { NextResponse } from "next/server";
import {
  echoParameterized,
  getDatabase,
  isDatabaseConfigured,
  probeDatabase,
  proveAdvisoryLock,
  proveTransaction,
} from "@/server/db";
import { getServerSession, hasServerAuth } from "@/lib/server-session";

/**
 * Driver compatibility probe (Phase 2B.1).
 *
 * Development-only. Returns 404 in production so this diagnostic can never be
 * reached on a deployed environment: it says nothing secret, but a database
 * round-trip endpoint has no business being publicly callable.
 *
 * This route creates **no application tables** and touches **no application
 * data** — the whole proof runs against `pg_catalog` and a session-local `TEMP`
 * table that is dropped before the response is returned.
 *
 * It also reports the identity boundary the migration depends on: `authUid` is
 * the Supabase Auth UUID from `getServerSession()`, which is the value Neon will
 * use as `profiles.uid`. The route deliberately does not look up a profile —
 * there is no schema yet.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const configured = isDatabaseConfigured();
  if (!configured) {
    return NextResponse.json(
      {
        status: "not_configured",
        message:
          "DATABASE_URL is not set. Compile-time compatibility is proven; no runtime connection was attempted.",
        databaseConfigured: false,
        supabaseAuthConfigured: hasServerAuth(),
      },
      { status: 503 },
    );
  }

  const started = Date.now();

  try {
    const probe = await probeDatabase();
    const echoed = await echoParameterized("borynx-param-proof");
    const injection = await echoParameterized("'; drop table profiles; --");
    const tx = await proveTransaction();
    const lock = await proveAdvisoryLock();

    // Proves the driver is wired to a real client without issuing SQL.
    const driverPresent = typeof getDatabase === "function";

    // The identity boundary: a Supabase Auth UUID that Neon will key on.
    const session = await getServerSession();

    return NextResponse.json({
      status: "ok",
      databaseConfigured: true,
      driverPresent,
      driver: "drizzle-orm/node-postgres + pg Pool",
      roundTripMs: Date.now() - started,
      server: {
        version: probe.serverVersion,
        database: probe.database,
        currentUser: probe.currentUser,
        maxConnections: probe.maxConnections,
      },
      parameterizedQuery: {
        roundTrip: echoed === "borynx-param-proof",
        // Returned verbatim rather than executed — the whole point of bind params.
        injectionReturnedLiterally: injection === "'; drop table profiles; --",
      },
      transaction: {
        supported: tx.transactionId !== null,
        rolledBack: tx.rolledBack,
      },
      advisoryLock: {
        acquired: lock.acquired,
        reentrant: lock.reentrant,
      },
      identity: {
        supabaseAuthConfigured: hasServerAuth(),
        // Never the email — only whether an authenticated UUID is available.
        authUidPresent: Boolean(session?.uid),
      },
    });
  } catch (error) {
    // Drizzle wraps driver failures in its own error, so the actionable message
    // is on `cause` (e.g. "ECONNREFUSED"). Only the message string is surfaced —
    // never the stack, which can embed the connection string. Redaction is
    // applied as a second line of defence either way.
    const cause = (error as { cause?: Error }).cause;
    const redact = (text: string) =>
      text.replace(/postgres(ql)?:\/\/[^\s"']+/gi, "[redacted]");

    return NextResponse.json(
      {
        status: "error",
        message: (error as Error).name,
        detail: redact(cause?.message ?? (error as Error).message),
      },
      { status: 500 },
    );
  }
}
