/** Hermetic route/service tests with mocked session and query functions. Not SQL evidence. */
import { beforeEach, describe, it, expect, vi } from "vitest";
const m=vi.hoisted(()=>({session:vi.fn(),configured:vi.fn(),db:vi.fn(),list:vi.fn(),get:vi.fn(),create:vi.fn(),update:vi.fn(),applications:vi.fn(),submit:vi.fn(),status:vi.fn(),pipeline:vi.fn(),add:vi.fn(),stage:vi.fn(),remove:vi.fn()}));
vi.mock("@/lib/server-session",()=>({getServerSession:m.session}));
vi.mock("@/server/db",()=>({getDatabase:m.db,isDatabaseConfigured:m.configured}));
vi.mock("@/server/features/marketplace/marketplace-queries",async original=>{
 const actual=await original<typeof import("@/server/features/marketplace/marketplace-queries")>();
 return {...actual,listLeads:m.list,getLead:m.get,createLead:m.create,updateLead:m.update,listApplications:m.applications,submitApplication:m.submit,setApplicationStatus:m.status,listPipeline:m.pipeline,addPipeline:m.add,setPipelineStage:m.stage,removePipeline:m.remove};
});
import { marketplaceRequest } from "@/server/features/marketplace";
import { MarketplaceError } from "@/server/features/marketplace/marketplace-queries";
import { GET,POST,PATCH,DELETE } from "@/app/api/marketplace/route";
const UID="f0000000-0000-4000-8000-000000000001",OTHER="f0000000-0000-4000-8000-000000000002";
const db={execute:vi.fn()};
const params=(op:string)=>new URLSearchParams({op,id:OTHER});
const req=(op:string,body:unknown={},method="POST")=>new Request(`http://localhost/api/marketplace?op=${op}&id=${OTHER}`,{method,headers:{"content-type":"application/json"},...(method!=="GET"&&method!=="DELETE"?{body:JSON.stringify(body)}:{})});
beforeEach(()=>{vi.resetAllMocks();m.configured.mockReturnValue(true);m.db.mockReturnValue(db);m.session.mockResolvedValue({uid:UID});});
describe("marketplace identity boundary",()=>{
 it.each(["leads","applications","pipeline","archive","staff-archive"])("rejects unauthenticated POST %s before dispatch",async op=>{m.session.mockResolvedValue(null);await expect(marketplaceRequest("POST",params(op),{})).rejects.toMatchObject({status:401});expect(m.create).not.toHaveBeenCalled();expect(m.submit).not.toHaveBeenCalled();expect(m.add).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();});
 it.each(["applications","pipeline"])("rejects unauthenticated private GET %s",async op=>{m.session.mockResolvedValue(null);await expect(marketplaceRequest("GET",params(op),{})).rejects.toMatchObject({status:401});});
 it("ignores applicantUid and user-supplied subject on submission",async()=>{await marketplaceRequest("POST",params("applications"),{proposal:"Commercial proposal",applicantUid:OTHER,uid:OTHER});expect(m.submit).toHaveBeenCalledWith(db,UID,OTHER,"Commercial proposal");});
 it.each(["sent","received","mine","lead","detail"])("private application view %s always uses session uid",async view=>{const p=params("applications");p.set("view",view);p.set("uid",OTHER);await marketplaceRequest("GET",p,{});expect(m.applications).toHaveBeenCalledWith(db,UID,view,OTHER);});
 it("lead creation strips owner/status/counter/verification claims",async()=>{await marketplaceRequest("POST",params("leads"),{title:"T",description:"D",budget:"1",currency:"USD",location:"Remote",type:"Project",postedByUid:OTHER,status:"closed",applicantsCount:999,isVerified:true});expect(m.create.mock.calls[0][1]).toBe(UID);const body=m.create.mock.calls[0][2];for(const key of ["postedByUid","status","applicantsCount","isVerified"])expect(body).not.toHaveProperty(key);});
 it("lead update whitelists fields and cannot change ownership or counts",async()=>{await marketplaceRequest("PATCH",params("leads"),{title:"New",postedByUid:OTHER,applicantsCount:9,isVerified:true});expect(m.update).toHaveBeenCalledWith(db,UID,OTHER,{title:"New"});});
 it("application review cannot mutate proposal, lead or applicant",async()=>{await marketplaceRequest("PATCH",params("applications"),{status:"accepted",proposal:"Forged",applicantUid:OTHER,leadId:OTHER});expect(m.status).toHaveBeenCalledWith(db,UID,OTHER,"accepted");});
 it("pipeline creation uses session and cannot assign initial won stage",async()=>{await marketplaceRequest("POST",params("pipeline"),{title:"T",clientName:"C",userUid:OTHER,stage:"won"});expect(m.add.mock.calls[0][1]).toBe(UID);expect(m.add.mock.calls[0][2]).not.toHaveProperty("userUid");expect(m.add.mock.calls[0][2]).not.toHaveProperty("stage");});
 it("pipeline stage and deletion scope to the session rather than body or query uid",async()=>{const p=params("pipeline");p.set("uid",OTHER);await marketplaceRequest("PATCH",p,{stage:"won",userUid:OTHER});expect(m.stage).toHaveBeenCalledWith(db,UID,OTHER,"won");await marketplaceRequest("DELETE",p,{});expect(m.remove).toHaveBeenCalledWith(db,UID,OTHER);});
 it("staff archive cannot be requested as another actor",async()=>{await marketplaceRequest("POST",params("staff-archive"),{actorUid:OTHER,role:"admin"});expect(m.update).toHaveBeenCalledWith(db,UID,OTHER,{},true);});
 it("fails closed on missing configuration before connecting",async()=>{m.configured.mockReturnValue(false);await expect(marketplaceRequest("GET",params("leads"),{})).rejects.toMatchObject({status:503});expect(m.db).not.toHaveBeenCalled();});
 it("fails closed on session verification errors",async()=>{m.session.mockRejectedValue(new Error("Auth unavailable"));await expect(marketplaceRequest("POST",params("pipeline"),{})).rejects.toThrow("Auth unavailable");expect(m.add).not.toHaveBeenCalled();});
 it("required DB reads cannot degrade to empty application or pipeline data",async()=>{m.applications.mockRejectedValue(new Error("Database failed"));const p=params("applications");p.set("view","sent");await expect(marketplaceRequest("GET",p,{})).rejects.toThrow("Database failed");m.pipeline.mockRejectedValue(new Error("Database failed"));await expect(marketplaceRequest("GET",params("pipeline"),{})).rejects.toThrow("Database failed");});
});
describe("marketplace HTTP contract",()=>{
 it("public lead reads work signed out without exposing private tables",async()=>{m.session.mockResolvedValue(null);m.list.mockResolvedValue([]);expect((await GET(req("leads",{},"GET"))).status).toBe(200);expect(m.applications).not.toHaveBeenCalled();expect(m.pipeline).not.toHaveBeenCalled();});
 it("rejects malformed JSON and array/null bodies before mutation",async()=>{for(const body of ["{","[]","null"]){const r=await POST(new Request("http://localhost/api/marketplace?op=leads",{method:"POST",body}));expect(r.status).toBe(400);}expect(m.create).not.toHaveBeenCalled();});
 it.each([401,403,404,409])("maps domain refusal to HTTP %i without changing it",async status=>{m.status.mockRejectedValue(new MarketplaceError(status,"denied"));expect((await PATCH(req("applications",{status:"accepted"},"PATCH"))).status).toBe(status);});
 it("SQL failures return 503 without leaking query/parameter details",async()=>{m.list.mockRejectedValue(new Error("private proposal SQL"));const r=await GET(req("leads",{},"GET"));expect(r.status).toBe(503);expect(JSON.stringify(await r.json())).not.toContain("proposal");});
 it("database FK/unique constraints map to meaningful HTTP errors",async()=>{m.add.mockRejectedValue({cause:{code:"23505"}});expect((await POST(req("pipeline"))).status).toBe(409);m.add.mockRejectedValue({cause:{code:"23503"}});expect((await POST(req("pipeline"))).status).toBe(400);});
 it("unauthenticated pipeline deletion cannot dispatch",async()=>{m.session.mockResolvedValue(null);expect((await DELETE(req("pipeline",{},"DELETE"))).status).toBe(401);expect(m.remove).not.toHaveBeenCalled();});
 it("invalid views and operations do not dispatch arbitrary query functions",async()=>{const p=params("applications");p.set("view","all");await expect(marketplaceRequest("GET",p,{})).rejects.toMatchObject({status:400});await expect(marketplaceRequest("DELETE",params("leads"),{})).rejects.toMatchObject({status:400});});
});
