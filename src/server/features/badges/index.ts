import "server-only";
import { getDatabase, isDatabaseConfigured } from "@/server/db";
import { listBadges, listUserBadges } from "./badge-queries";
/** Catalog and earned rows were public; no privileged profile fields or writes. */
export async function getBadges(uid?: string) {
  if (!isDatabaseConfigured()) throw new Error("database_not_configured");
  return uid === undefined
    ? listBadges(getDatabase())
    : listUserBadges(getDatabase(), uid);
}
