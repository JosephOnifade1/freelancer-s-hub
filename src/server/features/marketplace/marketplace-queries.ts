import { sql } from "drizzle-orm";
import type { ContentDatabase, ContentTransactionDatabase } from "../content/content-queries";
import type { Lead } from "@/lib/leads";
import type { LeadApplication, ApplicationStatus } from "@/lib/applications";
import type { PipelineItem } from "@/lib/pipeline";

export class MarketplaceError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const rows = (r: unknown): Record<string, unknown>[] => Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function identity(uid: string | null): asserts uid is string {
  if (!uid) throw new MarketplaceError(401,"unauthenticated");
  if (!UUID.test(uid)) throw new MarketplaceError(400,"invalid_identity");
}
function id(value: string) { if (!UUID.test(value)) throw new MarketplaceError(400,"invalid_id"); }
function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== "string" || value.trim().length > max || (!empty && !value.trim())) throw new MarketplaceError(400,"invalid_input");
  return value.trim();
}
function oneOf(value: unknown, allowed: readonly string[]) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new MarketplaceError(400,"invalid_state");
  return value;
}
const types = ["Bounty","Project","Retainer","Full-time"];
const leadStates = ["open","in-progress","closed"];
const appStates = ["pending","accepted","rejected","withdrawn"];
const stages = ["new","conversation","proposal","negotiation","won"];
const arr = (a: string[]) => a.length ? sql`array[${sql.join(a.map(s => sql`${s}`),sql`, `)}]::text[]` : sql`'{}'::text[]`;
const ms = (v: unknown) => new Date(v as string).getTime();
const iso = (v: unknown) => new Date(v as string).toISOString();
const publicProfile = sql`jsonb_build_object('uid',p.uid,'username',p.username,'name',coalesce(nullif(p."displayName",''),p.username,'Unknown'),'avatar',p."avatarUrl",'isVerified',p."isVerifiedPro")`;
const leadColumns = sql`l.*, ${publicProfile} as author`;
function lead(r: Record<string, unknown>): Lead {
  const p = r.author as Lead["postedBy"] | undefined;
  return { id:String(r.id),title:String(r.title),description:String(r.description),budget:String(r.budget),currency:String(r.currency),location:String(r.location),
    type:r.type as Lead["type"],status:r.status as Lead["status"],skills:r.skills as string[],isVerified:Boolean(r.isVerified),postedAt:ms(r.postedAt),applicantsCount:Number(r.applicantsCount),
    postedBy:p?.uid ? p : { uid:String(r.postedByUid),name:"Unknown" } };
}
export interface LeadInput { title:string; description:string; budget:string; currency:string; location:string; type:string; skills?:string[] }
function leadInput(v: LeadInput) {
  const skills = v.skills ?? [];
  if (!Array.isArray(skills) || skills.length > 30 || skills.some(s => typeof s !== "string" || s.length > 100)) throw new MarketplaceError(400,"invalid_skills");
  return { title:text(v.title,180),description:text(v.description,10000),budget:text(v.budget,80),currency:text(v.currency,12),location:text(v.location,120),type:oneOf(v.type,types),skills };
}
export interface LeadFilter { status?:string; type?:string; search?:string; owner?:string; ids?:string[] }
/** Leads have always been public, including closed records; proposals/pipeline are not. */
export async function listLeads(db: ContentDatabase, filter: LeadFilter = {}): Promise<Lead[]> {
  const conditions = [sql`true`];
  if (filter.ids) {
    if (filter.ids.length > 100) throw new MarketplaceError(400,"invalid_ids");
    filter.ids.forEach(id);
    if (!filter.ids.length) return [];
    conditions.push(sql`l.id in (${sql.join(filter.ids.map(v => sql`${v}`),sql`, `)})`);
  }
  if (filter.status) conditions.push(sql`l.status=${oneOf(filter.status,leadStates)}`);
  if (filter.type) conditions.push(sql`l.type=${oneOf(filter.type,types)}`);
  if (filter.owner) { id(filter.owner); conditions.push(sql`l."postedByUid"=${filter.owner}`); }
  if (filter.search) {
    const pattern = `%${text(filter.search,200).replace(/[\\%_]/g,"\\$&")}%`;
    conditions.push(sql`(l.title ilike ${pattern} or l.description ilike ${pattern} or l.location ilike ${pattern} or p."displayName" ilike ${pattern} or p.username ilike ${pattern} or array_to_string(l.skills,' ') ilike ${pattern})`);
  }
  return rows(await db.execute(sql`select ${leadColumns} from leads l left join profiles p on p.uid=l."postedByUid" where ${sql.join(conditions,sql` and `)} order by l."postedAt" desc,l.id desc`)).map(lead);
}
export async function getLead(db: ContentDatabase, leadId: string): Promise<Lead | null> {
  id(leadId);
  const found = rows(await db.execute(sql`select ${leadColumns} from leads l left join profiles p on p.uid=l."postedByUid" where l.id=${leadId}`));
  return found.length ? lead(found[0]) : null;
}
export async function createLead(db: ContentDatabase, uid: string | null, input: LeadInput): Promise<string> {
  identity(uid); const v=leadInput(input);
  const found=rows(await db.execute(sql`insert into leads (title,description,budget,currency,location,type,skills,"postedByUid") values (${v.title},${v.description},${v.budget},${v.currency},${v.location},${v.type},${arr(v.skills)},${uid}) returning id`));
  return String(found[0].id);
}
/** No hard-delete workflow existed. Closing archives a lead and retains commercial history. */
export async function updateLead(db: ContentTransactionDatabase, uid: string | null, leadId: string, patch: Partial<LeadInput> & { status?:string }, staffArchive = false) {
  identity(uid); id(leadId);
  return db.transaction(async tx => {
    const found=rows(await tx.execute(sql`select * from leads where id=${leadId} for update`));
    if (!found.length) throw new MarketplaceError(404,"not_found");
    const old=found[0];
    if (staffArchive) {
      const actor=rows(await tx.execute(sql`select role from profiles where uid=${uid}`))[0];
      if (!actor || !["admin","moderator"].includes(String(actor.role))) throw new MarketplaceError(403,"forbidden");
    } else if (old.postedByUid !== uid) throw new MarketplaceError(404,"not_found");
    const v=leadInput({ ...old,...(staffArchive ? {} : patch) } as unknown as LeadInput);
    const status=staffArchive ? "closed" : oneOf(patch.status ?? old.status,leadStates);
    await tx.execute(sql`update leads set title=${v.title},description=${v.description},budget=${v.budget},currency=${v.currency},location=${v.location},type=${v.type},skills=${arr(v.skills)},status=${status} where id=${leadId}`);
  });
}
const applicationColumns=sql`a.*, ${leadColumns}, a.id as "applicationId", a.status as "applicationStatus", a."createdAt" as "applicationCreatedAt", a."updatedAt" as "applicationUpdatedAt",
 jsonb_build_object('uid',ap.uid,'username',ap.username,'name',coalesce(nullif(ap."displayName",''),ap.username,'Unknown'),'avatarUrl',ap."avatarUrl",'reputation',ap.reputation,'isVerifiedPro',ap."isVerifiedPro") as applicant`;
