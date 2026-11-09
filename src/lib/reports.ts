import { supabase } from "./supabase";

/**
 * Content reports + the moderation queue.
 *
 * Reports are persisted in the `reports` table (replacing the old
 * toast-only Report buttons, which stored nothing). Users file reports;
 * moderators/admins work the queue at /admin. Verified Pro and role
 * changes go through admin-only RPCs.
 */

export type ReportEntityType = "post" | "comment" | "lead" | "profile";
export type ReportReason =
  | "spam"
  | "harassment"
  | "scam"
  | "inappropriate"
  | "hate_speech"
  | "misinformation"
  | "copyright"
  | "nsfw"
  | "other";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type UserRole = "admin" | "moderator" | "member";

export const REPORT_REASONS: {
  value: ReportReason;
  label: string;
  description: string;
}[] = [
  {
    value: "spam",
    label: "Spam or self-promotion",
    description: "Unsolicited ads, repetitive posting, or promotional content.",
  },
  {
    value: "harassment",
    label: "Harassment or abuse",
    description: "Targeted abuse, bullying, or intimidation of a user.",
  },
  {
    value: "scam",
    label: "Scam or fraud",
    description: "Fake opportunities, phishing, or misleading offers.",
  },
  {
    value: "inappropriate",
    label: "Inappropriate content",
    description: "Content that doesn't belong on Borynx.",
  },
  {
    value: "hate_speech",
    label: "Hate speech",
    description: "Attacks based on identity, origin, religion, or orientation.",
  },
  {
    value: "misinformation",
    label: "Misinformation",
    description: "False or misleading claims presented as fact.",
  },
  {
    value: "copyright",
    label: "Copyright infringement",
    description: "Content that uses someone else's work without permission.",
  },
  {
    value: "nsfw",
    label: "NSFW / adult content",
    description: "Sexually explicit or gratuitously violent content.",
  },
  { value: "other", label: "Something else", description: "Anything not covered above." },
];

/** Maximum reports a user can file in a rolling 24-hour window. */
export const MAX_REPORTS_PER_24H = 10;

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

/** Preview of the reported content, shown to moderators in the queue. */
export interface ReportContentPreview {
  entityId: string;
  title?: string;
  body?: string;
  authorName?: string;
  authorUid?: string;
  isDeleted?: boolean;
}

interface PreviewRow {
  id: string;
  title?: string;
  body?: string;
  description?: string;
  isDeleted?: boolean;
  authorUid?: string;
  postedByUid?: string;
  profiles?: { username?: string; displayName?: string } | null;
  status?: string;
  bio?: string;
  username?: string;
  displayName?: string;
  uid?: string;
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

/** Rate limit: how many reports has this user filed in the last 24h? */
export const fetchRecentReportCount = async (
  reporterUid: string,
): Promise<number> => {
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  const { count, error } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("reporterUid", reporterUid)
    .gte("createdAt", twentyFourHoursAgo);

  if (error) throw new Error(error.message);
  return count || 0;
};

/** Rate limit check used before filing a report. Throws if over the limit. */
export const checkReportRateLimit = async (
  reporterUid: string,
): Promise<void> => {
  const count = await fetchRecentReportCount(reporterUid);
  if (count >= MAX_REPORTS_PER_24H) {
    throw new Error(
      `You've filed ${count} reports in the last 24 hours. Please wait before filing more.`,
    );
  }
};

export const createReport = async (input: {
  reporterUid: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> => {
  // Rate limit: no more than MAX_REPORTS_PER_24H reports per user per day.
  await checkReportRateLimit(input.reporterUid);

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

/** Count open reports (for moderator badge indicator). */
export const fetchOpenReportsCount = async (): Promise<number> => {
  const { count, error } = await supabase
    .from("reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "open");

  if (error) throw new Error(error.message);
  return count || 0;
};

/** Fetch reports filed by the current user (their report history). */
export const fetchMyReports = async (uid: string): Promise<Report[]> => {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("reporterUid", uid)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return (data as ReportRow[]).map(rowToReport);
};

/**
 * Fetch content previews for a batch of reports, keyed by entityId.
 * Batches queries by entity type so we don't do N individual requests.
 */
export const fetchReportContentPreviews = async (
  reports: Report[],
): Promise<Map<string, ReportContentPreview>> => {
  const previews = new Map<string, ReportContentPreview>();

  const posts = reports.filter((r) => r.entityType === "post");
  const comments = reports.filter((r) => r.entityType === "comment");
  const leads = reports.filter((r) => r.entityType === "lead");
  const profiles = reports.filter((r) => r.entityType === "profile");

  const postIds = [...new Set(posts.map((r) => r.entityId))];
  const commentIds = [...new Set(comments.map((r) => r.entityId))];
  const leadIds = [...new Set(leads.map((r) => r.entityId))];
  const profileIds = [...new Set(profiles.map((r) => r.entityId))];

  // Posts
  if (postIds.length > 0) {
    const { data } = await supabase
      .from("posts")
      .select("id, title, body, isDeleted, authorUid, profiles!posts_authorUid_fkey(username, displayName)")
      .in("id", postIds);
    if (data) {
      (data as PreviewRow[]).forEach((row) => {
        previews.set(row.id, {
          entityId: row.id,
          title: row.title,
          body: row.body,
          authorName: row.profiles?.displayName || row.profiles?.username,
          authorUid: row.authorUid,
          isDeleted: row.isDeleted,
        });
      });
    }
  }

  // Comments
  if (commentIds.length > 0) {
    const { data } = await supabase
      .from("comments")
      .select("id, body, isDeleted, authorUid, profiles!comments_authorUid_fkey(username, displayName)")
      .in("id", commentIds);
    if (data) {
      (data as PreviewRow[]).forEach((row) => {
        previews.set(row.id, {
          entityId: row.id,
          body: row.body,
          authorName: row.profiles?.displayName || row.profiles?.username,
          authorUid: row.authorUid,
          isDeleted: row.isDeleted,
        });
      });
    }
  }

  // Leads
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("leads")
      .select("id, title, description, isDeleted, postedByUid, profiles!leads_postedByUid_fkey(username, displayName)")
      .in("id", leadIds);
    if (data) {
      (data as PreviewRow[]).forEach((row) => {
        previews.set(row.id, {
          entityId: row.id,
          title: row.title,
          body: row.description,
          authorName: row.profiles?.displayName || row.profiles?.username,
          authorUid: row.postedByUid,
          isDeleted: row.status === "closed", // treat closed leads as removed
        });
      });
    }
  }

  // Profiles
  if (profileIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("uid, displayName, username, bio")
      .in("uid", profileIds);
    if (data) {
      (data as PreviewRow[]).forEach((row) => {
        previews.set(row.uid, {
          entityId: row.uid,
          body: row.bio,
          authorName: row.displayName || row.username,
          authorUid: row.uid,
        });
      });
    }
  }

  return previews;
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
