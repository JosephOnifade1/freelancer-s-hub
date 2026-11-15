import {DOCUMENT_KEY_PATTERN} from "../../storage/document-key";
import { pgTable, text, uuid, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./identity";
import { posts } from "./content";
import { authUsers } from "./auth";
/** Retained tombstones serialize registration/deletion and authorize retry. */
export const documentUploads = pgTable("document_uploads", {
  path: text("path").primaryKey(), attachmentId: uuid("attachment_id").unique(), actor: uuid("actor").notNull().references(() => profiles.uid, {onDelete:"restrict"}),
  postId: uuid("post_id").notNull().references(() => posts.id, {onDelete:"restrict"}),
  bucket: text("bucket").notNull().default("post-documents"), size: integer("size").notNull(), mime: text("mime").notNull(),
  state: text("state").notNull().default("uploading"), expiresAt: timestamp("expires_at", {withTimezone:true}).notNull(),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
}, t => [check("document_upload_key",sql`${t.path} ~ ${sql.raw("'"+DOCUMENT_KEY_PATTERN+"'")} and split_part(${t.path},'/',1)=${t.actor}::text and split_part(${t.path},'/',2)=${t.postId}::text`),check("document_upload_bucket",sql`${t.bucket} = 'post-documents'`),check("document_upload_state",sql`${t.state} in ('uploading','ready','registered','delete_pending','deleted')`),check("document_upload_size",sql`${t.size} between 1 and 10485760`)]);
/** Only the owner-local seed service writes this registry, never an HTTP API. */
export const developmentSeedIdentities = pgTable("development_seed_identities", {
  userId: uuid("user_id").primaryKey().references(() => authUsers.id, {onDelete:"restrict"}),
  email: text("email").notNull().unique(), purpose: text("purpose").notNull().unique(),
  owner: uuid("owner").notNull(), createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
});
