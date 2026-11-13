/** Static absence/architecture guards, not database evidence. */
import { describe,it,expect } from "vitest";
import { readdirSync,readFileSync } from "node:fs";
const read=(file:string)=>readFileSync(file,"utf8");
const code=(file:string)=>read(file).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
function walk(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):/\.[jt]sx?$/.test(e.name)?[`${dir}/${e.name}`]:[]);}
const production=walk("src").filter(f=>!f.includes("mockSupabase")&&!/\.test\./.test(f));
describe("Phase 2F migration boundaries",()=>{
 it("no application path queries migrated Supabase tables or embedded lead profile joins",()=>{
  for(const f of production){expect(read(f),f).not.toMatch(/\.from\(\s*["'](leads|lead_applications|lead_pipeline)["']/);expect(read(f),f).not.toMatch(/profiles!leads_postedByUid_fkey/);}
 });
 it("migrated client workflows have no demo or localStorage persistence fallback",()=>{
  for(const f of ["leads","applications","pipeline","marketplace-client"]){expect(code(`src/lib/${f}.ts`)).not.toMatch(/localStorage|mockSupabase|isDemoMode|from ["']\.\/supabase["']/);}
 });
 it("service is server-only and queries remain injectable",()=>{
  expect(read("src/server/features/marketplace/index.ts").trimStart()).toMatch(/^import "server-only";/);
  expect(read("src/server/features/marketplace/marketplace-queries.ts")).not.toMatch(/from ["']@\/server\/db["']/);
  for(const f of production.filter(f=>/^src\/(lib|views|components|hooks)\//.test(f)))expect(read(f),f).not.toContain("@/server/features/marketplace");
 });
 it("pipeline remains private prospect tracking, not an invented application stage model",()=>{
  const schema=read("src/server/db/schema/marketplace.ts");
  expect(schema).toContain('unique("pipeline_user_lead_unique")');
  expect(schema).toContain("'new','conversation','proposal','negotiation','won'");
  expect(schema).not.toMatch(/applicationId:\s*uuid|bidAmount|auction/);
 });
 it("applications enforce relational uniqueness and retain commercial audit history",()=>{
  const schema=read("src/server/db/schema/marketplace.ts");
  expect(schema).toContain('unique("applications_lead_applicant_unique")');
  expect(schema).toContain('onDelete:"restrict"');
  expect(schema).toContain("'pending','accepted','rejected','withdrawn'");
 });
 it("lead moderation stops targeting obsolete Supabase lead records",()=>{
  const source=read("src/lib/reports.ts");
  expect(source).toContain("fetchLeadsByIds(leadIds)");
  expect(source).toContain("archiveLeadAsStaff(report.entityId)");
  expect(source).toContain("removeLegacyContent = false");
  expect(source).toContain('supabase.rpc("moderate_report"');
 });
 it("does not replace Auth, Storage or notification/report persistence",()=>{
  expect(read("src/lib/notifications.ts")).toMatch(/\.from\("notifications"\)/);
  expect(read("src/lib/reports.ts")).toMatch(/\.from\("reports"\)/);
  expect(read("src/lib/attachments.ts")).toContain("supabase.storage");
  expect(read("src/server/features/marketplace/index.ts")).toContain("getServerSession()");
 });
 it("schema journal contains a reproducible marketplace migration after social",()=>{
  const journal=JSON.parse(read("src/server/db/migrations/meta/_journal.json"));
  expect(journal.entries.slice(-2).map((entry:{tag:string})=>entry.tag)).toEqual(["0003_community_social_graph","0004_leads_applications_pipeline"]);
  expect(read("src/server/db/migrations/0004_leads_applications_pipeline.sql")).toContain('CREATE TABLE "lead_pipeline"');
 });
});
