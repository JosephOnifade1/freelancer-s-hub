import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "./supabase";
import { MockSupabaseClient, seedMockData } from "./mockSupabase";
import { fetchLeads, fetchLeadById } from "./leads";
import { addPipelineItem, changePipelineStage, fetchPipeline, removePipelineItem, saveOpportunity } from "./pipeline";
import { fetchPostAttachments, getDocumentDownloadUrl, removePostAttachment, uploadPostDocuments, validateDocument } from "./attachments";

// Exercise the real feature helpers against the browser demo client. Its RLS
// mirror must deny the same reads/writes as the accompanying SQL migration.
vi.mock("./supabase", async () => {
  const { MockSupabaseClient } = await import("./mockSupabase");
  // Phase 2D: content helpers delegate to the same mock through `content-demo.ts`
  // when `isDemoMode` is true, so this suite keeps exercising the mock's RLS mirror
  // rather than the HTTP client.
  return { supabase: new MockSupabaseClient(), isDemoMode: true };
});

// Phase 2F: marketplace helpers exercise a MOCKED API boundary here, not a
// production fallback. Actual Neon query semantics run in marketplace-integration.
vi.mock("./marketplace-client", () => ({
  marketplaceRequest: async (op: string, params: Record<string,string> = {}, method = "GET", body: Record<string,unknown> = {}) => {
    const { supabase: apiFixture } = await import("./supabase");
    const session = JSON.parse(localStorage.getItem("mock_supabase_session") || "null");
    const actor = session?.user?.id;
    if (op === "leads" || op === "lead") {
      let query = apiFixture.from("leads").select("*");
      if (op === "lead") query = query.eq("id", params.id);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const leads = (data || []).map((row: Record<string,unknown>) => ({ ...row,
        postedBy: { uid: row.postedByUid, name: "Unknown" }, postedAt: Date.now() }));
      return op === "lead" ? leads[0] ?? null : leads;
    }
    if (!actor) throw new Error("Sign in to manage your pipeline.");
    if (op !== "pipeline") throw new Error("Unsupported test operation");
    if (method === "GET") {
      const { data, error } = await apiFixture.from("lead_pipeline").select("*").eq("userUid", actor).order("updatedAt", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }
    if (method === "POST") {
      const { data, error } = await apiFixture.from("lead_pipeline").insert({ ...body,userUid:actor,stage:"new" }).select("*").single();
      if (error) throw new Error(error.code === "23505" ? "This opportunity is already in your pipeline." : error.message);
      return data;
    }
    const query = method === "PATCH"
      ? apiFixture.from("lead_pipeline").update({ stage:body.stage,updatedAt:new Date().toISOString() })
      : apiFixture.from("lead_pipeline").delete();
    const { data,error } = await query.eq("id",params.id).eq("userUid",actor).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("That item is no longer in your pipeline.");
    return true;
  },
}));

const client = supabase as unknown as MockSupabaseClient;
const author = "author";
const viewer = "viewer";
const postId = "public-post";
const privatePostId = "members-post";
const signInAs = (uid: string) => localStorage.setItem("mock_supabase_session", JSON.stringify({ user: { id: uid } }));
const signOut = () => localStorage.removeItem("mock_supabase_session");
const file = (name = "terms.pdf", type = "application/pdf") => new File(["A real file"], name, { type });

describe("marketplace and account-private pipeline", () => {
  beforeEach(() => {
    localStorage.clear();
    seedMockData();
  });

  it("does not turn old browser example leads into opportunities or invent detail", async () => {
    localStorage.setItem("borynx_board_leads_v2", JSON.stringify([{ id: "fictional", title: "Not real" }]));
    expect(await fetchLeads()).toEqual([]);
    expect(await fetchLeadById("fictional")).toBeNull();

    signInAs(author);
    const inserted = await client.from("leads").insert({
      id: "actual", title: "Real contract", description: "Build an app", type: "Project",
      budget: "$1,000", currency: "USD", location: "Remote", status: "open",
      skills: ["React"], postedByUid: author, applicantsCount: 0,
    }).select("id").single();
    expect(inserted.error).toBeNull();
    signOut();
    const opportunities = await fetchLeads();
    expect(opportunities.map((lead) => lead.title)).toEqual(["Real contract"]);
    expect((await fetchLeadById("actual"))?.title).toBe("Real contract");
    expect(await fetchLeadById("missing")).toBeNull();
  });

  it("persists pipeline items to the owner only and rejects forged or cross-account edits", async () => {
    signInAs(author);
    const item = await addPipelineItem(author, { clientName: "Studio", title: "Dashboard", budget: "$800" });
    expect((await fetchPipeline(author))[0]).toMatchObject({ id: item.id, stage: "new", title: "Dashboard" });
    await changePipelineStage(author, item.id, "proposal");
    expect((await fetchPipeline(author))[0].stage).toBe("proposal");

    signInAs(viewer);
    expect(await fetchPipeline(viewer)).toEqual([]);
    // Compatibility uid cannot impersonate the old account: server fixture owns identity.
    const ownItem = await addPipelineItem(author, { clientName: "Forged", title: "Forged" });
    expect(ownItem.userUid).toBe(viewer);
    expect((await fetchPipeline(author)).every((row) => row.userUid === viewer)).toBe(true);
    await expect(changePipelineStage(author, item.id, "won")).rejects.toThrow(/no longer/);
    await expect(removePipelineItem(author, item.id)).rejects.toThrow(/no longer/);

    signOut();
    await expect(fetchPipeline(author)).rejects.toThrow(/Sign in/);
    signInAs(author);
    expect((await fetchPipeline(author))[0].stage).toBe("proposal");
    await removePipelineItem(author, item.id);
    expect(await fetchPipeline(author)).toEqual([]);
  });

  it("saves a real opportunity once, with the persisted project and owner", async () => {
    signInAs(author);
    const lead = {
      id: "client-lead", title: "Build a website", description: "For our team", type: "Project" as const,
      status: "open" as const, budget: "$500", currency: "USD", location: "Remote", skills: [],
      postedBy: { uid: viewer, name: "Studio" }, postedAt: Date.now(), applicantsCount: 0,
    };
    const first = await saveOpportunity(author, lead);
    expect(first).toMatchObject({ leadId: lead.id, clientName: "Studio", source: "Borynx opportunity" });
    await expect(saveOpportunity(author, lead)).rejects.toThrow(/already in your pipeline/);
  });
});

describe("post document privacy and persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mock_supabase_posts", JSON.stringify([
      { id: postId, authorUid: author, visibility: "public", isDeleted: false },
      { id: privatePostId, authorUid: author, visibility: "members", communitySlug: "writers", isDeleted: false },
    ]));
    localStorage.setItem("mock_supabase_profiles", JSON.stringify([
      { uid: author, role: "member" }, { uid: viewer, role: "member" },
    ]));
    signInAs(author);
  });

  it("validates file type, MIME and size before upload", () => {
    expect(validateDocument(file())).toEqual({ extension: "pdf", mime: "application/pdf" });
    expect(() => validateDocument(file("script.exe", "application/pdf"))).toThrow(/PDF/);
    expect(() => validateDocument(file("wrong.pdf", "image/png"))).toThrow(/PDF/);
    expect(() => validateDocument(new File([], "empty.pdf", { type: "application/pdf" }))).toThrow(/10 MB/);
  });

  it("uploads a private object and metadata, then signs only visible downloads", async () => {
    const { uploaded: [publicFile] } = await uploadPostDocuments(postId, [file()]);
    const { uploaded: [membersFile] } = await uploadPostDocuments(privatePostId, [file("private.txt", "text/plain")]);
    expect(publicFile).toMatchObject({ postId, fileName: "terms.pdf", fileSize: file().size });
    expect(client.storage.from("post-documents").getPublicUrl(publicFile.storagePath).data.publicUrl).toBe("");
    expect(await fetchPostAttachments(postId)).toEqual([publicFile]);

    signOut();
    expect((await fetchPostAttachments(postId)).map((doc) => doc.fileName)).toEqual(["terms.pdf"]);
    expect(await fetchPostAttachments(privatePostId)).toEqual([]);
    expect(await getDocumentDownloadUrl(publicFile)).toMatch(/^data:application\/pdf;base64,/);
    await expect(getDocumentDownloadUrl(membersFile)).rejects.toThrow(/not visible/);

    signInAs(viewer);
    expect(await fetchPostAttachments(privatePostId)).toEqual([]);
    localStorage.setItem("mock_supabase_community_members", JSON.stringify([
      { userId: viewer, communitySlug: "writers" },
    ]));
    expect((await fetchPostAttachments(privatePostId))[0].id).toBe(membersFile.id);
    expect(await getDocumentDownloadUrl(membersFile)).toMatch(/^data:text\/plain;base64,/);

    signInAs(author);
    await removePostAttachment(publicFile);
    expect(await fetchPostAttachments(postId)).toEqual([]);
    await expect(getDocumentDownloadUrl(publicFile)).rejects.toThrow(/not visible/);
  });

  it("rejects forged uploads, metadata without an object and a fourth file", async () => {
    const path = `${author}/${postId}/fabricated.pdf`;
    expect((await client.from("post_attachments").insert({
      postId, uploaderUid: author, storagePath: path, fileName: "fabricated.pdf",
      fileSize: 12, mimeType: "application/pdf",
    })).error?.message).toMatch(/Upload the document/);

    await uploadPostDocuments(postId, [file("first.pdf"), file("second.pdf"), file("third.pdf")]);
    await expect(uploadPostDocuments(postId, [file("fourth.pdf")])).rejects.toThrow(/at most 3/);
    expect((await fetchPostAttachments(postId)).length).toBe(3);

    signInAs(viewer);
    const forged = await uploadPostDocuments(privatePostId, [file("forged.pdf")]);
    expect(forged.uploaded).toEqual([]);
    expect(forged.failed).toHaveLength(1);
    expect(forged.failed[0].error).toMatch(/Only the post author/);
    signOut();
    expect((await client.from("posts").insert({ id: "anonymous", authorUid: author, title: "No" })).error).not.toBeNull();
  });

  it("hides metadata and signed downloads as soon as the post is removed", async () => {
    const { uploaded: [attachment] } = await uploadPostDocuments(postId, [file()]);
    const posts = JSON.parse(localStorage.getItem("mock_supabase_posts") || "[]");
    posts[0].isDeleted = true;
    localStorage.setItem("mock_supabase_posts", JSON.stringify(posts));
    signOut();
    expect(await fetchPostAttachments(postId)).toEqual([]);
    await expect(getDocumentDownloadUrl(attachment)).rejects.toThrow(/not visible/);
  });
});
