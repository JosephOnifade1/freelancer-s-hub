/** Hermetic route/service identity and HTTP tests; query/DB/session mocked. */
import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({session:vi.fn(),configured:vi.fn(),db:vi.fn(),list:vi.fn(),unread:vi.fn(),read:vi.fn(),reports:vi.fn(),create:vi.fn(),moderate:vi.fn(),previews:vi.fn()}));
vi.mock("@/lib/server-session",()=>({getServerSession:m.session}));
vi.mock("@/server/db",()=>({getDatabase:m.db,isDatabaseConfigured:m.configured}));
vi.mock("@/server/features/trust/trust-queries",async original=>({...await original<typeof import("@/server/features/trust/trust-queries")>(),listNotifications:m.list,unreadCount:m.unread,markRead:m.read,listReports:m.reports,createReport:m.create,moderateReport:m.moderate,reportPreviews:m.previews}));
import {trustRequest} from "@/server/features/trust";
import {TrustError} from "@/server/features/trust/trust-queries";
import {GET,POST,PATCH,DELETE} from "@/app/api/trust/route";
const UID="a7777777-0000-4000-8000-000000000001",OTHER="a7777777-0000-4000-8000-000000000002",db={execute:vi.fn()};
const params=(op:string)=>new URLSearchParams({op,id:OTHER,uid:OTHER,role:"admin"});
const request=(op:string,body:unknown={},method="POST")=>new Request(`http://localhost/api/trust?op=${op}&id=${OTHER}`,{method,...(method==="GET"?{}:{body:JSON.stringify(body)})});
beforeEach(()=>{vi.resetAllMocks();m.configured.mockReturnValue(true);m.db.mockReturnValue(db);m.session.mockResolvedValue({uid:UID});});
describe("trust API boundary",()=>{
 it.each(["notifications","unread","reports","my-reports","recent-reports","open-reports"])("GET %s requires session",async op=>{m.session.mockResolvedValue(null);await expect(trustRequest("GET",params(op),{})).rejects.toMatchObject({status:401});expect(m.list).not.toHaveBeenCalled();expect(m.reports).not.toHaveBeenCalled();});
 it.each(["reports","previews"])("POST %s rejects absent session",async op=>{m.session.mockResolvedValue(null);await expect(trustRequest("POST",params(op),{role:"admin"})).rejects.toMatchObject({status:401});});
 it.each(["read","read-all","moderate"])("PATCH %s rejects absent session",async op=>{m.session.mockResolvedValue(null);await expect(trustRequest("PATCH",params(op),{uid:OTHER})).rejects.toMatchObject({status:401});});
 it("uses session for inbox, count and read writes regardless of forged uid",async()=>{await trustRequest("GET",params("notifications"),{});expect(m.list).toHaveBeenCalledWith(db,UID,30);await trustRequest("GET",params("unread"),{});expect(m.unread).toHaveBeenCalledWith(db,UID);await trustRequest("PATCH",params("read"),{userId:OTHER});expect(m.read).toHaveBeenCalledWith(db,UID,OTHER);await trustRequest("PATCH",params("read-all"),{userId:OTHER});expect(m.read).toHaveBeenLastCalledWith(db,UID);});
 it("strips reporter/status/resolver/timestamps from report submission",async()=>{await trustRequest("POST",params("reports"),{entityType:"profile",entityId:OTHER,reason:"spam",details:"D",reporterUid:OTHER,status:"resolved",resolvedBy:OTHER});expect(m.create).toHaveBeenCalledWith(db,UID,{entityType:"profile",entityId:OTHER,reason:"spam",details:"D"});});
 it("history and staff queue use session subject, never client role",async()=>{await trustRequest("GET",params("my-reports"),{});expect(m.reports).toHaveBeenCalledWith(db,UID,true);await trustRequest("GET",params("reports"),{});expect(m.reports).toHaveBeenLastCalledWith(db,UID,false,undefined);});
 it("moderation cannot override actor or target using JSON claims",async()=>{await trustRequest("PATCH",params("moderate"),{status:"resolved",remove:true,uid:OTHER,role:"admin",entityId:UID});expect(m.moderate).toHaveBeenCalledWith(db,UID,OTHER,"resolved",true);});
 it("preview requests send stored report IDs to staff-authorized query",async()=>{await trustRequest("POST",params("previews"),{ids:[OTHER],entityIds:[UID],role:"admin"});expect(m.previews).toHaveBeenCalledWith(db,UID,[OTHER]);});
 it("missing configuration fails closed before session/db",async()=>{m.configured.mockReturnValue(false);await expect(trustRequest("GET",params("notifications"),{})).rejects.toMatchObject({status:503});expect(m.db).not.toHaveBeenCalled();});
 it("auth and database failures never become successful empty lists",async()=>{m.session.mockRejectedValue(new Error("Auth failed"));expect((await GET(request("notifications",{},"GET"))).status).toBe(503);m.session.mockResolvedValue({uid:UID});m.list.mockRejectedValue(new Error("private query"));const r=await GET(request("notifications",{},"GET"));expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain("private query");});
 it.each([401,403,404,429])("preserves domain HTTP refusal %i",async status=>{m.moderate.mockRejectedValue(new TrustError(status,"denied"));expect((await PATCH(request("moderate",{},"PATCH"))).status).toBe(status);});
 it("malformed JSON, null and arrays reject before mutation",async()=>{for(const body of ["{","null","[]"]){expect((await POST(new Request("http://localhost/api/trust?op=reports",{method:"POST",body}))).status).toBe(400);}expect(m.create).not.toHaveBeenCalled();});
 it("no public event insertion, role assignment, notification deletion or arbitrary dispatcher",async()=>{for(const op of ["notify","set-role","notifications"]){expect((await POST(request(op))).status).toBe(400);}expect((await DELETE(request("notifications",{},"DELETE"))).status).toBe(400);});
});
