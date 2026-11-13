import { trustRequest } from "./trust-client";
import { fetchModerationProfiles, isProfileError } from "./profile-client";
import {
  changeUserRole,
  changeUserVerification,
  isContentError,
} from "./content-client";
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
  {
    value: "other",
    label: "Something else",
    description: "Anything not covered above.",
  },
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

export const fetchRecentReportCount = async (_uid: string): Promise<number> =>
  trustRequest("recent-reports");
export const checkReportRateLimit = async (uid: string): Promise<void> => {
  if ((await fetchRecentReportCount(uid)) >= MAX_REPORTS_PER_24H)
    throw new Error(
      "You've filed 10 reports in the last 24 hours. Please wait before filing more.",
    );
};
export const createReport = async (input: {
  reporterUid: string;
  entityType: ReportEntityType;
  entityId: string;
  reason: ReportReason;
  details?: string;
}): Promise<void> => {
  const { entityType, entityId, reason, details } = input;
  await trustRequest("reports", {}, "POST", {
    entityType,
    entityId,
    reason,
    details,
  });
};
/** Keyset pages bound individual HTTP/SQL reads while preserving the full queue/history UI. */
async function allReports(
  op: string,
  params: Record<string, string> = {},
): Promise<Report[]> {
  const result: Report[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await trustRequest<Report[]>(
      op,
      before ? { ...params, before } : params,
    );
    result.push(...page);
    if (page.length < 100) return result;
    const cursor = page[page.length - 1].id;
    if (cursor === before) throw new Error("Could not advance report history.");
    before = cursor;
  }
}
export const fetchReports = (status?: ReportStatus): Promise<Report[]> =>
  allReports("reports", status ? { status } : {});
export const fetchOpenReportsCount = async (): Promise<number> =>
  trustRequest("open-reports");
export const fetchMyReports = (_uid: string): Promise<Report[]> =>
  allReports("my-reports");
export const fetchReportContentPreviews = async (
  reports: Report[],
): Promise<Map<string, ReportContentPreview>> => {
  const result = new Map<string, ReportContentPreview>();
  for (let i = 0; i < reports.length; i += 100) {
    const page = await trustRequest<
      (ReportContentPreview & { entityType: string })[]
    >("previews", {}, "POST", {
      ids: reports.slice(i, i + 100).map((r) => r.id),
    });
    for (const p of page) result.set(`${p.entityType}:${p.entityId}`, p);
  }
  return result;
};
export const moderateReport = async (
  id: string,
  status: ReportStatus,
  remove = false,
): Promise<void> =>
  trustRequest("moderate", { id }, "PATCH", { status, remove });

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

export const fetchModerationUsers = async (
  limit = 50,
): Promise<ModerationUser[]> => {
  // Phase 2C: this is the one profile list that needs `role`, so it goes through a
  // dedicated admin path rather than the public projection. The route gates on the
  // caller's own role server-side — see `docs/PHASE_2C_PROFILE_DOMAIN_MIGRATION.md` §7.
  const result = await fetchModerationProfiles(limit);
  if (isProfileError(result))
    throw new Error("Could not load moderation users.");
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
export const setUserVerifiedPro = async (
  targetUid: string,
  verified: boolean,
): Promise<void> => {
  const result = await changeUserVerification(targetUid, verified);

  if (isContentError(result)) {
    if (result.error === "unauthenticated")
      throw new Error("Sign in to continue.");
    if (result.error === "forbidden")
      throw new Error("Only admins can change Verified Pro status");
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
export const setUserRole = async (
  targetUid: string,
  newRole: UserRole,
): Promise<void> => {
  const result = await changeUserRole(
    targetUid,
    newRole as "admin" | "moderator" | "member",
  );

  if (isContentError(result)) {
    if (result.error === "unauthenticated")
      throw new Error("Sign in to continue.");
    if (result.error === "forbidden")
      throw new Error("Only admins can change roles");
    if (result.error === "not_found") throw new Error("User not found");
    if (result.error === "conflict")
      throw new Error("Admins cannot demote themselves");
    throw new Error("Could not change that role. Please try again.");
  }
};
