import { pgTable, uuid, text, boolean, timestamp, index, uniqueIndex, bigint, integer } from "drizzle-orm/pg-core";
const time = (name: string) => timestamp(name, { withTimezone: true, mode: "date" }).notNull().defaultNow();
export const authUsers = pgTable("auth_users", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(),
  email: text("email").notNull().unique(), emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"), createdAt: time("created_at"), updatedAt: time("updated_at"),
});
export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(), expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
  ipAddress: text("ip_address"), userAgent: text("user_agent"), createdAt: time("created_at"), updatedAt: time("updated_at"),
}, t => [index("auth_sessions_user_idx").on(t.userId), index("auth_sessions_expiry_idx").on(t.expiresAt)]);
export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(), userId: uuid("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(), password: text("password"),
  accessToken: text("access_token"), refreshToken: text("refresh_token"), idToken: text("id_token"), scope: text("scope"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true, mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true, mode: "date" }),
  createdAt: time("created_at"), updatedAt: time("updated_at"),
}, t => [uniqueIndex("auth_accounts_provider_identity_key").on(t.providerId, t.accountId), index("auth_accounts_user_idx").on(t.userId)]);
export const authVerifications = pgTable("auth_verifications", {
  id: uuid("id").primaryKey().defaultRandom(), identifier: text("identifier").notNull(), value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(), createdAt: time("created_at"), updatedAt: time("updated_at"),
}, t => [index("auth_verifications_identifier_idx").on(t.identifier), index("auth_verifications_expiry_idx").on(t.expiresAt)]);
export const authRateLimits = pgTable("auth_rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(), key: text("key").notNull().unique(), count: integer("count").notNull(), lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
