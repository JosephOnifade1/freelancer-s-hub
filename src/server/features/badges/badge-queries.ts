import { sql } from "drizzle-orm";
import type { ContentDatabase } from "../content/content-queries";
import type { Badge, UserBadge } from "@/lib/badges";
const rows = (r: unknown): Record<string, unknown>[] =>
  Array.isArray(r) ? r : (r as { rows: Record<string, unknown>[] }).rows;
export async function listBadges(db: ContentDatabase): Promise<Badge[]> {
  return rows(
    await db.execute(
      sql`select id,name,description,icon,category,target,rarity from badges order by category,target,id`,
    ),
  ) as unknown as Badge[];
}
/** Public earned-badge projection matches legacy SELECT policy. No award endpoint. */
export async function listUserBadges(
  db: ContentDatabase,
  uid: string,
): Promise<UserBadge[]> {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)
  )
    throw new Error("invalid_uid");
  return rows(
    await db.execute(
      sql`select id,"userUid","badgeId","earnedAt" from user_badges where "userUid"=${uid} order by "earnedAt" desc,id desc`,
    ),
  ).map((r) => ({
    id: String(r.id),
    userUid: String(r.userUid),
    badgeId: String(r.badgeId),
    earnedAt: new Date(r.earnedAt as string).toISOString(),
  }));
}
