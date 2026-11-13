/** Phase 2G replaces the former cross-provider sequence with one atomic API call. */
import {beforeEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({request:vi.fn()}));
vi.mock("./trust-client",()=>({trustRequest:m.request}));
import {fetchReportContentPreviews,moderateReport,createReport,fetchMyReports} from "./reports";
beforeEach(()=>vi.resetAllMocks());
describe("atomic report boundary",()=>{
 it("hydrates typed lead previews from report IDs, no arbitrary target query",async()=>{m.request.mockResolvedValue([{entityType:"lead",entityId:"lead",authorName:"Neon profile",isDeleted:true}]);const result=await fetchReportContentPreviews([{id:"report",entityType:"lead",entityId:"lead"}] as never);expect(result.get("lead:lead")).toMatchObject({authorName:"Neon profile",isDeleted:true});expect(m.request).toHaveBeenCalledWith("previews",{},"POST",{ids:["report"]});});
 it("closes lead and resolves report in one server transaction",async()=>{await moderateReport("report","resolved",true);expect(m.request).toHaveBeenCalledExactlyOnceWith("moderate",{id:"report"},"PATCH",{status:"resolved",remove:true});});
 it("authorization failure propagates without a second write",async()=>{m.request.mockRejectedValue(new Error("forbidden"));await expect(moderateReport("report","resolved",true)).rejects.toThrow("forbidden");expect(m.request).toHaveBeenCalledOnce();});
 it("post and comment removal use the same atomic API",async()=>{await moderateReport("post-report","resolved",true);expect(m.request).toHaveBeenCalledWith("moderate",{id:"post-report"},"PATCH",{status:"resolved",remove:true});});
 it("database failure propagates, no legacy RPC fallback",async()=>{m.request.mockRejectedValue(new Error("unavailable"));await expect(moderateReport("report","dismissed")).rejects.toThrow("unavailable");expect(m.request).toHaveBeenCalledOnce();});
 it("does not send a client-supplied reporter or history owner",async()=>{await createReport({reporterUid:"forged",entityType:"lead",entityId:"lead",reason:"spam"});expect(m.request).toHaveBeenCalledWith("reports",{},"POST",{entityType:"lead",entityId:"lead",reason:"spam",details:undefined});await fetchMyReports("forged");expect(m.request).toHaveBeenLastCalledWith("my-reports");});
});
