/** Mocked cross-provider failure/compensation semantics, not live Storage proof. */
import { describe, it, expect, vi, beforeEach } from "vitest";
const m = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  register: vi.fn(),
  attachments: vi.fn(),
}));
vi.mock("./content-client", () => ({
  fetchContentAttachments: m.attachments,
  registerAttachment: m.register,
  removeAttachmentRecord: vi.fn(),
  isContentError: (r: { ok: boolean }) => !r.ok,
}));
import { uploadPostDocuments } from "./attachments";
beforeEach(() => {
  vi.resetAllMocks();
  m.attachments.mockResolvedValue({ ok: true, data: [] });
  m.upload.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch",vi.fn(async (_url,options)=>{
    const result=options?.method==="DELETE"?await m.remove():await m.upload();
    return {ok:!result.error,json:async()=>({path:"owner/post/fixture.txt"})};
  }));
});
const file = () => new File(["text"], "note.txt", { type: "text/plain" });
describe("Storage/Neon compensation", () => {
  it.each(["error", "unavailable"])(
    "does not delete bytes when %s could hide a committed pointer",
    async (error) => {
      m.register.mockResolvedValue({ ok: false, error });
      const result = await uploadPostDocuments("post", [file()]);
      expect(result.uploaded).toEqual([]);
      expect(result.failed[0].error).toContain("Reload documents");
      expect(result.failed[0].error).toContain("Recovery path: owner/post/");
      expect(m.remove).not.toHaveBeenCalled();
    },
  );
  it("known refusal compensates object upload", async () => {
    m.register.mockResolvedValue({ ok: false, error: "conflict" });
    const result = await uploadPostDocuments("post", [file()]);
    expect(result.failed[0].error).toContain("at most");
    expect(m.remove).toHaveBeenCalledOnce();
  });
  it("failed compensation exposes a recovery path, never false success", async () => {
    m.register.mockResolvedValue({ ok: false, error: "forbidden" });
    m.remove.mockResolvedValue({ error: { message: "failed" } });
    const result = await uploadPostDocuments("post", [file()]);
    expect(result.uploaded).toEqual([]);
    expect(result.failed[0].error).toContain("file cleanup failed");
    expect(result.failed[0].error).toContain("recovery path");
  });
});
