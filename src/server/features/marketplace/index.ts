import "server-only";
import { getServerSession } from "@/lib/server-session";
import { getDatabase, isDatabaseConfigured } from "@/server/db";
import * as q from "./marketplace-queries";

/** Every private subject is the verified session, never body.uid/userUid/applicantUid. */
export async function marketplaceRequest(method: string, params: URLSearchParams, body: Record<string, unknown>) {
  if (!isDatabaseConfigured()) throw new q.MarketplaceError(503,"database_not_configured");
  const db=getDatabase();
  const session=await getServerSession();
  const uid=session?.uid ?? null;
  const op=params.get("op"), target=params.get("id") ?? "";
  if (method !== "GET" || !["leads","lead"].includes(op ?? "")) q.identity(uid);
  if (method === "GET") {
    switch(op) {
      case "leads": return q.listLeads(db,{ status:params.get("status") ?? undefined,type:params.get("type") ?? undefined,search:params.get("q") ?? undefined,owner:params.get("owner") ?? undefined,ids:params.has("ids") ? (params.get("ids") ?? "").split(",").filter(Boolean) : undefined });
      case "lead": return q.getLead(db,target);
      case "applications": {
        const view=params.get("view");
        if (!["sent","received","mine","lead","detail"].includes(view ?? "")) throw new q.MarketplaceError(400,"invalid_view");
        return q.listApplications(db,uid,view as q.ApplicationView,target || undefined);
      }
      case "pipeline": return q.listPipeline(db,uid);
    }
  }
  if (method === "POST") {
    switch(op) {
      case "leads": return q.createLead(db,uid,{
        title:body.title as string,description:body.description as string,budget:body.budget as string,
        currency:body.currency as string,location:body.location as string,type:body.type as string,skills:body.skills as string[],
      });
      case "applications": return q.submitApplication(db,uid,target,body.proposal as string);
      case "pipeline": return q.addPipeline(db,uid,{
        title:body.title as string,clientName:body.clientName as string,budget:body.budget as string,
        leadId:body.leadId as string|null,source:body.source as string,
      });
      case "archive": await q.updateLead(db,uid,target,{ status:"closed" }); return true;
      case "staff-archive": await q.updateLead(db,uid,target,{},true); return true;
    }
  }
  if (method === "PATCH") {
    switch(op) {
      case "leads": {
        const patch: Partial<q.LeadInput> & { status?:string }={};
        for (const key of ["title","description","budget","currency","location","type","skills","status"] as const) {
          if (Object.hasOwn(body,key)) Object.assign(patch,{ [key]:body[key] });
        }
        await q.updateLead(db,uid,target,patch); return true;
      }
      case "applications": await q.setApplicationStatus(db,uid,target,body.status as string); return true;
      case "pipeline": await q.setPipelineStage(db,uid,target,body.stage as string); return true;
    }
  }
  if (method === "DELETE" && op === "pipeline") { await q.removePipeline(db,uid,target); return true; }
  throw new q.MarketplaceError(400,"invalid_operation");
}
