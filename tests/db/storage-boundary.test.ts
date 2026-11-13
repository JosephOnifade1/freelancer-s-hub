/** Mocked cross-provider policy tests. No real Storage/Neon credentials or bytes. */
import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  db: vi.fn(),
  configured: vi.fn(),
  find: vi.fn(),
  post: vi.fn(),
  create: vi.fn(),
  verify: vi.fn(),
  sign: vi.fn(),
}));
vi.mock("@/lib/server-session", () => ({ getServerSession: m.session }));
vi.mock("@/server/db", () => ({
  getDatabase: m.db,
  isDatabaseConfigured: m.configured,
}));
vi.mock("@/server/storage/documents", () => ({
  verifyUploadedDocument: m.verify,
  signDocument: m.sign,
}));
vi.mock("@/server/features/social/social-queries", () => ({
  communityFacts: async () => ({
    memberIds: [],
    ownedIds: [],
    memberSlugs: [],
    ownedSlugs: [],
  }),
}));
vi.mock("@/server/features/content/content-queries", async (original) => ({
  ...(await original<
    typeof import("@/server/features/content/content-queries")
  >()),
  findAttachmentForViewer: m.find,
  findPostForViewer: m.post,
  createAttachment: m.create,
}));
import {
  getAttachmentDownload,
  createAttachmentForCurrentUser,
} from "@/server/features/content";
import { GET } from "@/app/api/content/attachments/[id]/download/route";
const UID = "a8888888-0000-4000-8000-000000000001",
  POST = "a8888888-0000-4000-8000-000000000002";
const db = { execute: vi.fn(async () => ({ rows: [{ role: "member" }] })) };
beforeEach(() => {
  vi.resetAllMocks();
  m.configured.mockReturnValue(true);
  m.db.mockReturnValue(db);
  db.execute.mockResolvedValue({ rows: [{ role: "member" }] });
  m.session.mockResolvedValue({ uid: UID });
  m.verify.mockResolvedValue(true);
  m.post.mockResolvedValue({ authorUid: UID });
  m.sign.mockResolvedValue("https://storage.example/signed");
});
describe("Neon-authorized private Storage boundary", () => {
  it("signs only stored path/name after viewer-authorized lookup", async () => {
    m.find.mockResolvedValue({
      storagePath: "stored/path",
      fileName: "Stored.pdf",
    });
    expect(await getAttachmentDownload("attachment")).toMatchObject({
      ok: true,
    });
    expect(m.find.mock.calls[0][1].uid).toBe(UID);
    expect(m.sign).toHaveBeenCalledExactlyOnceWith("stored/path", "Stored.pdf");
  });
  it.each([null, undefined])(
    "does not sign a hidden/deleted/missing target %s",
    async (row) => {
      m.find.mockResolvedValue(row);
      expect(await getAttachmentDownload("hidden")).toMatchObject({
        ok: false,
        reason: "not_found",
      });
      expect(m.sign).not.toHaveBeenCalled();
    },
  );
  it("database/role failure cannot fall back to legacy Storage visibility", async () => {
    db.execute.mockRejectedValue(new Error("role failed"));
    expect(await getAttachmentDownload("id")).toMatchObject({
      ok: false,
      reason: "not_ready",
    });
    expect(m.sign).not.toHaveBeenCalled();
  });
  it("Storage/config failure is visible and never returns a fake download", async () => {
    m.find.mockResolvedValue({ storagePath: "p", fileName: "f" });
    m.sign.mockRejectedValue(new Error("storage_not_configured"));
    expect(await getAttachmentDownload("id")).toMatchObject({
      ok: false,
      reason: "not_ready",
    });
  });
  it("upload verification cannot inspect or register another user's path", async () => {
    expect(
      await createAttachmentForCurrentUser(POST, {
        storagePath: `forged/${POST}/x`,
        fileName: "f",
        fileSize: 1,
        mimeType: "text/plain",
      }),
    ).toMatchObject({ data: { status: "invalid" } });
    expect(m.verify).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });
  it("nonowner cannot probe object existence through registration", async () => {
    m.post.mockResolvedValue({ authorUid: "other" });
    expect(
      await createAttachmentForCurrentUser(POST, {
        storagePath: `${UID}/${POST}/x`,
        fileName: "f",
        fileSize: 1,
        mimeType: "text/plain",
      }),
    ).toMatchObject({ ok: false, reason: "not_found" });
    expect(m.verify).not.toHaveBeenCalled();
  });
  it("missing/wrong-size/wrong-type object cannot create a Neon pointer", async () => {
    m.verify.mockResolvedValue(false);
    expect(
      await createAttachmentForCurrentUser(POST, {
        storagePath: `${UID}/${POST}/x`,
        fileName: "f",
        fileSize: 1,
        mimeType: "text/plain",
      }),
    ).toMatchObject({ data: { status: "invalid" } });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("known object is registered by verified actor; Storage failure leaves no pointer", async () => {
    m.create.mockResolvedValue({ status: "created" });
    const input = {
      storagePath: `${UID}/${POST}/x`,
      fileName: "f",
      fileSize: 1,
      mimeType: "text/plain",
    };
    await createAttachmentForCurrentUser(POST, input);
    expect(m.verify).toHaveBeenCalledWith(input.storagePath, 1, "text/plain");
    expect(m.create.mock.calls[0][1].uid).toBe(UID);
    m.create.mockClear();
    m.verify.mockRejectedValue(new Error("Storage failed"));
    expect(await createAttachmentForCurrentUser(POST, input)).toMatchObject({
      ok: false,
    });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("signed URLs are short-lived private no-store responses; JSON path claims ignored", async () => {
    m.find.mockResolvedValue({ storagePath: "stored", fileName: "f" });
    const response = await GET(
      new Request("http://localhost/download?path=forged"),
      { params: Promise.resolve({ id: "id" }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(m.sign).toHaveBeenCalledWith("stored", "f");
  });
});
