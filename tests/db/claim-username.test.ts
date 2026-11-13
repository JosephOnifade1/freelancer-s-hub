/**
 * Atomic username claiming — unit tests (Phase 2B.3).
 *
 * Fake database: these prove the *decision logic* — outcome typing, validation,
 * ordering of the claim before the old-handle release, and that no uid can be
 * injected. Actual PostgreSQL contention is proven separately in
 * `identity-integration.test.ts`, because a fake cannot reproduce a real unique
 * constraint race.
 */
import { describe, it, expect, vi } from "vitest";

import { claimUsername, normalizeUsername } from "@/server/features/identity/claim-username";

const UID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

/**
 * A fake transactional database.
 *
 * `responses` scripts what each `execute` inside the transaction returns, in
 * call order: profile read, claim insert, delete old handle, update profile.
 */
function fakeTx(responses: Array<{ rows: unknown[] } | Error>) {
  const statements: string[] = [];
  let index = 0;
  const execute = vi.fn(async (query: unknown) => {
    const text = String(
      ((query as { queryChunks?: { value?: string[] }[] })?.queryChunks ?? [])
        .map((chunk) => chunk?.value?.[0] ?? "")
        .join(""),
    );
    statements.push(text.trim().split(/\s+/).slice(0, 3).join(" "));
    const next = responses[index++] ?? { rows: [] };
    if (next instanceof Error) throw next;
    return next;
  });
  return {
    statements,
    db: {
      transaction: async <T,>(run: (tx: { execute: typeof execute }) => Promise<T>) => run({ execute }),
    },
  };
}

describe("normalizeUsername", () => {
  it("accepts valid handles and lowercases them", () => {
    expect(normalizeUsername("ada_lovelace")).toBe("ada_lovelace");
    expect(normalizeUsername("  ADA  ")).toBe("ada");
    expect(normalizeUsername("a_1")).toBe("a_1");
    expect(normalizeUsername("x".repeat(15))).toBe("x".repeat(15));
  });

  it("rejects anything the database would reject", () => {
    for (const bad of ["ab", "x".repeat(16), "a-b", "a b", "ada.lovelace", "", "   ", "émile"]) {
      expect(normalizeUsername(bad), `expected "${bad}" to be rejected`).toBeNull();
    }
  });

  it("rejects non-strings rather than coercing them", () => {
    expect(normalizeUsername(null)).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
    expect(normalizeUsername(42)).toBeNull();
    expect(normalizeUsername({ username: "ada" })).toBeNull();
  });
});

describe("claimUsername", () => {
  it("rejects an invalid uid before touching the database", async () => {
    const { db, statements } = fakeTx([]);
    const result = await claimUsername(db, { uid: "not-a-uuid", desired: "ada" });

    expect(result.status).toBe("invalid");
    expect(statements).toHaveLength(0);
  });

  it("rejects an invalid handle before touching the database", async () => {
    const { db, statements } = fakeTx([]);
    const result = await claimUsername(db, { uid: UID, desired: "a-b" });

    expect(result.status).toBe("invalid");
    expect(statements).toHaveLength(0);
  });

  it("claims a free handle and moves the profile to it", async () => {
    const { db, statements } = fakeTx([
      { rows: [{ username: "user_111111" }] }, // current profile
      { rows: [] }, // release old handle
      { rows: [{ username: "ada" }] }, // claim won
      { rows: [] }, // update profile
    ]);

    const result = await claimUsername(db, { uid: UID, desired: "ada" });

    expect(result).toEqual({ status: "claimed", username: "ada" });
    // The old handle is released before the new claim: `usernames(uid)` is
    // UNIQUE, so a user cannot hold two registry rows at once. Both statements
    // share one transaction, so a losing claim still rolls the delete back.
    expect(statements[1]).toMatch(/^delete from usernames/);
    expect(statements[2]).toMatch(/^insert into usernames/);
    expect(statements[3]).toMatch(/^update profiles/);
  });

  it("returns `taken` when the claim loses", async () => {
    const { db, statements } = fakeTx([
      { rows: [{ username: "user_111111" }] },
      { rows: [] }, // release old handle
      { rows: [] }, // conflict: zero rows back
    ]);

    const result = await claimUsername(db, { uid: UID, desired: "popular" });

    expect(result).toEqual({ status: "taken" });
    // The delete did run, but it is rolled back with the transaction, so the
    // caller keeps their previous handle. Asserted end-to-end against real
    // PostgreSQL in identity-integration.test.ts ("refuses a handle owned by
    // somebody else, leaving both users intact").
    expect(statements.some((s) => s.startsWith("update"))).toBe(false);
  });

  it("is a no-op when the handle is already the caller's", async () => {
    const { db, statements } = fakeTx([{ rows: [{ username: "ada" }] }]);

    const result = await claimUsername(db, { uid: UID, desired: "ada" });

    expect(result).toEqual({ status: "same", username: "ada" });
    // Only the profile read; no insert, no delete, no update.
    expect(statements).toHaveLength(1);
  });

  it("refuses to claim for a user with no profile", async () => {
    const { db, statements } = fakeTx([{ rows: [] }]);
    const result = await claimUsername(db, { uid: OTHER, desired: "ada" });

    expect(result).toEqual({ status: "profile_missing" });
    expect(statements).toHaveLength(1);
  });

  it("returns `failed` without leaking driver details", async () => {
    const { db } = fakeTx([
      new Error('connect ECONNREFUSED postgres://user:secret@host/db'),
    ]);

    const result = await claimUsername(db, { uid: UID, desired: "ada" });

    expect(result).toEqual({ status: "failed" });
    expect(JSON.stringify(result)).not.toContain("postgres://");
    expect(JSON.stringify(result)).not.toContain("secret");
  });

  it("cannot claim on behalf of another user: uid is the only target", async () => {
    // There is no second uid parameter to abuse. The statement must use the
    // caller's uid and the caller's current handle for the release.
    const captured: unknown[][] = [];
    const db = {
      transaction: async <T,>(run: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<T>) =>
        run({
          execute: async (query: unknown) => {
            const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
            captured.push(
              chunks
                .filter((chunk) => chunk?.constructor?.name !== "StringChunk")
                .map((chunk) => (chunk === null || chunk === undefined ? null : chunk)),
            );
            if (captured.length === 1) return { rows: [{ username: "old_handle" }] };
            if (captured.length === 2) return { rows: [{ username: "new_handle" }] };
            return { rows: [] };
          },
        }),
    };

    await claimUsername(db as never, { uid: UID, desired: "new_handle" });

    // Every statement that carries a uid uses the caller's.
    const uidBearing = captured.filter((params) => params.includes(UID));
    expect(uidBearing.length).toBeGreaterThan(0);
    expect(captured.some((params) => params.includes(OTHER))).toBe(false);
    // The release targets the caller's *previous* handle, scoped by uid.
    expect(captured[1]).toEqual(["old_handle", UID]);
  });
});
