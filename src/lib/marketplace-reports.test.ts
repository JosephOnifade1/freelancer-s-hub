/** Supporting lead-preview/closure integration only. Report records remain Supabase. Mocked. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({leads:vi.fn(),archive:vi.fn(),single:vi.fn(),rpc:vi.fn()}));
vi.mock("./leads",()=>({fetchLeadsByIds:m.leads,archiveLeadAsStaff:m.archive}));
vi.mock("./supabase",()=>({supabase:{from:()=>({select:()=>({eq:()=>({single:m.single})})}),rpc:m.rpc}}));
import { fetchReportContentPreviews,moderateReport } from "./reports";
beforeEach(()=>{vi.resetAllMocks();m.single.mockResolvedValue({data:{entityType:"lead",entityId:"lead-id"},error:null});m.rpc.mockResolvedValue({error:null});});
describe("lead-specific report boundary",()=>{
 it("hydrates lead previews from Neon without embedded Supabase profiles join",async()=>{m.leads.mockResolvedValue([{id:"lead-id",title:"T",description:"D",status:"closed",postedBy:{uid:"owner",name:"Neon profile"}}]);const result=await fetchReportContentPreviews([{id:"report",entityType:"lead",entityId:"lead-id"}] as never);expect(result.get("lead-id")).toMatchObject({authorName:"Neon profile",isDeleted:true});expect(m.leads).toHaveBeenCalledWith(["lead-id"]);});
 it("closes Neon lead then keeps report mutation in the existing RPC with legacy removal disabled",async()=>{await moderateReport("report","resolved",true);expect(m.archive).toHaveBeenCalledWith("lead-id");expect(m.rpc).toHaveBeenCalledWith("moderate_report",{report_id:"report",new_status:"resolved",remove_content:false});});
 it("failed Neon authorization does not mark report resolved",async()=>{m.archive.mockRejectedValue(new Error("forbidden"));await expect(moderateReport("report","resolved",true)).rejects.toThrow("forbidden");expect(m.rpc).not.toHaveBeenCalled();});
 it("failed report lookup cannot close any lead",async()=>{m.single.mockResolvedValue({data:null,error:{message:"denied"}});await expect(moderateReport("report","resolved",true)).rejects.toThrow();expect(m.archive).not.toHaveBeenCalled();expect(m.rpc).not.toHaveBeenCalled();});
 it("non-lead moderation behavior stays unchanged",async()=>{m.single.mockResolvedValue({data:{entityType:"post",entityId:"post"},error:null});await moderateReport("report","resolved",true);expect(m.archive).not.toHaveBeenCalled();expect(m.rpc).toHaveBeenCalledWith("moderate_report",{report_id:"report",new_status:"resolved",remove_content:true});});
 it("RPC failure remains visible after idempotent lead closure",async()=>{m.rpc.mockResolvedValue({error:{message:"report database unavailable"}});await expect(moderateReport("report","resolved",true)).rejects.toThrow("report database unavailable");expect(m.archive).toHaveBeenCalledOnce();});
});
