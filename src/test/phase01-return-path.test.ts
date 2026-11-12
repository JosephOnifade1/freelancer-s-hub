/**
 * Phase 1 — open-redirect protection for `/login?from=…`.
 *
 * The return path is user-editable, so every rejection case below is a real
 * attack attempt rather than a hypothetical. Pure unit tests: no DOM needed.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETURN_PATH,
  loginPath,
  readReturnPath,
  sanitizeReturnPath,
} from "@/lib/return-path";
import { postAuthRedirect } from "@/lib/auth";

describe("sanitizeReturnPath — accepted", () => {
  it("accepts the home path", () => {
    expect(sanitizeReturnPath("/")).toBe("/");
  });

  it("accepts a simple internal path", () => {
    expect(sanitizeReturnPath("/settings")).toBe("/settings");
  });

  it("accepts a nested internal path", () => {
    expect(sanitizeReturnPath("/b/design/p/42")).toBe("/b/design/p/42");
  });

  it("accepts a query string", () => {
    expect(sanitizeReturnPath("/submit?type=resource&space=design")).toBe(
      "/submit?type=resource&space=design",
    );
  });

  it("accepts a fragment", () => {
    expect(sanitizeReturnPath("/l/lead-1#apply")).toBe("/l/lead-1#apply");
  });

  it("accepts a percent-encoded internal path", () => {
    expect(sanitizeReturnPath("/tag/react%20native")).toBe("/tag/react%20native");
  });
});

describe("sanitizeReturnPath — rejected (open-redirect attempts)", () => {
  const attacks = [
    ["absolute external URL", "https://evil.example"],
    ["http external URL", "http://evil.example/login"],
    ["protocol-relative URL", "//evil.example"],
    ["protocol-relative with path", "//evil.example/steal"],
    ["backslash variant", "/\\evil.example"],
    ["double backslash", "\\\\evil.example"],
    ["mixed backslash", "/\\/evil.example"],
    ["javascript scheme", "javascript:alert(1)"],
    ["javascript with newline", "java\nscript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["vbscript scheme", "vbscript:msgbox(1)"],
    ["file scheme", "file:///etc/passwd"],
    ["percent-encoded protocol-relative", "/%2F%2Fevil.example"],
    ["percent-encoded backslash", "/%5Cevil.example"],
    ["relative path without leading slash", "settings"],
    ["whitespace-padded path", " /settings"],
    ["tab character", "/\tsettings"],
    ["empty string", ""],
  ] as const;

  for (const [label, value] of attacks) {
    it(`rejects ${label}`, () => {
      expect(sanitizeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
    });
  }

  it("rejects non-string values", () => {
    for (const value of [undefined, null, 42, {}, [], true]) {
      expect(sanitizeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
    }
  });
});

describe("sanitizeReturnPath — auth-loop prevention", () => {
  // Returning to an auth page after signing in would bounce the user straight
  // back out (or loop), so those destinations collapse to "/".
  for (const path of ["/login", "/signup", "/forgot-password", "/reset-password"]) {
    it(`does not return to ${path}`, () => {
      expect(sanitizeReturnPath(path)).toBe(DEFAULT_RETURN_PATH);
    });
  }

  it("does not return to an auth path with a query", () => {
    expect(sanitizeReturnPath("/login?from=/settings")).toBe(DEFAULT_RETURN_PATH);
  });

  it("allows a path that merely starts with an auth word", () => {
    // "/logins" is not the login page — must not be over-blocked.
    expect(sanitizeReturnPath("/logins")).toBe("/logins");
  });
});

describe("loginPath", () => {
  it("encodes a valid destination", () => {
    expect(loginPath("/settings")).toBe("/login?from=%2Fsettings");
  });

  it("encodes query strings inside the destination", () => {
    expect(loginPath("/submit?type=resource")).toBe("/login?from=%2Fsubmit%3Ftype%3Dresource");
  });

  it("omits `from` for home", () => {
    expect(loginPath("/")).toBe("/login");
  });

  it("omits `from` for an unsafe destination", () => {
    expect(loginPath("https://evil.example")).toBe("/login");
    expect(loginPath("//evil.example")).toBe("/login");
  });
});

describe("readReturnPath", () => {
  it("round-trips what loginPath produced", () => {
    const url = loginPath("/b/design/p/42");
    const from = new URL(url, "https://borynx.test").searchParams.get("from");
    expect(readReturnPath(from)).toBe("/b/design/p/42");
  });

  it("falls back for a missing value", () => {
    expect(readReturnPath(null)).toBe("/");
    expect(readReturnPath(undefined)).toBe("/");
  });

  it("falls back for an injected value", () => {
    expect(readReturnPath("//evil.example")).toBe("/");
  });
});

describe("postAuthRedirect (auth surface, same guarantees)", () => {
  it("returns a valid destination", () => {
    expect(postAuthRedirect("/settings")).toBe("/settings");
  });

  it("falls back when absent", () => {
    expect(postAuthRedirect(null)).toBe("/");
  });

  it("rejects external destinations", () => {
    expect(postAuthRedirect("https://evil.example")).toBe("/");
  });
});
