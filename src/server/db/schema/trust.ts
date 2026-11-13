import { sql } from "drizzle-orm";
import { pgTable, uuid, text, boolean, index, check, unique } from "drizzle-orm/pg-core";
import { profiles } from "./identity";
import { createdAt, updatedAt } from "./_shared";
export const notifications = pgTable("notifications", {
  id:uuid("id").primaryKey().defaultRandom(),
  userId:uuid("userId").notNull().references(()=>profiles.uid,{onDelete:"cascade"}),
  actorUid:uuid("actorUid").references(()=>profiles.uid,{onDelete:"set null"}),
  type:text("type").notNull(),entityId:uuid("entityId"),contextId:uuid("contextId"),
  message:text("message").notNull(),isRead:boolean("isRead").notNull().default(false),createdAt:createdAt(),
  // Internal source-event identity, never accepted from a browser notification API.
  eventKey:text("eventKey").notNull(),
},t=>[
  unique("notifications_event_recipient_unique").on(t.eventKey,t.userId),
  index("notifications_user_created_idx").on(t.userId,t.createdAt,t.id),
  index("notifications_user_unread_idx").on(t.userId).where(sql`${t.isRead}=false`),
  check("notifications_type_check",sql`${t.type} in ('comment','reply','upvote','follow','application_received','application_accepted','application_rejected','application_withdrawn')`),
]);
/** Targets genuinely span four tables; entityId cannot have a single correct FK. */
export const reports = pgTable("reports", {
  id:uuid("id").primaryKey().defaultRandom(),
  reporterUid:uuid("reporterUid").notNull().references(()=>profiles.uid,{onDelete:"cascade"}),
  entityType:text("entityType").notNull(),entityId:uuid("entityId").notNull(),reason:text("reason").notNull(),
  details:text("details").notNull().default(""),status:text("status").notNull().default("open"),
  resolvedBy:uuid("resolvedBy").references(()=>profiles.uid,{onDelete:"set null"}),createdAt:createdAt(),updatedAt:updatedAt(),
},t=>[
  index("reports_status_created_idx").on(t.status,t.createdAt,t.id),
  index("reports_reporter_created_idx").on(t.reporterUid,t.createdAt),
  check("reports_entity_check",sql`${t.entityType} in ('post','comment','lead','profile')`),
  check("reports_reason_check",sql`${t.reason} in ('spam','harassment','scam','inappropriate','hate_speech','misinformation','copyright','nsfw','other')`),
  check("reports_status_check",sql`${t.status} in ('open','resolved','dismissed')`),
  check("reports_details_check",sql`length(${t.details}) <= 10000`),
]);
