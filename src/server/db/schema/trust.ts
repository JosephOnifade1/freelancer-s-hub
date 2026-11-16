import { sql } from "drizzle-orm";
import { pgTable, uuid, text, boolean, integer, index, check, unique, timestamp } from "drizzle-orm/pg-core";
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

// ---------------------------------------------------------------------------
// karma_events — append-only reputation ledger (migration 0009)
// ---------------------------------------------------------------------------
// Every reputation-affecting action appends a row. Never DELETE or UPDATE;
// emit a compensating negative delta instead.
// castVote must write karma_events inside the same pg_advisory_xact_lock
// transaction for consistency.

export const KARMA_REASONS = [
  "post_upvoted",
  "post_downvoted",
  "comment_upvoted",
  "comment_downvoted",
  "solution_accepted",
  "solution_given",
  "post_created",
  "post_removed_by_mod",
  "comment_removed_by_mod",
  "referral_joined",
  "manual_adjustment",
] as const;

export type KarmaReason = (typeof KARMA_REASONS)[number];

export const karmaEvents = pgTable("karma_events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  profileUid:  uuid("profileUid").notNull().references(()=>profiles.uid,{onDelete:"cascade"}),
  delta:       integer("delta").notNull(),
  reason:      text("reason").notNull(),
  entityType:  text("entityType"),
  entityId:    uuid("entityId"),
  actorUid:    uuid("actorUid").references(()=>profiles.uid,{onDelete:"set null"}),
  createdAt:   timestamp("createdAt",{withTimezone:true,mode:"date"}).notNull().defaultNow(),
}, t=>[
  index("karma_events_profile_created_idx").on(t.profileUid, t.createdAt, t.id),
  index("karma_events_entity_idx").on(t.entityType, t.entityId),
  check("karma_events_reason_check", sql`${t.reason} in ('post_upvoted','post_downvoted','comment_upvoted','comment_downvoted','solution_accepted','solution_given','post_created','post_removed_by_mod','comment_removed_by_mod','referral_joined','manual_adjustment')`),
]);

// ---------------------------------------------------------------------------
// moderation_actions — structured audit log for all moderator decisions
// ---------------------------------------------------------------------------

export const MOD_ACTIONS = [
  "remove","restore","ban","unban","warn","pin","unpin","lock","unlock","mark_spam","mark_nsfw",
] as const;

export type ModAction = (typeof MOD_ACTIONS)[number];

export const moderationActions = pgTable("moderation_actions", {
  id:               uuid("id").primaryKey().defaultRandom(),
  moderatorUid:     uuid("moderatorUid").notNull().references(()=>profiles.uid,{onDelete:"set null"}),
  entityType:       text("entityType").notNull(),
  entityId:         uuid("entityId").notNull(),
  action:           text("action").notNull(),
  reason:           text("reason").notNull().default(""),
  resolvedReportId: uuid("resolvedReportId").references(()=>reports.id,{onDelete:"set null"}),
  createdAt:        timestamp("createdAt",{withTimezone:true,mode:"date"}).notNull().defaultNow(),
}, t=>[
  index("mod_actions_entity_idx").on(t.entityType, t.entityId, t.createdAt),
  index("mod_actions_moderator_idx").on(t.moderatorUid, t.createdAt),
  check("mod_actions_entity_check", sql`${t.entityType} in ('post','comment','profile','lead')`),
  check("mod_actions_action_check", sql`${t.action} in ('remove','restore','ban','unban','warn','pin','unpin','lock','unlock','mark_spam','mark_nsfw')`),
]);
