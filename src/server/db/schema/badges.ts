import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  uuid,
  unique,
  index,
  check,
  timestamp,
} from "drizzle-orm/pg-core";
import { profiles } from "./identity";
import { createdAt } from "./_shared";
/** Existing catalog, not new award automation. Only operators write badge records. */
export const badges = pgTable(
  "badges",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull().default("award"),
    category: text("category").notNull().default("community"),
    target: integer("target").notNull().default(1),
    rarity: text("rarity").notNull().default("common"),
    createdAt: createdAt(),
  },
  (t) => [
    check("badges_id_check", sql`length(trim(${t.id})) between 1 and 60`),
    check("badges_name_check", sql`length(trim(${t.name})) between 1 and 100`),
    check(
      "badges_description_check",
      sql`length(trim(${t.description})) between 1 and 300`,
    ),
    check(
      "badges_category_check",
      sql`${t.category} in ('publishing','helping','community','trust','longevity')`,
    ),
    check("badges_target_check", sql`${t.target}>0`),
    check(
      "badges_rarity_check",
      sql`${t.rarity} in ('common','uncommon','rare','legendary')`,
    ),
  ],
);
export const userBadges = pgTable(
  "user_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userUid: uuid("userUid")
      .notNull()
      .references(() => profiles.uid, { onDelete: "cascade" }),
    badgeId: text("badgeId")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earnedAt", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("user_badges_user_badge_unique").on(t.userUid, t.badgeId),
    index("user_badges_user_earned_idx").on(t.userUid, t.earnedAt),
    index("user_badges_badge_idx").on(t.badgeId),
  ],
);
