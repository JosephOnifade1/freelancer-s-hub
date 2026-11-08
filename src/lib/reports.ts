import { supabase } from "./supabase";

/**
 * Content reports + the moderation queue.
 *
 * Reports are persisted in the `reports` table (replacing the old
 * toast-only Report buttons, which stored nothing). Users file reports;
 * moderators/admins resolve them through the `moderate_report` RPC,
 * which can also remove the reported content atomically. Verified Pro
 * and role changes go through admin-only RPCs — profile RLS correctly
 * prevents editing other users' rows directly.
 */

export type ReportEntityType = "post" | "comment" | "lead" | "profile";
export type ReportReason = "spam" | "harassment" | "scam" | "inappropriate" | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type UserRole = "admin" | "moderator" | "member";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam or self-promotion" },
  { value: "harassment", label: "Harassment or abuse" },
  { value: "scam", label: "Scam or fraud" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

export interface Report {
  id: string;
  reporterUid: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  resolvedBy?: string;
  createdAt: number;
  updatedAt: number;
  reporter?: { uid: string; username?: string; name: string };
}

interface ReportRow {
  id: string;
  reporterUid: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const rowToReport = (row: ReportRow): Report => ({
  id: row.id,
  reporterUid: row.reporterUid,
  entityType: row.entityType,
  entityId: row.entityId,
  reason: row.reason,
  details: row.details || "",
  status: row.status,
  resolvedBy: row.resolvedBy ?? undefined,
  createdAt: new Date(row.createdAt).getTime(),
  updatedAt: new Date(row.updatedAt).getTime(),
});

export const createReport = async (input: {
  reporterUid: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> => {
  const { error } = await supabase.from("reports").insert({
    reporterUid: input.reporterUid,
    entityType: input.entityType,
    entityId: input.entityId,
    reason: input.reason,
    details: input.details?.trim() || "",
  });

  if (error) throw new Error(error.message);
};

/** Moderation queue (RLS limits rows to moderators/admins + own reports). */
export const fetchReports = async (status?: ReportStatus): Promise<Report[]> => {
  let query = supabase
    .from("reports")
    .select("*")
    .order("createdAt", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const reports = (data as ReportRow[]).map(rowToReport);

  // Enrich reporter names with plain profile lookups (public-read).
  const uids = [...new Set(reports.map((r) => r.reporterUid))];
  await Promise.all(
    uids.map(async (uid) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("uid, username, displayName")
        .eq("uid", uid)
        .maybeSingle();
      if (!profile) return;
      reports.forEach((r) => {
        if (r.reporterUid === uid) {
          r.reporter = {
            uid: profile.uid,
            username: profile.username,
            name: profile.displayName || profile.username || "Unknown",
          };
        }
      });
    })
  );

  return reports;
};

/** Resolve/dismiss a report, optionally removing the reported content. */
export const moderateReport = async (
  reportId: string,
  newStatus: ReportStatus,
  removeContent = false
): Promise<void> => {
  const { error } = await supabase.rpc("moderate_report", {
    report_id: reportId,
    new_status: newStatus,
    remove_content: removeContent,
  });

  if (error) throw new Error(error.message);
};

/* ── Verified Pro & roles (admin) ─────────────────────────────────────── */

export interface ModerationUser {
  uid: string;
  username?: string;
  name: string;
  avatarUrl?: string;
  reputation: number;
  isVerifiedPro: boolean;
  role: UserRole;
}

/** Reputation threshold at which a user becomes eligible for Verified Pro review. */
export const VERIFIED_PRO_ELIGIBLE_REPUTATION = 1000;

export const fetchModerationUsers = async (limit = 50): Promise<ModerationUser[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("uid, username, displayName, avatarUrl, reputation, isVerifiedPro, role")
    .order("reputation", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((row: Record<string, unknown>) => ({
    uid: String(row.uid),
    username: (row.username as string) || undefined,
    name: (row.displayName as string) || (row.username as string) || "Unknown",
    avatarUrl: (row.avatarUrl as string) || undefined,
    reputation: Number(row.reputation || 0),
    isVerifiedPro: !!row.isVerifiedPro,
    role: ((row.role as string) || "member") as UserRole,
  }));
};

export const setUserVerifiedPro = async (targetUid: string, verified: boolean): Promise<void> => {
  const { error } = await supabase.rpc("set_user_verified_pro", {
    target_uid: targetUid,
    verified,
  });

  if (error) throw new Error(error.message);
};

export const setUserRole = async (targetUid: string, newRole: UserRole): Promise<void> => {
  const { error } = await supabase.rpc("set_user_role", {
    target_uid: targetUid,
    new_role: newRole,
  });

  if (error) throw new Error(error.message);
};
