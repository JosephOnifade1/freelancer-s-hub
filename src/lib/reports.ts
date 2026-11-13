import { fetchLeadsByIds, archiveLeadAsStaff } from "./leads";
import { supabase } from "./supabase";
import { fetchPublicProfiles, fetchModerationProfiles, isProfileError } from "./profile-client";
import {
  changeUserRole,
  changeUserVerification,
  fetchContentPreviews,
  hydrateAuthors,
  isContentError,
} from "./content-client";

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

  // Enrich reporter names with public profile data.
  //
  // Phase 2C: one batched Neon read replaces a loop that issued one Supabase query per
  // distinct reporter. A failed lookup degrades to unnamed reporters rather than
  // failing the moderation queue — the reports themselves are the payload.
  const uids = [...new Set(reports.map((r) => r.reporterUid))];
  const reporterResult = await fetchPublicProfiles(uids);
  if (!isProfileError(reporterResult)) {
    const byUid = new Map(reporterResult.data.map((profile) => [profile.uid, profile]));
    reports.forEach((report) => {
      const profile = byUid.get(report.reporterUid);
      if (!profile) return;
      report.reporter = {
        uid: profile.uid,
        username: profile.username,
        name: profile.displayName || profile.username || "Unknown",
      };
    });
  }

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

  // Posts and comments — Phase 2D reads Neon, in one batched staff-only request.
  //
  // The two embedded `profiles!` joins are gone: the preview payload carries
  // `authorUid` and the names are hydrated from the public profile projection, so
  // `role` cannot appear in a moderation preview. The batch is a single call because
  // the report queue needs previews for a whole page at once.
  if (postIds.length > 0 || commentIds.length > 0) {
    const previewResult = await fetchContentPreviews(postIds, commentIds);
    if (!isContentError(previewResult)) {
      const authorUids = [
        ...previewResult.data.posts.map((row) => row.authorUid),
        ...previewResult.data.comments.map((row) => row.authorUid),
      ];
      const names = await hydrateAuthors(authorUids);

      previewResult.data.posts.forEach((row) => {
        previews.set(row.id, {
          entityId: row.id,
          title: row.title,
          body: row.body,
          authorName: names.get(row.authorUid)?.name,
          authorUid: row.authorUid,
          isDeleted: row.isDeleted,
        });
      });

      previewResult.data.comments.forEach((row) => {
        previews.set(row.id, {
          entityId: row.id,
          body: row.body,
          authorName: names.get(row.authorUid)?.name,
          authorUid: row.authorUid,
          isDeleted: row.isDeleted,
        });
      });
    }
  }

  // Leads
  if (leadIds.length > 0) {
    const data = await fetchLeadsByIds(leadIds);
    data.forEach((row) => {
      previews.set(row.id, { entityId: row.id,title: row.title,body: row.description,
        authorName: row.postedBy.name,authorUid: row.postedBy.uid,isDeleted: row.status === "closed" });
    });
  }

  // Profiles — Phase 2C reads Neon. This is the reported *subject's* profile, so the
  // public projection is the right shape: moderation needs the name and bio, not the
  // account's role.
  if (profileIds.length > 0) {
    const profileResult = await fetchPublicProfiles(profileIds);
    if (!isProfileError(profileResult)) {
      profileResult.data.forEach((profile) => {
        previews.set(profile.uid, {
          entityId: profile.uid,
          body: profile.bio,
          authorName: profile.displayName || profile.username,
          authorUid: profile.uid,
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
  // Only the lead-close side effect moved. Report persistence/RPC remains Supabase.
  // Close first, then resolve: if the report write fails it remains open for retry.
  let removeLegacyContent = removeContent;
  if (removeContent) {
    if (!["open", "resolved", "dismissed"].includes(newStatus)) throw new Error("Invalid report status.");
    const { data: report, error: lookupError } = await supabase.from("reports")
      .select("entityType, entityId").eq("id", reportId).single();
    if (lookupError || !report) throw new Error("Could not load the report.");
    if (report.entityType === "lead") {
      await archiveLeadAsStaff(report.entityId);
      removeLegacyContent = false;
    }
  }
  const { error } = await supabase.rpc("moderate_report", {
    report_id: reportId,
    new_status: newStatus,
    remove_content: removeLegacyContent,
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
  // Phase 2C: this is the one profile list that needs `role`, so it goes through a
  // dedicated admin path rather than the public projection. The route gates on the
  // caller's own role server-side — see `docs/PHASE_2C_PROFILE_DOMAIN_MIGRATION.md` §7.
  const result = await fetchModerationProfiles(limit);
  if (isProfileError(result)) throw new Error("Could not load moderation users.");
  return result.data.map((row) => ({ ...row, role: row.role as UserRole }));
};

/**
 * Sets Verified Pro.
 *
 * Phase 2D §7: this used to call the Supabase RPC `set_user_verified_pro`, which was
 * `SECURITY DEFINER` and checked `is_admin(auth.uid())`. It now goes to a server-only
 * Neon mutation that performs the same check — the actor's own `role` is read from
 * Neon, and the session supplies the actor, so neither can be spoofed from the body.
 *
 * Verification was never self-service and still is not.
 */
export const setUserVerifiedPro = async (targetUid: string, verified: boolean): Promise<void> => {
  const result = await changeUserVerification(targetUid, verified);

  if (isContentError(result)) {
    if (result.error === "unauthenticated") throw new Error("Sign in to continue.");
    if (result.error === "forbidden") throw new Error("Only admins can change Verified Pro status");
    if (result.error === "not_found") throw new Error("User not found");
    throw new Error("Could not update Verified Pro status. Please try again.");
  }
};

/**
 * Changes a user's global role.
 *
 * Phase 2D §7: replaces the Supabase RPC `set_user_role`. Admin only, and an admin
 * still cannot demote themselves — that guard from the RPC is carried over because
 * losing the last administrator is unrecoverable through the UI.
 */
export const setUserRole = async (targetUid: string, newRole: UserRole): Promise<void> => {
  const result = await changeUserRole(targetUid, newRole as "admin" | "moderator" | "member");

  if (isContentError(result)) {
    if (result.error === "unauthenticated") throw new Error("Sign in to continue.");
    if (result.error === "forbidden") throw new Error("Only admins can change roles");
    if (result.error === "not_found") throw new Error("User not found");
    if (result.error === "conflict") throw new Error("Admins cannot demote themselves");
    throw new Error("Could not change that role. Please try again.");
  }
};
