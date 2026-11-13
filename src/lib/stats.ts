import { fetchPublicProfiles, isProfileError } from "./profile-client";
import {
  fetchCommunityHealth,
  fetchContributionDates,
  fetchRecentContributors,
  isContentError,
} from "./content-client";

interface AuthoredRow {
  authorUid?: string;
  createdAt: string;
}

interface ProfileContributionRow {
  uid: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  isVerifiedPro?: boolean;
}

interface PostHealthRow {
  id: string;
  createdAt: string;
  commentCount?: number;
}

interface CommentTimingRow {
  postId: string;
  createdAt: string;
}

// ─── Most active this week (replaces the fake "Weekly Leaderboard" XP list) ──
export interface ActiveContributor {
  uid: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  isVerifiedPro?: boolean;
  contributions: number;
}

export const getMostActiveThisWeek = async (limit = 5): Promise<ActiveContributor[]> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Phase 2D: the counting moved into Neon, so this is one aggregate query rather
  // than two full row sets that were reduced in the browser. `sevenDaysAgo` is still
  // computed here so the window matches the `days` the route is asked for.
  void sevenDaysAgo;
  const activity = await fetchRecentContributors(7);
  if (isContentError(activity)) throw new Error("Could not load recent activity.");

  const counts: Record<string, number> = {};
  for (const row of activity.data) {
    if (row.uid) counts[row.uid] = row.contributions;
  }

  const topUids = activity.data.slice(0, limit).map((row) => row.uid);

  if (topUids.length === 0) return [];

  // Phase 2C: one batch read against Neon instead of a Supabase `.in()` filter that
  // only this module and two others used.
  const profilesResult = await fetchPublicProfiles(topUids);
  if (isProfileError(profilesResult)) throw new Error("Could not load active contributors.");
  const profiles = profilesResult.data;

  return topUids
    .map((uid) => {
      const profile = (profiles as unknown as ProfileContributionRow[]).find((p) => p.uid === uid);
      if (!profile) return null;
      return { ...profile, contributions: counts[uid] } as ActiveContributor;
    })
    .filter(Boolean) as ActiveContributor[];
};

// ─── Personal streak (replaces the fake hardcoded "7 days") ──────────────────
export interface StreakData {
  streakDays: number;
  activeWeekdays: number[]; // 0 = Monday ... 6 = Sunday, for the current week
}

export const getUserStreak = async (uid: string): Promise<StreakData> => {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  // Phase 2D: distinct dates, computed in the database. The previous version pulled
  // every post and comment from 90 days and de-duplicated them here.
  void ninetyDaysAgo;
  const dates = await fetchContributionDates(uid, 90);
  if (isContentError(dates)) throw new Error("Could not load your activity.");

  const activeDates = new Set<string>(dates.data);

  // Walk backwards from today counting consecutive active days. A streak is
  // still "alive" if the most recent activity was today or yesterday.
  let streakDays = 0;
  const cursor = new Date();
  const todayStr = cursor.toISOString().slice(0, 10);
  if (!activeDates.has(todayStr)) {
    cursor.setDate(cursor.getDate() - 1); // allow yesterday to still count as "ongoing"
  }
  while (activeDates.has(cursor.toISOString().slice(0, 10))) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Which weekdays (Mon-Sun) in the current week had activity, for the pills.
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // convert Sun=0 to Mon=0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);

  const activeWeekdays: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    if (activeDates.has(d.toISOString().slice(0, 10))) activeWeekdays.push(i);
  }

  return { streakDays, activeWeekdays };
};

// ─── Community health stats (replaces fake "98% Helpful" / "< 1h Avg Response") ──
export interface CommunityHealth {
  helpfulRate: number; // % of posts that got at least one comment
  avgResponseLabel: string; // e.g. "2h", "35m", "1d" or "—" if no data yet
}

export const getCommunityHealthStats = async (): Promise<CommunityHealth> => {
  // Phase 2D: the whole computation is one aggregate query in Neon — counts, plus the
  // first comment per post. The previous version transferred every post and every
  // comment from 90 days to compute two numbers in the browser.
  const health = await fetchCommunityHealth();
  if (isContentError(health)) throw new Error("Could not load post activity.");
  if (health.data.postCount === 0) return { helpfulRate: 0, avgResponseLabel: "—" };

  const helpfulRate = Math.round(
    (health.data.postsWithReplies / health.data.postCount) * 100,
  );

  if (health.data.postsWithReplies === 0) {
    return { helpfulRate, avgResponseLabel: "—" };
  }

  const diffsMs: number[] = [];
  for (const response of health.data.responses) {
    if (!response.firstCommentAt) continue;
    diffsMs.push(
      new Date(response.firstCommentAt).getTime() - new Date(response.postedAt).getTime(),
    );
  }

  if (diffsMs.length === 0) return { helpfulRate, avgResponseLabel: "—" };

  const avgMs = diffsMs.reduce((sum, d) => sum + d, 0) / diffsMs.length;
  const avgMinutes = avgMs / 60000;

  let avgResponseLabel: string;
  if (avgMinutes < 60) avgResponseLabel = `${Math.max(1, Math.round(avgMinutes))}m`;
  else if (avgMinutes < 60 * 24) avgResponseLabel = `${Math.round(avgMinutes / 60)}h`;
  else avgResponseLabel = `${Math.round(avgMinutes / (60 * 24))}d`;

  return { helpfulRate, avgResponseLabel };
};
