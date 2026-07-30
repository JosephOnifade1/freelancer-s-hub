import { supabase } from "./supabase";

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

  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabase.from("posts").select("authorUid, createdAt").eq("isDeleted", false).gte("createdAt", sevenDaysAgo),
    supabase.from("comments").select("authorUid, createdAt").eq("isDeleted", false).gte("createdAt", sevenDaysAgo),
  ]);

  const counts: Record<string, number> = {};
  [...(posts || []), ...(comments || [])].forEach((row: any) => {
    if (!row.authorUid) return;
    counts[row.authorUid] = (counts[row.authorUid] || 0) + 1;
  });

  const topUids = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([uid]) => uid);

  if (topUids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("uid, username, displayName, avatarUrl, isVerifiedPro")
    .in("uid", topUids);

  return topUids
    .map((uid) => {
      const profile = (profiles || []).find((p: any) => p.uid === uid);
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

  const [{ data: posts }, { data: comments }] = await Promise.all([
    supabase.from("posts").select("createdAt").eq("authorUid", uid).eq("isDeleted", false).gte("createdAt", ninetyDaysAgo),
    supabase.from("comments").select("createdAt").eq("authorUid", uid).eq("isDeleted", false).gte("createdAt", ninetyDaysAgo),
  ]);

  const activeDates = new Set<string>();
  [...(posts || []), ...(comments || [])].forEach((row: any) => {
    activeDates.add(new Date(row.createdAt).toISOString().slice(0, 10));
  });

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
  const { data: posts } = await supabase
    .from("posts")
    .select("id, createdAt, commentCount")
    .eq("isDeleted", false);

  if (!posts || posts.length === 0) {
    return { helpfulRate: 0, avgResponseLabel: "—" };
  }

  const postsWithReplies = posts.filter((p: any) => (p.commentCount || 0) > 0);
  const helpfulRate = Math.round((postsWithReplies.length / posts.length) * 100);

  if (postsWithReplies.length === 0) {
    return { helpfulRate, avgResponseLabel: "—" };
  }

  const { data: firstComments } = await supabase
    .from("comments")
    .select("postId, createdAt")
    .eq("isDeleted", false)
    .in("postId", postsWithReplies.map((p: any) => p.id))
    .order("createdAt", { ascending: true });

  const firstCommentByPost: Record<string, string> = {};
  (firstComments || []).forEach((c: any) => {
    if (!firstCommentByPost[c.postId]) firstCommentByPost[c.postId] = c.createdAt;
  });

  const diffsMs: number[] = [];
  postsWithReplies.forEach((p: any) => {
    const firstReply = firstCommentByPost[p.id];
    if (firstReply) {
      diffsMs.push(new Date(firstReply).getTime() - new Date(p.createdAt).getTime());
    }
  });

  if (diffsMs.length === 0) return { helpfulRate, avgResponseLabel: "—" };

  const avgMs = diffsMs.reduce((sum, d) => sum + d, 0) / diffsMs.length;
  const avgMinutes = avgMs / 60000;

  let avgResponseLabel: string;
  if (avgMinutes < 60) avgResponseLabel = `${Math.max(1, Math.round(avgMinutes))}m`;
  else if (avgMinutes < 60 * 24) avgResponseLabel = `${Math.round(avgMinutes / 60)}h`;
  else avgResponseLabel = `${Math.round(avgMinutes / (60 * 24))}d`;

  return { helpfulRate, avgResponseLabel };
};
