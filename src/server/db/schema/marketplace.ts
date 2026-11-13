import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, boolean, index, check, unique, timestamp } from "drizzle-orm/pg-core";
import { createdAt, updatedAt } from "./_shared";
import { profiles } from "./identity";

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(), description: text("description").notNull(),
  budget: text("budget").notNull(), currency: text("currency").notNull(), location: text("location").notNull(),
  type: text("type").notNull(), status: text("status").notNull().default("open"),
  skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
  isVerified: boolean("isVerified").notNull().default(false),
  postedByUid: uuid("postedByUid").notNull().references(() => profiles.uid, { onDelete: "restrict" }),
  postedAt: timestamp("postedAt", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  applicantsCount: integer("applicantsCount").notNull().default(0),
}, t => [
  index("leads_owner_idx").on(t.postedByUid), index("leads_posted_idx").on(t.postedAt,t.id),
  index("leads_status_type_idx").on(t.status,t.type),
  check("leads_type_check",sql`${t.type} in ('Bounty','Project','Retainer','Full-time')`),
  check("leads_status_check",sql`${t.status} in ('open','in-progress','closed')`),
  check("leads_count_check",sql`${t.applicantsCount} >= 0`),
  check("leads_title_check",sql`length(trim(${t.title})) between 1 and 180`),
  check("leads_description_check",sql`length(trim(${t.description})) between 1 and 10000`),
]);
export const leadApplications = pgTable("lead_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  leadId: uuid("leadId").notNull().references(() => leads.id, { onDelete:"restrict" }),
  applicantUid: uuid("applicantUid").notNull().references(() => profiles.uid, { onDelete:"restrict" }),
  proposal: text("proposal").notNull(), status: text("status").notNull().default("pending"),
  createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
  unique("applications_lead_applicant_unique").on(t.leadId,t.applicantUid),
  index("applications_applicant_created_idx").on(t.applicantUid,t.createdAt),
  index("applications_lead_created_idx").on(t.leadId,t.createdAt),
  check("applications_status_check",sql`${t.status} in ('pending','accepted','rejected','withdrawn')`),
  check("applications_proposal_check",sql`length(trim(${t.proposal})) between 1 and 20000`),
]);
/** Independent private prospect tracker. No applicationId or hiring-state coupling existed. */
export const leadPipeline = pgTable("lead_pipeline", {
  id: uuid("id").primaryKey().defaultRandom(),
  userUid: uuid("userUid").notNull().references(() => profiles.uid, { onDelete:"cascade" }),
  leadId: uuid("leadId").references(() => leads.id, { onDelete:"set null" }),
  clientName: text("clientName").notNull(), title: text("title").notNull(),
  budget: text("budget").notNull().default(""), source: text("source").notNull().default("Manual"),
  stage: text("stage").notNull().default("new"), createdAt: createdAt(), updatedAt: updatedAt(),
}, t => [
  unique("pipeline_user_lead_unique").on(t.userUid,t.leadId),
  index("pipeline_user_updated_idx").on(t.userUid,t.updatedAt),
  check("pipeline_stage_check",sql`${t.stage} in ('new','conversation','proposal','negotiation','won')`),
  check("pipeline_client_check",sql`length(trim(${t.clientName})) between 1 and 120`),
  check("pipeline_title_check",sql`length(trim(${t.title})) between 1 and 180`),
  check("pipeline_budget_check",sql`length(${t.budget}) <= 80`),
  check("pipeline_source_check",sql`length(${t.source}) <= 80`),
]);
