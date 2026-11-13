/**
 * Phase 2B.4 — provisioning state machine (pure unit tests).
 *
 * No React, no fetch, no database. These pin the *policy*: which outcome maps to
 * which state, when an automatic retry is allowed, and that a database failure
 * can never be represented as "signed out". The provider that consumes this is
 * covered in `phase2b.4-provisioning-recovery.test.tsx`.
 */
import { describe, expect, it } from "vitest";

import {
  INITIAL_PROVISIONING,
  MAX_AUTOMATIC_ATTEMPTS,
  RETRY_COOLDOWN_MS,
  needsProvisioning,
  nextProvisioningState,
  provisioningMessage,
  shouldAttemptAutomatically,
  type ProvisioningState,
} from "@/lib/provisioning-state";

describe("initial state", () => {
  it("starts pending with no attempts", () => {
    expect(INITIAL_PROVISIONING).toEqual({ status: "pending", attempts: 0 });
  });

  it("pending and failed both need the server; ready does not", () => {
    expect(needsProvisioning({ status: "pending", attempts: 0 })).toBe(true);
    expect(needsProvisioning({ status: "failed", reason: "unavailable", attempts: 1 })).toBe(true);
    expect(needsProvisioning({ status: "ready", attempts: 1 })).toBe(false);
  });
});

describe("outcome → state", () => {
  it("a created profile is ready", () => {
    const next = nextProvisioningState(INITIAL_PROVISIONING, { status: "created" });
    expect(next).toEqual({ status: "ready", attempts: 1 });
  });

  it("an existing profile is equally ready (idempotent)", () => {
    const next = nextProvisioningState(INITIAL_PROVISIONING, { status: "existing" });
    expect(next).toEqual({ status: "ready", attempts: 1 });
  });

  it("an unavailable database is a recoverable failure, not a session change", () => {
    const next = nextProvisioningState(INITIAL_PROVISIONING, { status: "unavailable" });
    expect(next).toEqual({ status: "failed", reason: "unavailable", attempts: 1 });
    // The state carries no notion of being signed out — the type cannot express it.
    expect(next).not.toHaveProperty("user");
    expect(next).not.toHaveProperty("signedOut");
  });

  it("a 401 from the provisioning route is a recoverable failure, not a logout", () => {
    // Supabase owns the session. One route reporting 401 (a cookie race) must not
    // end a valid session; if the session really were gone, the auth event says so.
    const next = nextProvisioningState(INITIAL_PROVISIONING, { status: "unauthenticated" });
    expect(next.status).toBe("failed");
    expect(next.reason).toBe("unauthenticated");
  });

  it("a transport error is a recoverable failure", () => {
    const next = nextProvisioningState(INITIAL_PROVISIONING, { status: "error" });
    expect(next).toEqual({ status: "failed", reason: "error", attempts: 1 });
  });

  it("a later success replaces a previous failure", () => {
    const failed: ProvisioningState = { status: "failed", reason: "unavailable", attempts: 3 };
    const next = nextProvisioningState(failed, { status: "existing" });
    expect(next).toEqual({ status: "ready", attempts: 4 });
  });

  it("counts every attempt, so the budget cannot be reset by retrying", () => {
    let state: ProvisioningState = INITIAL_PROVISIONING;
    for (let i = 1; i <= 3; i += 1) {
      state = nextProvisioningState(state, { status: "unavailable" });
      expect(state.attempts).toBe(i);
    }
  });
});

describe("automatic retry policy", () => {
  const now = 1_000_000;

  it("attempts immediately when nothing has been tried", () => {
    expect(shouldAttemptAutomatically(INITIAL_PROVISIONING, undefined, now)).toBe(true);
  });

  it("never attempts again once ready", () => {
    expect(shouldAttemptAutomatically({ status: "ready", attempts: 0 }, undefined, now)).toBe(false);
  });

  it("stops after the automatic budget is spent", () => {
    const exhausted: ProvisioningState = {
      status: "failed",
      reason: "unavailable",
      attempts: MAX_AUTOMATIC_ATTEMPTS,
    };
    expect(shouldAttemptAutomatically(exhausted, undefined, now)).toBe(false);
  });

  it("allows an attempt below the budget", () => {
    const state: ProvisioningState = {
      status: "failed",
      reason: "unavailable",
      attempts: MAX_AUTOMATIC_ATTEMPTS - 1,
    };
    expect(shouldAttemptAutomatically(state, now - RETRY_COOLDOWN_MS, now)).toBe(true);
  });

  it("respects the cooldown, so a burst of auth events collapses into one call", () => {
    const state: ProvisioningState = { status: "failed", reason: "error", attempts: 1 };
    expect(shouldAttemptAutomatically(state, now - 10, now)).toBe(false);
    expect(shouldAttemptAutomatically(state, now - RETRY_COOLDOWN_MS + 1, now)).toBe(false);
    expect(shouldAttemptAutomatically(state, now - RETRY_COOLDOWN_MS, now)).toBe(true);
  });

  it("is bounded: the number of automatic attempts is finite for any event stream", () => {
    // Simulate 100 auth events firing back to back with a clock that advances
    // far past any cooldown. The budget must still stop it.
    let state: ProvisioningState = INITIAL_PROVISIONING;
    let attempts = 0;
    let lastAttemptAt: number | undefined;
    let clock = 0;

    for (let i = 0; i < 100; i += 1) {
      clock += RETRY_COOLDOWN_MS * 10;
      if (!shouldAttemptAutomatically(state, lastAttemptAt, clock)) continue;
      lastAttemptAt = clock;
      attempts += 1;
      state = nextProvisioningState(state, { status: "unavailable" });
    }

    expect(attempts).toBe(MAX_AUTOMATIC_ATTEMPTS);
  });
});

describe("user-facing copy", () => {
  it("never leaks infrastructure detail", () => {
    for (const reason of ["unavailable", "unauthenticated", "error"] as const) {
      const message = provisioningMessage(reason);
      expect(message).not.toMatch(/postgres|neon|sql|503|500|http|database|drizzle|socket/i);
    }
  });

  it("makes clear the user is still signed in when relevant", () => {
    expect(provisioningMessage("unauthenticated")).toMatch(/still signed in/i);
  });

  it("is a sentence, not an error code", () => {
    expect(provisioningMessage(undefined)).toMatch(/try again/i);
  });
});
