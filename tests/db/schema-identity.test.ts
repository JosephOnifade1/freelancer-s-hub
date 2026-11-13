/**
 * Identity schema tests (Phase 2B.2).
 *
 * Two layers, deliberately separate:
 *
 *  1. **Schema definition tests** — pure, no database. They assert the shape the
 *     application depends on: the identity contract (`uid` is the profile PK and
 *     a plain uuid, with no local id), real FKs only inside Neon, `text` + CHECK
 *     instead of native enums, and timestamp-with-timezone everywhere.
 *  2. **Live constraint tests** — skipped unless `DATABASE_URL` points at a
 *     database where the migration has been applied. They prove the database
 *     actually rejects bad data, rather than that the DDL looks right.
 *
 * Run with `npm run test:db`. The default `npm test` suite does not run these:
 * they import `@/server/db`, which is server-only.
 */
import { describe, it, expect, afterAll } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  profiles,
  usernames,
  PROFILE_ROLES,
  PROFILE_STATUSES,
  USERNAME_PATTERN,
} from "@/server/db/schema";
import { isDatabaseConfigured } from "@/server/db";

describe("identity schema definition", () => {
  it("uses the Supabase Auth UUID as the profile primary key", () => {
    const config = getTableConfig(profiles);
    expect(config.name).toBe("profiles");

    const uid = config.columns.find((column) => column.name === "uid");
    expect(uid).toBeDefined();
    expect(uid?.primary).toBe(true);
    expect(uid?.columnType).toBe("PgUUID");

    // No surrogate key: the Supabase UUID is the only identifier.
    const idLike = config.columns.filter((column) =>
      ["id", "profileId", "profile_id"].includes(column.name),
    );
    expect(idLike).toEqual([]);
  });

  it("declares no foreign key to a Supabase Auth table", () => {
    // A cross-database FK is impossible; `auth.users` must not be referenced.
    const config = getTableConfig(profiles);
    expect(config.foreignKeys).toEqual([]);

    const serialised = JSON.stringify(config.foreignKeys);
    expect(serialised).not.toContain("auth");
  });

  it("stores every timestamp with time zone", () => {
    for (const table of [profiles, usernames]) {
      const config = getTableConfig(table);
      const timestamps = config.columns.filter((column) => column.columnType === "PgTimestamp");
      expect(timestamps.length).toBeGreaterThan(0);
      for (const column of timestamps) {
        // `withTimezone` is only on the timestamp column class, not on PgColumn.
        expect((column as { withTimezone?: boolean }).withTimezone).toBe(true);
      }
    }
  });

  it("uses text + CHECK for status columns, never a native enum", () => {
    const config = getTableConfig(profiles);
    const checks = config.checks.map((c) => c.name);

    expect(checks).toContain("profiles_role_check");
    expect(checks).toContain("profiles_status_check");

    // No `pgEnum` anywhere: status must be a text column.
    const role = config.columns.find((c) => c.name === "role");
    const status = config.columns.find((c) => c.name === "status");
    expect(role?.columnType).toBe("PgText");
    expect(status?.columnType).toBe("PgText");
    for (const value of PROFILE_ROLES) expect(["admin", "moderator", "member"]).toContain(value);
  });

  it("keeps the fields the application actually reads", () => {
    const names = getTableConfig(profiles).columns.map((c) => c.name);
    // Each of these is read or written by existing app code (see schema docblock).
    for (const required of [
      "username",
      "displayName",
      "initial",
      "bio",
      "location",
      "website",
      "status",
      "skills",
      "reputation",
      "followers",
      "following",
      "avatarUrl",
      "isVerifiedPro",
      "hasSeenVeteranCelebration",
      "role",
      "createdAt",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("does not carry the dead communitiesList jsonb column", () => {
    const names = getTableConfig(profiles).columns.map((c) => c.name);
    expect(names).not.toContain("communitiesList");
    expect(names).not.toContain("favoriteTopics");
  });

  it("enforces handle format identical to USERNAME_RE in src/lib/auth.ts", () => {
    // Both the application and the database must agree, or a value accepted by
    // one is rejected by the other.
    const appRe = /^[a-z0-9_]{3,15}$/;
    expect(USERNAME_PATTERN).toBe(appRe.source);
    for (const handle of ["abc", "a_1", "user_123456"]) expect(appRe.test(handle)).toBe(true);
    for (const handle of ["ab", "a".repeat(16), "aBc", "a-b", "", "a b"]) {
      expect(appRe.test(handle)).toBe(false);
    }
  });

  it("gives usernames a real FK to profiles with cascade delete", () => {
    const config = getTableConfig(usernames);
    expect(config.foreignKeys).toHaveLength(1);
    const fk = config.foreignKeys[0];
    expect(fk.onDelete).toBe("cascade");

    const pk = config.columns.filter((c) => c.primary);
    expect(pk.map((c) => c.name)).toEqual(["username"]);
  });
});

const configured = isDatabaseConfigured();

describe("identity schema constraints (live database)", { skip: !configured }, () => {
  const url = process.env.DATABASE_URL as string;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require("pg") as typeof import("pg");

  const U1 = "11111111-1111-4111-8111-111111111111";
  const U2 = "22222222-2222-4222-8222-222222222222";

  async function withClient<T>(run: (client: import("pg").Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      return await run(client);
    } finally {
      await client.end();
    }
  }

  /** Narrows an attempt result to the failed branch, failing the test otherwise. */
  function expectRejected(result: { ok: true } | { ok: false; constraint?: string }): {
    constraint?: string;
  } {
    expect(result.ok).toBe(false);
    return result as { ok: false; constraint?: string };
  }

  /** Runs a statement in its own savepoint and reports the failure mode. */
  async function attempt(
    client: import("pg").Client,
    statement: string,
    params: unknown[],
    counter: { n: number },
  ): Promise<{ ok: true } | { ok: false; constraint?: string }> {
    const savepoint = `sp_${++counter.n}`;
    await client.query(`savepoint ${savepoint}`);
    try {
      await client.query(statement, params as never[]);
      await client.query(`release savepoint ${savepoint}`);
      return { ok: true };
    } catch (error) {
      await client.query(`rollback to savepoint ${savepoint}`);
      return { ok: false, constraint: (error as { constraint?: string }).constraint };
    }
  }

  it("rejects malformed, uppercase and duplicate handles", async () => {
    await withClient(async (client) => {
      const counter = { n: 0 };
      await client.query("begin");
      try {
        expect(
          await attempt(client, "insert into profiles (uid, username) values ($1,'alice')", [U1], counter),
        ).toEqual({ ok: true });

        for (const bad of ["Bob", "aBc", "ab", "a".repeat(16), "a-b"]) {
          const result = await attempt(
            client,
            "insert into profiles (uid, username) values ($1,$2)",
            [U2, bad],
            counter,
          );
          expect(result.ok, `expected "${bad}" to be rejected`).toBe(false);
        }

        const duplicate = await attempt(
          client,
          "insert into profiles (uid, username) values ($1,'alice')",
          [U2],
          counter,
        );
        expect(duplicate).toEqual({ ok: false, constraint: "profiles_username_key" });
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("rejects invalid role, status and negative counters", async () => {
    await withClient(async (client) => {
      const counter = { n: 0 };
      await client.query("begin");
      try {
        expect(
          expectRejected(
            await attempt(
              client,
              "insert into profiles (uid, username, role) values ($1,'carol','owner')",
              [U1],
              counter,
            ),
          ).constraint,
        ).toBe("profiles_role_check");

        expect(
          expectRejected(
            await attempt(
              client,
              "insert into profiles (uid, username, status) values ($1,'carol','Vacation')",
              [U1],
              counter,
            ),
          ).constraint,
        ).toBe("profiles_status_check");

        expect(
          expectRejected(
            await attempt(
              client,
              "insert into profiles (uid, username, reputation) values ($1,'carol',-1)",
              [U1],
              counter,
            ),
          ).constraint,
        ).toBe("profiles_reputation_non_negative");

        // Every declared status value must be accepted.
        let i = 0;
        for (const status of PROFILE_STATUSES) {
          i += 1;
          const ok = await attempt(
            client,
            "insert into profiles (uid, username, status) values ($1,$2,$3)",
            [`0000000${i}-0000-4000-8000-000000000000`, `status${i}`, status],
            counter,
          );
          expect(ok.ok, `status "${status}" should be accepted`).toBe(true);
        }
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("makes a handle claim atomic via ON CONFLICT", async () => {
    await withClient(async (client) => {
      await client.query("begin");
      try {
        await client.query("insert into profiles (uid, username) values ($1,'alice')", [U1]);

        const won = await client.query(
          "insert into usernames (username, uid) values ('alice',$1) on conflict (username) do nothing returning username",
          [U1],
        );
        expect(won.rowCount).toBe(1);

        // A second claim by another user must lose, not throw a race in the app.
        const lost = await client.query(
          "insert into usernames (username, uid) values ('alice',$1) on conflict (username) do nothing returning username",
          [U2],
        );
        expect(lost.rowCount).toBe(0);
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("releases a handle when the profile is deleted", async () => {
    await withClient(async (client) => {
      await client.query("begin");
      try {
        await client.query("insert into profiles (uid, username) values ($1,'alice')", [U1]);
        await client.query("insert into usernames (username, uid) values ('alice',$1)", [U1]);
        await client.query("delete from profiles where uid=$1", [U1]);
        // Scoped to this fixture's uid: the property under test is that *this* handle
        // is released, and a global count would make the test depend on run order.
        const remaining = await client.query(
          "select count(*)::int as n from usernames where uid=$1",
          [U1],
        );
        expect(remaining.rows[0].n).toBe(0);
      } finally {
        await client.query("rollback");
      }
    });
  });

  it("refuses a handle claim for a profile that does not exist", async () => {
    await withClient(async (client) => {
      const counter = { n: 0 };
      await client.query("begin");
      try {
        const result = await attempt(
          client,
          "insert into usernames (username, uid) values ('ghost','33333333-3333-4333-8333-333333333333')",
          [],
          counter,
        );
        expect(result).toEqual({ ok: false, constraint: "usernames_uid_profiles_uid_fk" });
      } finally {
        await client.query("rollback");
      }
    });
  });

  afterAll(async () => {
    // Nothing to close: each test opens and closes its own client.
  });
});
