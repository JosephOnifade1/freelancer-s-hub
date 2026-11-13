/** Hermetic client/API contract tests. Server-side SQL/security is covered separately. */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { fetchLeads,fetchLeadById,createLead,updateLead,archiveLead } from "./leads";
import { applyToLead,fetchMyApplications,fetchReceivedApplications,fetchMyApplication,updateApplicationStatus } from "./applications";
import { addPipelineItem,fetchPipeline,changePipelineStage,removePipelineItem,saveOpportunity } from "./pipeline";
const fetchMock=vi.fn();
beforeEach(()=>{fetchMock.mockReset();vi.stubGlobal("fetch",fetchMock);});
afterEach(()=>vi.unstubAllGlobals());
const reply=(data:unknown,status=200)=>fetchMock.mockImplementation(async()=>new Response(JSON.stringify(status===200?{data}:{error:data}),{status,headers:{"content-type":"application/json"}}));
const sent=()=>{const [url,init]=fetchMock.mock.calls[0];return {url:String(url),params:new URL(String(url),"http://localhost").searchParams,init,body:init.body?JSON.parse(init.body):{}};};
describe("marketplace adapters use the server boundary",()=>{
 it("public listing preserves DTOs and forwards supported filters",async()=>{reply([{id:"lead",title:"Actual"}]);expect(await fetchLeads({status:"open",search:"React",type:"Project"})).toEqual([{id:"lead",title:"Actual"}]);expect(sent().params.get("q")).toBe("React");expect(sent().params.get("status")).toBe("open");expect(sent().init.cache).toBe("no-store");});
 it("missing lead is null, failed read is never an empty feed",async()=>{reply(null);expect(await fetchLeadById("missing")).toBeNull();reply("unavailable",503);await expect(fetchLeads()).rejects.toThrow();});
 it("does not read old localStorage opportunity examples",async()=>{localStorage.setItem("borynx_board_leads_v2",JSON.stringify([{id:"fiction"}]));reply([]);expect(await fetchLeads()).toEqual([]);localStorage.removeItem("borynx_board_leads_v2");});
 it("creation does not send the caller-provided author or verification",async()=>{reply("saved");await createLead({title:"T",description:"D",budget:"2",currency:"USD",location:"Remote",type:"Project",skills:[],isVerified:true,postedBy:{uid:"spoofed",name:"Forged"}});expect(sent().body).not.toHaveProperty("postedBy");expect(sent().body).not.toHaveProperty("isVerified");});
 it("owner editing and archival call real mutation endpoints",async()=>{reply(true);await updateLead("id",{status:"closed"});expect(sent().init.method).toBe("PATCH");expect(sent().body.status).toBe("closed");fetchMock.mockClear();await archiveLead("id");expect(sent().params.get("op")).toBe("archive");});
 it("application submission never sends applicant identity",async()=>{reply({id:"application"});await applyToLead("lead","spoofed","Private proposal");expect(sent().body).toEqual({proposal:"Private proposal"});expect(sent().params.get("id")).toBe("lead");expect(sent().url).not.toContain("spoofed");});
 it.each([fetchMyApplications,fetchReceivedApplications])("private inbox ignores compatibility uid",async fn=>{reply([]);await fn("spoofed");expect(sent().url).not.toContain("spoofed");expect(sent().params.has("uid")).toBe(false);});
 it("own lead application uses session-selected mine view",async()=>{reply([]);expect(await fetchMyApplication("lead","spoofed")).toBeNull();expect(sent().params.get("view")).toBe("mine");expect(sent().url).not.toContain("spoofed");});
 it("application status changes send status only",async()=>{reply(true);await updateApplicationStatus("application","withdrawn");expect(sent().body).toEqual({status:"withdrawn"});});
 it("private pipeline reads do not send subject uid",async()=>{reply([]);await fetchPipeline("spoofed");expect(sent().url).not.toContain("spoofed");});
 it("pipeline initialization does not send actor identity",async()=>{reply({id:"item"});await addPipelineItem("spoofed",{title:"T",clientName:"C"});expect(sent().body).toEqual({title:"T",clientName:"C"});});
 it("pipeline stage/delete never send the compatibility uid",async()=>{reply(true);await changePipelineStage("spoofed","item","won");expect(sent().body).toEqual({stage:"won"});fetchMock.mockClear();await removePipelineItem("spoofed","item");expect(sent().init.method).toBe("DELETE");expect(sent().url).not.toContain("spoofed");});
 it("saved opportunity copies existing lead metadata without an alternative bidding system",async()=>{reply({id:"pipeline"});await saveOpportunity("actor",{id:"lead",title:"Project",description:"D",budget:"500",currency:"USD",location:"Remote",type:"Project",status:"open",skills:[],postedBy:{uid:"owner",name:"Studio"},postedAt:1,applicantsCount:0});expect(sent().body).toEqual({leadId:"lead",title:"Project",clientName:"Studio",budget:"500 USD",source:"Borynx opportunity"});});
 it("private read auth failures throw rather than returning empty lists",async()=>{reply("unauthenticated",401);await expect(fetchMyApplications("actor")).rejects.toThrow(/Sign in/);await expect(fetchPipeline("actor")).rejects.toThrow(/Sign in/);});
 it("network and malformed response errors fail closed",async()=>{fetchMock.mockRejectedValue(new Error("network"));await expect(fetchLeads()).rejects.toThrow("network");fetchMock.mockResolvedValue(new Response("not json"));await expect(fetchPipeline("actor")).rejects.toThrow();});
});
