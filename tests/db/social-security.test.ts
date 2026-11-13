/** Hermetic mocked session/database boundaries; these are NOT SQL integration tests. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), configured: vi.fn(), db: vi.fn(), create: vi.fn(), update: vi.fn(), membership: vi.fn(), follow: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/server-session", () => ({ getServerSession: mocks.session }));
vi.mock("@/server/db", () => ({ getDatabase: mocks.db, isDatabaseConfigured: mocks.configured }));
vi.mock("@/server/features/social/social-queries", async original => {
  const actual = await original<typeof import("@/server/features/social/social-queries")>();
  return { ...actual, createCommunity: mocks.create, updateCommunity: mocks.update, setMembership: mocks.membership, setFollow: mocks.follow, listCommunities: mocks.list };
});
import { socialRequest } from "@/server/features/social";
import { GET, POST, PATCH } from "@/app/api/social/route";
const A = "e0000000-0000-4000-8000-000000000001";
const B = "e0000000-0000-4000-8000-000000000002";
const db = { execute: vi.fn() };
const params = (op: string) => new URLSearchParams({ op,slug:"writers" });
const request = (op: string, body: unknown, method = "POST") => new Request(`http://localhost/api/social?op=${op}&slug=writers`, { method, headers:{ "content-type":"application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.configured.mockReturnValue(true); mocks.db.mockReturnValue(db); mocks.session.mockResolvedValue({ uid:A });
});
describe("social server trust boundary", () => {
  it.each(["communities","membership","follow"])("refuses unauthenticated %s before mutations", async op => {
    mocks.session.mockResolvedValue(null);
    await expect(socialRequest("POST",params(op),{ joined:true,target:B,following:true })).rejects.toMatchObject({ status:401 });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.membership).not.toHaveBeenCalled(); expect(mocks.follow).not.toHaveBeenCalled();
  });
  it("follow ignores attacker-supplied actor and uses verified session", async () => {
    await socialRequest("POST",params("follow"),{ target:B,following:true,uid:B,followerId:B,actorUid:B });
    expect(mocks.follow).toHaveBeenCalledWith(db,A,B,true);
  });
  it("join and leave ignore userId override", async () => {
    for (const joined of [true,false]) {
      await socialRequest("POST",params("membership"),{ joined,userId:B,uid:B });
      expect(mocks.membership).toHaveBeenLastCalledWith(db,A,"writers",joined);
    }
  });
  it("community creation derives owner independently of body.ownerId", async () => {
    await socialRequest("POST",params("communities"),{ slug:"writers",name:"N",description:"D",ownerId:"system" });
    expect(mocks.create.mock.calls[0][1]).toBe(A);
    expect(mocks.create.mock.calls[0][2]).not.toHaveProperty("ownerId");
    // The query accepts no owner argument at all: only session uid + validated metadata.
    expect(mocks.create.mock.calls[0]).toHaveLength(3);
  });
  it("update whitelists metadata and strips identity/counter manipulation", async () => {
    await socialRequest("PATCH",params("communities"),{ name:"New",ownerId:B,id:B,memberCount:999,actorUid:B });
    expect(mocks.update).toHaveBeenCalledWith(db,A,"writers",{ name:"New" });
  });
  it("fails closed when session read throws", async () => {
    mocks.session.mockRejectedValue(new Error("auth unavailable"));
    await expect(socialRequest("POST",params("follow"),{ target:B,following:true })).rejects.toThrow("auth unavailable");
    expect(mocks.follow).not.toHaveBeenCalled();
  });
  it("fails closed when database configuration or connection is unavailable", async () => {
    mocks.configured.mockReturnValue(false);
    await expect(socialRequest("GET",params("communities"),{})).rejects.toMatchObject({ status:503 });
    expect(mocks.db).not.toHaveBeenCalled();
    mocks.configured.mockReturnValue(true); mocks.db.mockImplementation(() => { throw new Error("db failed"); });
    await expect(socialRequest("POST",params("follow"),{ target:B,following:true })).rejects.toThrow("db failed");
    expect(mocks.follow).not.toHaveBeenCalled();
  });
  it.each([{ joined:"true" },{ joined:1 },{}])("rejects malformed join payload %j", async body => {
    await expect(socialRequest("POST",params("membership"),body)).rejects.toMatchObject({ status:400 });
    expect(mocks.membership).not.toHaveBeenCalled();
  });
  it("does not default malformed follow state to follow", async () => {
    await expect(socialRequest("POST",params("follow"),{ target:B,following:"yes" })).rejects.toMatchObject({ status:400 });
    expect(mocks.follow).not.toHaveBeenCalled();
  });
});
describe("social HTTP mapping", () => {
  it("public directory works without authentication", async () => {
    mocks.session.mockResolvedValue(null); mocks.list.mockResolvedValue([{ slug:"writers" }]);
    const r = await GET(new Request("http://localhost/api/social?op=communities"));
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ data:[{ slug:"writers" }] });
  });
  it("invalid JSON fails before any mutation", async () => {
    const r = await POST(new Request("http://localhost/api/social?op=communities",{ method:"POST",body:"{" }));
    expect(r.status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("unauthenticated mutation is 401", async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request("membership",{ joined:true }))).status).toBe(401);
  });
  it("database exception maps to 503, not empty success", async () => {
    mocks.list.mockRejectedValue(new Error("SQL containing private info"));
    const r = await GET(new Request("http://localhost/api/social?op=communities"));
    expect(r.status).toBe(503); expect(JSON.stringify(await r.json())).not.toContain("private info");
  });
  it("unique slug conflict maps to 409", async () => {
    mocks.update.mockRejectedValue({ cause:{ code:"23505" } });
    expect((await PATCH(request("communities",{ slug:"taken" },"PATCH"))).status).toBe(409);
  });
});
