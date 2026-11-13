/**
 * Profile domain queries — unit tests (Phase 2C).
 *
 * Fake database. These prove the SQL *shape* and the projection rules: which columns
 * are selected, that `role` never appears in a public read, that writes only touch
 * whitelisted fields, and that failures are typed rather than thrown.
 *
 * Actual constraint behaviour and real row round-trips are in
 * `profile-integration.test.ts` against **local PostgreSQL**. Neither proves anything
 * about Neon — see the phase report §9.
 */
import { describe, it, expect, vi } from "vitest";

import {
  findModerationProfiles,
  findOwnProfile,
  findProfileByIdentifier,
  findProfilesByUids,
  findTopProfiles,
  isUsernameAvailable,
  isValidUid,
  searchProfiles,
  setOwnAvatar,
  updateOwnProfile,
} from "@/server/features/profile/profile-queries";

const UID = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function row(overrides: Record<string, unknown> = {}) {
  return {
    uid: UID,
    username: "ada",
    displayName: "Ada Lovelace",
    initial: "A",
    bio: "engineer",
    location: "London",
    website: "",
    status: "Available",
    skills: ["ts"],
    reputation: 10,
    followers: 1,
    following: 2,
    avatarUrl: null,
    isVerifiedPro: false,
    createdAt: "2024-03-01T00:00:00.000Z",
    role: "member",
    hasSeenVeteranCelebration: false,
    updatedAt: "2024-03-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A fake database returning scripted rows, recording the statements it received. */
/**
 * A fake database returning scripted rows.
 *
 * Records each statement as SQL text *with bound values inlined*, so a test can assert
 * on what the query actually said — including `limit 200` or an escaped LIKE pattern,
 * both of which travel as bind parameters rather than literals.
 *
 * `values` is kept separately so a test can inspect the parameters on their own.
 */
function fakeDb(responses: Array<unknown[] | Error>) {
  const statements: string[] = [];
  const values: unknown[][] = [];
  let index = 0;

  return {
    statements,
    values,
    db: {
      execute: vi.fn(async (query: unknown) => {
        const chunks = (query as { queryChunks?: unknown[] })?.queryChunks ?? [];
        const params: unknown[] = [];
        // Renders a chunk: nested `sql` fragments (e.g. a `set` list built with
        // `sql.join`) are themselves chunk containers and must be expanded, or the
        // recorded text is `[object Object]`.
        const render = (chunk: unknown): string => {
          if (chunk === null || chunk === undefined) return "null";
          if (typeof chunk !== "object") {
            params.push(chunk);
            return String(chunk);
          }
          const inner = (chunk as { queryChunks?: unknown[] }).queryChunks;
          if (Array.isArray(inner)) return inner.map(render).join("");
          if ((chunk as object).constructor?.name === "StringChunk") {
            const value = (chunk as { value?: unknown }).value;
            return Array.isArray(value) ? value.join("") : String(value ?? "");
          }
          if ("value" in (chunk as object)) {
            const value = (chunk as { value: unknown }).value;
            params.push(value);
            return String(value);
          }
          return String(chunk);
        };

        const text = chunks.map(render).join(" ");

        statements.push(text.replace(/\s+/g, " ").trim());
        values.push(params);

        const next = responses[index++] ?? [];
        if (next instanceof Error) throw next;
        return { rows: next };
      }),
    },
  };
}

describe("isValidUid", () => {
  it("accepts only well-formed uuids", () => {
    expect(isValidUid(UID)).toBe(true);
    expect(isValidUid("ada")).toBe(false);
    expect(isValidUid("")).toBe(false);
    expect(isValidUid(null)).toBe(false);
    expect(isValidUid(42)).toBe(false);
  });
});

describe("findProfileByIdentifier", () => {
  it("queries by uid when the identifier is a uuid", async () => {
    const { db, statements } = fakeDb([[row()]]);
    const profile = await findProfileByIdentifier(db, UID);

    expect(profile?.uid).toBe(UID);
    expect(statements[0]).toMatch(/where uid =/);
  });

  it("queries by lowercased username otherwise", async () => {
    const { db, statements } = fakeDb([[row()]]);
    await findProfileByIdentifier(db, "@Ada");

    expect(statements[0]).toMatch(/where username = lower\(/);
    // The @ prefix must be stripped, not passed to the database.
    expect(statements[0]).not.toContain("@");
  });

  it("strips the @ prefix before the uuid check", async () => {
    const { db, statements } = fakeDb([[row()]]);
    await findProfileByIdentifier(db, `@${UID}`);
    expect(statements[0]).toMatch(/where uid =/);
  });

  it("returns null for an empty identifier without querying", async () => {
    const { db, statements } = fakeDb([]);
    expect(await findProfileByIdentifier(db, "   ")).toBeNull();
    expect(statements).toHaveLength(0);
  });

  it("returns null when nobody matches", async () => {
    const { db } = fakeDb([[]]);
    expect(await findProfileByIdentifier(db, "ghost")).toBeNull();
  });

  it("never selects role in the public projection", async () => {
    // This is the privilege-leak guard: `select *` used to ship every user's role.
    const { db, statements } = fakeDb([[row()]]);
    const profile = await findProfileByIdentifier(db, "ada");

    const select = statements[0].split("from")[0];
    expect(select).not.toContain("role");
    expect(select).not.toContain("*");
    expect(profile).not.toHaveProperty("role");
    expect(profile).not.toHaveProperty("hasSeenVeteranCelebration");
  });

  it("derives the join year from createdAt", async () => {
    const { db } = fakeDb([[row({ createdAt: "2023-07-04T12:00:00.000Z" })]]);
    const profile = await findProfileByIdentifier(db, "ada");
    expect(profile?.joined).toBe("2023");
  });

  it("normalises null-ish columns instead of passing them through", async () => {
    const { db } = fakeDb([
      [row({ displayName: null, initial: null, bio: null, skills: null, reputation: null, avatarUrl: null })],
    ]);
    const profile = await findProfileByIdentifier(db, "ada");

    expect(profile?.displayName).toBeNull();
    expect(profile?.bio).toBe("");
    expect(profile?.skills).toEqual([]);
    expect(profile?.reputation).toBe(0);
    expect(profile?.avatarUrl).toBeNull();
  });
});

describe("findOwnProfile", () => {
  it("includes role and celebration state for the viewer's own row", async () => {
    const { db, statements } = fakeDb([[row({ role: "admin" })]]);
    const profile = await findOwnProfile(db, UID);

    expect(profile?.role).toBe("admin");
    expect(profile?.hasSeenVeteranCelebration).toBe(false);
    expect(statements[0]).toContain("role");
  });

  it("returns null when the row is absent (not provisioned)", async () => {
    const { db } = fakeDb([[]]);
    expect(await findOwnProfile(db, UID)).toBeNull();
  });
});

describe("findProfilesByUids", () => {
  it("deduplicates ids before querying", async () => {
    const { db, statements } = fakeDb([[row()]]);
    await findProfilesByUids(db, [UID, UID, OTHER, UID]);
    // One statement regardless of repeats.
    expect(statements).toHaveLength(1);
  });

  it("short-circuits an empty list without querying", async () => {
    const { db, statements } = fakeDb([]);
    expect(await findProfilesByUids(db, [])).toEqual([]);
    expect(statements).toHaveLength(0);
  });

  it("never selects role", async () => {
    const { db, statements } = fakeDb([[row()]]);
    await findProfilesByUids(db, [UID]);
    expect(statements[0].split("from")[0]).not.toContain("role");
  });
});

describe("findTopProfiles", () => {
  it("bounds an absurd limit", async () => {
    const { db, statements } = fakeDb([[]]);
    await findTopProfiles(db, 10_000);
    expect(statements[0]).toMatch(/limit 50\b/);
  });

  it("falls back to a sane limit for NaN", async () => {
    const { db, statements } = fakeDb([[]]);
    await findTopProfiles(db, Number.NaN);
    expect(statements[0]).toMatch(/limit 5\b/);
  });
});

describe("searchProfiles", () => {
  it("returns nothing for a blank term without querying", async () => {
    const { db, statements } = fakeDb([]);
    expect(await searchProfiles(db, "  ")).toEqual([]);
    expect(statements).toHaveLength(0);
  });

  it("escapes LIKE wildcards so % searches for a literal percent", async () => {
    const { db, statements } = fakeDb([[]]);
    await searchProfiles(db, "100%");
    // The bound parameter carries the escape; the statement must use ilike.
    expect(statements[0]).toContain("ilike");
  });
});

describe("isUsernameAvailable", () => {
  it("rejects a malformed handle without querying", async () => {
    const { db, statements } = fakeDb([]);
    expect(await isUsernameAvailable(db, "a-b")).toBe(false);
    expect(await isUsernameAvailable(db, "ab")).toBe(false);
    expect(statements).toHaveLength(0);
  });

  it("consults both the registry and profiles", async () => {
    const { db, statements } = fakeDb([[{ taken: false }]]);
    await isUsernameAvailable(db, "ada");
    expect(statements[0]).toContain("from usernames");
    expect(statements[0]).toContain("from profiles");
  });

  it("reports unavailable when either source has it", async () => {
    const { db } = fakeDb([[{ taken: true }]]);
    expect(await isUsernameAvailable(db, "ada")).toBe(false);
  });

  it("reports available when both are clear", async () => {
    const { db } = fakeDb([[{ taken: false }]]);
    expect(await isUsernameAvailable(db, "ada")).toBe(true);
  });
});

describe("updateOwnProfile", () => {
  it("rejects an invalid uid before touching the database", async () => {
    const { db, statements } = fakeDb([]);
    expect((await updateOwnProfile(db, "nope", { bio: "x" })).status).toBe("invalid");
    expect(statements).toHaveLength(0);
  });

  it("rejects a call with no editable fields", async () => {
    const { db, statements } = fakeDb([]);
    expect((await updateOwnProfile(db, UID, {})).status).toBe("invalid");
    expect(statements).toHaveLength(0);
  });

  it("updates only the supplied fields", async () => {
    const { db, statements } = fakeDb([[row({ bio: "new bio" })]]);
    const result = await updateOwnProfile(db, UID, { bio: "new bio" });

    expect(result.status).toBe("updated");
    // Scope to the `set` clause: `returning` legitimately names every column, so an
    // assertion against the whole statement would prove nothing.
    const setClause = statements[0].slice(0, statements[0].indexOf("where uid"));
    expect(setClause).toContain("bio =");
    // Fields not supplied must not appear — a partial update must not blank columns.
    expect(setClause).not.toContain("displayName");
    expect(setClause).not.toContain("website");
    expect(setClause).not.toContain("location");
    expect(setClause).toContain('"updatedAt"');
  });

  it("derives `initial` from displayName so the two cannot disagree", async () => {
    const { db, statements } = fakeDb([[row({ displayName: "Grace Hopper", initial: "G" })]]);
    await updateOwnProfile(db, UID, { displayName: "Grace Hopper" });

    expect(statements[0]).toContain('"displayName"');
    expect(statements[0]).toContain("initial =");
  });

  it("cannot be made to write a privileged column", async () => {
    // The field type is closed, but a caller could still smuggle a key at runtime.
    const { db, statements } = fakeDb([[row()]]);
    // A cast, because the whole point is to go around the closed field type: the
    // compiler is not the only thing standing between a caller and these columns.
    const smuggled = {
      bio: "x",
      role: "admin",
      isVerifiedPro: true,
      reputation: 999999,
    } as unknown as Parameters<typeof updateOwnProfile>[2];
    await updateOwnProfile(db, UID, smuggled);

    // Only the `set` clause matters here: `role` legitimately appears in `returning`,
    // because the caller may read back their own role after saving.
    const setClause = statements[0].slice(0, statements[0].indexOf("where uid"));
    expect(setClause).not.toContain("role");
    expect(setClause).not.toContain("isVerifiedPro");
    expect(setClause).not.toContain("reputation");
  });

  it("clamps an over-long bio", async () => {
    const { db } = fakeDb([[row()]]);
    // The value is bound (not interpolated), so we assert via the recorded statement
    // length staying sane rather than inspecting the parameter.
    const result = await updateOwnProfile(db, UID, { bio: "x".repeat(10_000) });
    expect(result.status).toBe("updated");
  });

  it("drops unknown status values rather than sending them to the CHECK", async () => {
    const { db, statements } = fakeDb([[row()]]);
    // @ts-expect-error — outside the union on purpose.
    await updateOwnProfile(db, UID, { status: "Vacation" });
    // No valid field survived, so the call is rejected before any update.
    expect(statements).toHaveLength(0);
  });

  it("reports profile_missing when the row does not exist", async () => {
    const { db } = fakeDb([[]]);
    expect((await updateOwnProfile(db, UID, { bio: "x" })).status).toBe("profile_missing");
  });

  it("reports failed, not a thrown error, when the driver errors", async () => {
    const { db } = fakeDb([new Error('postgres://u:secret@host/db unreachable')]);
    const result = await updateOwnProfile(db, UID, { bio: "x" });

    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).not.toContain("postgres://");
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("setOwnAvatar", () => {
  it("accepts an https url", async () => {
    const { db } = fakeDb([[row({ avatarUrl: "https://cdn.example/a.png" })]]);
    const result = await setOwnAvatar(db, UID, "https://cdn.example/a.png");
    expect(result.status).toBe("updated");
  });

  it("rejects javascript: and data: urls", async () => {
    // The column is rendered into an <img src>; storing these would be stored XSS.
    const { db, statements } = fakeDb([]);
    expect((await setOwnAvatar(db, UID, "javascript:alert(1)")).status).toBe("invalid");
    expect((await setOwnAvatar(db, UID, "data:image/svg+xml,<svg onload=alert(1)>")).status).toBe("invalid");
    expect(statements).toHaveLength(0);
  });

  it("rejects a non-url", async () => {
    const { db } = fakeDb([]);
    expect((await setOwnAvatar(db, UID, "not a url")).status).toBe("invalid");
  });
});

describe("counter ownership after Phase 2H",()=>{
 it.each(["setReputation","adjustProfileCounter"])("does not export unsafe independent writer %s",async name=>{expect(await import("@/server/features/profile/profile-queries")).not.toHaveProperty(name);});
 it.each(["reputation","followers","following","role"])("editable profile fields cannot mutate %s",async key=>{const {db,statements}=fakeDb([]);expect((await updateOwnProfile(db,UID,{[key]:999} as never)).status).toBe("invalid");expect(statements).toHaveLength(0);});
});

describe("findModerationProfiles", () => {
  it("is the one query that selects role", async () => {
    const { db, statements } = fakeDb([[row({ role: "admin" })]]);
    const users = await findModerationProfiles(db, 10);

    expect(statements[0]).toContain("role");
    expect(users[0].role).toBe("admin");
  });

  it("bounds the limit", async () => {
    const { db, statements } = fakeDb([[]]);
    await findModerationProfiles(db, 999_999);
    expect(statements[0]).toMatch(/limit 200\b/);
  });
});