function application(r: Record<string,unknown>): LeadApplication {
  return { id:String(r.applicationId),leadId:String(r.leadId),applicantUid:String(r.applicantUid),proposal:String(r.proposal),status:r.applicationStatus as ApplicationStatus,
    createdAt:ms(r.applicationCreatedAt),updatedAt:ms(r.applicationUpdatedAt),applicant:r.applicant as LeadApplication["applicant"],lead:lead(r) };
}
export type ApplicationView = "sent" | "received" | "mine" | "lead" | "detail";
/** Privacy is applied in SQL before any commercial proposal leaves the DB. Staff do not bypass it. */
export async function listApplications(db: ContentDatabase, uid: string | null, view: ApplicationView, target?: string): Promise<LeadApplication[]> {
  identity(uid);
  let condition=sql`false`;
  if (view === "sent") condition=sql`a."applicantUid"=${uid}`;
  if (view === "received") condition=sql`l."postedByUid"=${uid}`;
  if (["mine","lead","detail"].includes(view)) {
    id(target ?? "");
    if (view === "mine") condition=sql`a."leadId"=${target} and a."applicantUid"=${uid}`;
    if (view === "detail") condition=sql`a.id=${target} and (a."applicantUid"=${uid} or l."postedByUid"=${uid})`;
    if (view === "lead") {
      // Explicit owner view: don't confuse another user's lead with an empty inbox.
      const owned=rows(await db.execute(sql`select id from leads where id=${target} and "postedByUid"=${uid}`));
      if (!owned.length) throw new MarketplaceError(404,"not_found");
      condition=sql`a."leadId"=${target} and l."postedByUid"=${uid}`;
    }
  }
  return rows(await db.execute(sql`select ${applicationColumns} from lead_applications a join leads l on l.id=a."leadId" left join profiles p on p.uid=l."postedByUid" left join profiles ap on ap.uid=a."applicantUid" where ${condition} order by a."createdAt" desc,a.id desc`)).map(application);
}
/** Lock lead first on EVERY lifecycle path, then application: consistent order, exact count deltas. */
export async function submitApplication(db: ContentTransactionDatabase, uid: string | null, leadId: string, proposal: string): Promise<LeadApplication> {
  identity(uid); id(leadId); const note=text(proposal,20000);
  return db.transaction(async tx => {
    const l=rows(await tx.execute(sql`select id,status,"postedByUid" from leads where id=${leadId} for update`))[0];
    if (!l) throw new MarketplaceError(404,"not_found");
    if (l.postedByUid === uid) throw new MarketplaceError(403,"self_application");
    if (l.status !== "open") throw new MarketplaceError(409,"lead_not_open");
    const old=rows(await tx.execute(sql`select id,status from lead_applications where "leadId"=${leadId} and "applicantUid"=${uid} for update`))[0];
    let appId: unknown;
    if (old) {
      if (old.status !== "withdrawn") throw new MarketplaceError(409,"already_applied");
      await tx.execute(sql`update lead_applications set proposal=${note},status='pending',"updatedAt"=now() where id=${old.id}`);
      appId=old.id;
    } else {
      appId=rows(await tx.execute(sql`insert into lead_applications ("leadId","applicantUid",proposal) values (${leadId},${uid},${note}) returning id`))[0].id;
    }
    await tx.execute(sql`update leads set "applicantsCount"="applicantsCount"+1 where id=${leadId}`);
    // Hydrate before commit: a hydration failure must roll back the submission too.
    const hydrated=(await listApplications(tx,uid,"detail",String(appId)))[0];
    if (!hydrated) throw new MarketplaceError(503,"application_hydration_failed");
    return hydrated;
  });
}
export async function setApplicationStatus(db: ContentTransactionDatabase, uid: string | null, applicationId: string, status: string) {
  identity(uid); id(applicationId); oneOf(status,appStates);
  return db.transaction(async tx => {
    const l=rows(await tx.execute(sql`select l.* from leads l where l.id=(select a."leadId" from lead_applications a where a.id=${applicationId} and (a."applicantUid"=${uid} or exists(select 1 from leads own where own.id=a."leadId" and own."postedByUid"=${uid}))) for update`))[0];
    if (!l) throw new MarketplaceError(404,"not_found");
    const a=rows(await tx.execute(sql`select * from lead_applications where id=${applicationId} for update`))[0];
    if (!a) throw new MarketplaceError(404,"not_found");
    const applicant=a.applicantUid === uid, owner=l.postedByUid === uid;
    if (applicant) {
      if (!["withdrawn","pending"].includes(status)) throw new MarketplaceError(403,"forbidden");
      if (status === "pending" && a.status !== "withdrawn") throw new MarketplaceError(409,"invalid_transition");
      if (status === "pending" && l.status !== "open") throw new MarketplaceError(409,"lead_not_open");
    } else if (owner) {
      if (!["pending","accepted","rejected"].includes(status)) throw new MarketplaceError(403,"forbidden");
      if (a.status === "withdrawn") throw new MarketplaceError(409,"application_withdrawn");
    } else throw new MarketplaceError(404,"not_found");
    if (a.status === status) return;
    const delta=(a.status === "withdrawn" ? 1 : 0)-(status === "withdrawn" ? 1 : 0);
    await tx.execute(sql`update lead_applications set status=${status},"updatedAt"=now() where id=${applicationId}`);
    if (delta) await tx.execute(sql`update leads set "applicantsCount"="applicantsCount"+${delta} where id=${l.id}`);
  });
}
function pipeline(r: Record<string,unknown>): PipelineItem { return { ...r,createdAt:iso(r.createdAt),updatedAt:iso(r.updatedAt) } as unknown as PipelineItem; }
export async function listPipeline(db: ContentDatabase, uid: string | null): Promise<PipelineItem[]> {
  identity(uid);
  return rows(await db.execute(sql`select * from lead_pipeline where "userUid"=${uid} order by "updatedAt" desc,id desc`)).map(pipeline);
}
export interface PipelineInput { title:string; clientName:string; budget?:string; leadId?:string|null; source?:string }
export async function addPipeline(db: ContentDatabase, uid: string | null, input: PipelineInput): Promise<PipelineItem> {
  identity(uid);
  if (input.leadId !== undefined && input.leadId !== null) id(input.leadId);
  const title=text(input.title,180),client=text(input.clientName,120),budget=text(input.budget ?? "",80,true),source=text(input.source ?? "Manual",80,true);
  const found=rows(await db.execute(sql`insert into lead_pipeline ("userUid","leadId",title,"clientName",budget,source) values (${uid},${input.leadId ?? null},${title},${client},${budget},${source}) on conflict ("userUid","leadId") do nothing returning *`));
  if (!found.length) throw new MarketplaceError(409,"already_in_pipeline");
  return pipeline(found[0]);
}
export async function setPipelineStage(db: ContentDatabase, uid: string | null, itemId: string, stage: string) {
  identity(uid); id(itemId); oneOf(stage,stages);
  const updated=rows(await db.execute(sql`update lead_pipeline set stage=${stage},"updatedAt"=now() where id=${itemId} and "userUid"=${uid} returning id`));
  if (!updated.length) throw new MarketplaceError(404,"not_found");
}
export async function removePipeline(db: ContentDatabase, uid: string | null, itemId: string) {
  identity(uid); id(itemId);
  const deleted=rows(await db.execute(sql`delete from lead_pipeline where id=${itemId} and "userUid"=${uid} returning id`));
  if (!deleted.length) throw new MarketplaceError(404,"not_found");
}
