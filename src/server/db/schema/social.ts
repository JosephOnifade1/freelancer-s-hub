import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, primaryKey, index, check, unique } from "drizzle-orm/pg-core";
import { createdAt } from "./_shared";
import { profiles } from "./identity";

/** ownerId deliberately remains text: historical operator-owned rows use 'system'. */
export const communities = pgTable("communities", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  category: text("category").notNull().default("Other"),
  topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
  ownerId: text("ownerId").notNull().default("system"),
  memberCount: integer("memberCount").notNull().default(0),
  createdAt: createdAt(),
}, (t) => [
  unique("communities_slug_unique").on(t.slug),
  index("communities_owner_idx").on(t.ownerId),
  index("communities_count_idx").on(t.memberCount),
  check("communities_slug_check", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 100`),
  check("communities_owner_check", sql`${t.ownerId} = 'system' or ${t.ownerId} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`),
  check("communities_count_check", sql`${t.memberCount} >= 0`),
]);
export const communityMembers = pgTable("community_members", {
  userId: uuid("userId").notNull().references(() => profiles.uid, { onDelete: "restrict" }),
  communityId: uuid("communityId").notNull().references(() => communities.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.userId, t.communityId] }), index("community_members_community_idx").on(t.communityId)]);
export const follows = pgTable("follows", {
  followerId: uuid("followerId").notNull().references(() => profiles.uid, { onDelete: "restrict" }),
  followingId: uuid("followingId").notNull().references(() => profiles.uid, { onDelete: "restrict" }),
}, (t) => [
  primaryKey({ columns: [t.followerId, t.followingId] }),
  index("follows_following_idx").on(t.followingId),
  check("follows_not_self", sql`${t.followerId} <> ${t.followingId}`),
]);
