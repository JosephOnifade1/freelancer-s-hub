/** Mocked SDK capability tests, not live Supabase Storage proof. */
import { it, describe, expect, vi, beforeEach, afterEach } from "vitest";
const m = vi.hoisted(() => ({
  credentials: vi.fn(),
  client: vi.fn(),
  bucket: vi.fn(),
  info: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/supabase-env", () => ({
  getSupabaseCredentials: m.credentials,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: m.client }));
import {
  verifyUploadedDocument,
  signDocument,
} from "@/server/storage/documents";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-placeholder");
  m.credentials.mockReturnValue({
    url: "https://storage.example",
    anonKey: "public-placeholder",
  });
  m.client.mockReturnValue({ storage: { from: m.bucket } });
  m.bucket.mockReturnValue({ info: m.info, createSignedUrl: m.sign });
});
afterEach(() => vi.unstubAllEnvs());
describe("server-only Storage capability", () => {
  it("fails closed without configuration rather than falling back to application-table RLS", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(signDocument("p", "f")).rejects.toThrow(
      "storage_not_configured",
    );
    expect(m.client).not.toHaveBeenCalled();
  });
  it("verifies stored object size and MIME", async () => {
    m.info.mockResolvedValue({
      data: { size: 7, contentType: "text/plain" },
      error: null,
    });
    expect(await verifyUploadedDocument("path", 7, "text/plain")).toBe(true);
    expect(await verifyUploadedDocument("path", 8, "text/plain")).toBe(false);
    expect(await verifyUploadedDocument("path", 7, "application/pdf")).toBe(
      false,
    );
    expect(m.bucket).toHaveBeenCalledWith("post-documents");
    expect(m.client.mock.calls[0][2].auth).toEqual({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });
  it("missing object is a refusal; network/config error is not a safe compensation signal", async () => {
    m.info.mockResolvedValue({ error: { statusCode: "404" } });
    expect(await verifyUploadedDocument("p", 1, "text/plain")).toBe(false);
    m.info.mockResolvedValue({
      error: { statusCode: "503", message: "sensitive" },
    });
    await expect(verifyUploadedDocument("p", 1, "text/plain")).rejects.toThrow(
      "storage_unavailable",
    );
  });
  it("signs only the fixed private bucket with sixty-second expiry", async () => {
    m.sign.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed" },
      error: null,
    });
    expect(await signDocument("stored/path", "Name.pdf")).toBe(
      "https://storage.example/signed",
    );
    expect(m.sign).toHaveBeenCalledWith("stored/path", 60, {
      download: "Name.pdf",
    });
  });
  it("signing failure never exposes provider messages or credential", async () => {
    m.sign.mockResolvedValue({ error: { message: "secret token SQL" } });
    await expect(signDocument("p", "f")).rejects.toThrow("storage_unavailable");
  });
});
