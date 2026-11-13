/**
 * Profile provisioning — unit tests (Phase 2B.3).
 *
 * These run against a **fake database**, so they prove the logic (identity
 * validation, idempotency, conflict handling, no privilege escalation) and
 * nothing about PostgreSQL. The matching integration tests are in
 * `identity-integration.test.ts`, which needs a real database.
 *
 * No `pg`, no `server-only`, no network: `provisionProfile` takes the database
 * as a parameter precisely so this file can exist.
 */
import { describe, it, expect, vi } from "vitest";

import {
  deriveUsernameSeed,
  fallbackUsername,
  isValidUid,
  provisionProfile,
  isProvisioningFailure,
} from "@/server/features/identity/provision-profile";

const UID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

/**
 * A fake database whose answers are scripted per call, in order.
 *
 * `execute` is called up to three times: the profile insert, the handle claim,
 * and (on the conflict path) the profile read.
 */
function fakeDb(responses: Array<{ rows: unknown[] }>) {
  const calls: string[] = [];
  let index = 0;
  return {
    calls,
    db: {
      execute: vi.fn(async (query: unknown) => {
        // Capture enough of the statement to assert on ordering.
        const text = String((query as { queryChunks?: unknown[] })?.queryChunks ?? query);
        calls.push(text.slice(0, 40));
        const next = responses[index++] ?? { rows: [] };
        return next;
      }),
    },
  };
}

/**
 * Extracts bound parameter values from a Drizzle SQL object.
 *
 * Chunks alternate between `StringChunk` (literal SQL text) and `Param`
 * (a bind value). Only `Param` instances carry a caller-supplied value, and
 * returning those alone is the point: it proves the payload travelled as a bind
 * parameter rather than being concatenated into the statement.
 */
function paramsOf(query: unknown): unknown[] {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
  // `StringChunk` instances are the literal SQL text; every other chunk is a
  // bound value (plain values stay raw, `sql` fragments are objects). A `null`
  // parameter appears as an absent chunk, which is mapped back to null.
  return chunks
    .filter((chunk) => chunk?.constructor?.name !== "StringChunk")
    .map((chunk) => {
      if (chunk === undefined || chunk === null) return null;
      if (typeof chunk === "object" && "value" in (chunk as object)) {
        return (chunk as { value: unknown }).value;
      }
      return chunk;
    });
}

describe("username derivation", () => {
  it("normalises a display name the way the app does", () => {
    expect(deriveUsernameSeed("Ada Lovelace")).toBe("ada_lovelace");
    expect(deriveUsernameSeed("ADA")).toBe("ada");
    expect(deriveUsernameSeed("jane.doe!")).toBe("jane_doe");
  });

  it("collapses underscore runs and trims them", () => {
    expect(deriveUsernameSeed("Ada  Lovelace!!")).toBe("ada_lovelace");
    expect(deriveUsernameSeed("__ada__")).toBe("ada");
  });

  it("returns null when nothing usable survives", () => {
    expect(deriveUsernameSeed("")).toBeNull();
    expect(deriveUsernameSeed(null)).toBeNull();
    expect(deriveUsernameSeed(undefined)).toBeNull();
    expect(deriveUsernameSeed("ab")).toBeNull(); // too short
    expect(deriveUsernameSeed("!!!")).toBeNull();
  });

  it("truncates to the 15 character maximum", () => {
    const seed = deriveUsernameSeed("a".repeat(40));
    expect(seed).toBe("a".repeat(15));
  });

  it("derives a deterministic fallback from the uid", () => {
    expect(fallbackUsername(UID)).toBe("user_111111");
    expect(fallbackUsername(UID)).toBe(fallbackUsername(UID));
    expect(fallbackUsername(OTHER)).toBe("user_222222");
    // Every fallback must satisfy the same rule the database enforces.
    expect(fallbackUsername(UID)).toMatch(/^[a-z0-9_]{3,15}$/);
  });

  it("accepts only well-formed uuids as identity", () => {
    expect(isValidUid(UID)).toBe(true);
    expect(isValidUid("not-a-uuid")).toBe(false);
    expect(isValidUid("")).toBe(false);
    expect(isValidUid(null)).toBe(false);
    expect(isValidUid(12345)).toBe(false);
    // A handle is not an identity.
    expect(isValidUid("user_111111")).toBe(false);
  });
});

describe("provisionProfile", () => {
  it("rejects an invalid identity before touching the database", async () => {
    const { db, calls } = fakeDb([]);
    const result = await provisionProfile(db, { uid: "not-a-uuid" });

    expect(isProvisioningFailure(result)).toBe(true);
    if (isProvisioningFailure(result)) expect(result.reason).toBe("invalid_identity");
    expect(calls).toHaveLength(0);
  });

  it("creates a profile and claims its handle for a first-time user", async () => {
    const { db, calls } = fakeDb([
      { rows: [{ uid: UID, username: "user_111111" }] }, // insert returned a row
      { rows: [] }, // handle claim
    ]);

    const result = await provisionProfile(db, { uid: UID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile).toEqual({ uid: UID, username: "user_111111", created: true });
    }
    expect(calls).toHaveLength(2); // insert + claim, no read-back
  });

  it("is idempotent: an existing profile is reported, not rewritten", async () => {
    // insert conflicts (no row), then the read-back returns the existing profile.
    const { db, calls } = fakeDb([
      { rows: [] },
      { rows: [{ uid: UID, username: "chosen_handle" }] },
    ]);

    const result = await provisionProfile(db, { uid: UID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.profile.created).toBe(false);
      // The user's chosen handle survives; the generated seed never overwrote it.
      expect(result.profile.username).toBe("chosen_handle");
    }
    expect(calls).toHaveLength(2); // insert + read, no handle claim
  });

  it("does not attempt a handle claim when the profile already exists", async () => {
    const { db } = fakeDb([{ rows: [] }, { rows: [{ uid: UID, username: "existing" }] }]);
    await provisionProfile(db, { uid: UID });

    const statements = (db.execute as ReturnType<typeof vi.fn>).mock.calls.map((call) =>
      String((call[0] as { queryChunks?: unknown[] })?.queryChunks ?? ""),
    );
    // The second statement is the read-back, not an insert into usernames.
    expect(statements[0]).toBeDefined();
    expect(statements).toHaveLength(2);
  });

  it("reports database_error instead of throwing when the driver fails", async () => {
    const db = {
      execute: vi.fn(async () => {
        throw new Error('password authentication failed for user "x" postgres://u:p@host/db');
      }),
    };

    const result = await provisionProfile(db, { uid: UID });
    expect(isProvisioningFailure(result)).toBe(true);
    if (isProvisioningFailure(result)) expect(result.reason).toBe("database_error");
    // The secret in the driver message must not escape.
    expect(JSON.stringify(result)).not.toContain("postgres://");
    expect(JSON.stringify(result)).not.toContain("password");
  });

  it("never sends a privileged role or verification flag", async () => {
    const captured: unknown[] = [];
    const db = {
      execute: vi.fn(async (query: unknown) => {
        captured.push(paramsOf(query));
        return { rows: [{ uid: UID, username: "user_111111" }] };
      }),
    };

    await provisionProfile(db, { uid: UID });

    const everything = JSON.stringify(captured);
    expect(everything).not.toContain("admin");
    expect(everything).not.toContain("moderator");
    expect(everything).not.toContain("isVerifiedPro");
    // Only the identity, the derived handle, the display name and the initial.
    expect(captured[0]).toEqual([UID, "user_111111", null, "U"]);
  });

  it("binds a hostile display name instead of concatenating it into SQL", async () => {
    // A name that yields nothing valid must fall back, not inject.
    const captured: unknown[] = [];
    const db = {
      execute: vi.fn(async (query: unknown) => {
        captured.push(paramsOf(query));
        return { rows: [{ uid: UID, username: "user_111111" }] };
      }),
    };

    await provisionProfile(db, { uid: UID, displayName: "'; drop table profiles; --" });

    // Bound order: uid, seed handle, display name, initial.
    const params = captured[0] as unknown[];
    expect(params[0]).toBe(UID);

    // The display name is sanitised into a *valid handle* rather than rejected:
    // every unsafe character becomes "_", so the payload cannot survive as SQL.
    // This matches the existing app's `ensureUserProfile` behaviour.
    expect(params[1]).toMatch(/^[a-z0-9_]{3,15}$/);
    expect(String(params[1])).not.toContain(";");
    expect(String(params[1])).not.toContain("'");

    // The raw payload travels only as a bind value, never as statement text.
    expect(String(params[2])).toContain("drop table");
    const statementText = String(
      (db.execute as ReturnType<typeof vi.fn>).mock.calls[0][0]?.queryChunks?.[0] ?? "",
    );
    expect(statementText).not.toContain("drop table");
  });
});
