import { supabase } from "./supabase";

/* ──────────────────────────────────────────────────────────────────────────
   Badges & achievements.

   Reads from the `badges` / `user_badges` tables created by
   supabase_achievements_badges_migration.sql. Until that migration is
   applied to a project, every function falls back to client-side
   computation so the UI keeps working (no hard dependency on the
   unapplied migration).
   ──────────────────────────────────────────────────────────────────────── */

export type BadgeCategory = "publishing" | "helping" | "community" | "trust" | "longevity";
export type BadgeRarity = "common" | "uncommon" | "rare" | "legendary";

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  target: number;
  rarity: BadgeRarity;
}

export interface UserBadge {
  id: string;
  userUid: string;
  badgeId: string;
  earnedAt: string;
}

export interface BadgeProgress {
  badge: Badge;
  current: number;
  unlocked: boolean;
  earnedAt?: string;
}

/* ─── Catalog ───────────────────────────────────────────────────────────── */

export const fetchBadges = async (): Promise<Badge[]> => {
  const { data, error } = await supabase
    .from("badges")
    .select("*")
    .order("category", { ascending: true })
    .order("target", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return (data as Badge[]).map((b) => ({
    ...b,
    category: b.category as BadgeCategory,
    rarity: b.rarity as BadgeRarity,
  }));
};

/* ─── Earned badges ─────────────────────────────────────────────────────── */

export const fetchUserBadges = async (uid: string): Promise<UserBadge[]> => {
  if (!uid) return [];
  const { data, error } = await supabase
    .from("user_badges")
    .select("*")
    .eq("userUid", uid)
    .order("earnedAt", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data as UserBadge[];
};

/* Award a badge to a user. Idempotent via the unique (userUid, badgeId) constraint. */
export const awardBadge = async (uid: string, badgeId: string): Promise<void> => {
  if (!uid || !badgeId) throw new Error("Cannot award badge: missing user or badge.");
  const { error } = await supabase
    .from("user_badges")
    .insert({ userUid: uid, badgeId });
  if (error) throw new Error(error.message);
};

/* ─── Progress computation (server tables + client fallback) ────────────── */

/** Inputs needed to compute every badge's current progress for a user. */
export interface BadgeInputs {
  postCount: number;
  resourceCount: number;
  commentCount: number;
  commentUpvotesReceived: number;
  reputation: number;
  streakDays: number;
  longestStreakDays: number;
  topPostCommentCount: number;
}

/** Default badges used when the `badges` table isn't available yet. */
const DEFAULT_BADGES: Badge[] = [
  { id: "first-post", name: "First Post", description: "Publish your first post.", icon: "Flame", category: "publishing", target: 1, rarity: "common" },
  { id: "rising-voice", name: "Rising Voice", description: "Reach 100 reputation.", icon: "Zap", category: "trust", target: 100, rarity: "common" },
  { id: "helper", name: "Helper", description: "Get 10 upvotes on your comments.", icon: "Heart", category: "helping", target: 10, rarity: "common" },
  { id: "trusted-voice", name: "Trusted Voice", description: "Reach 1,000 reputation.", icon: "Star", category: "trust", target: 1000, rarity: "rare" },
  { id: "consistent", name: "Consistent", description: "Post or comment 30 days in a row.", icon: "Calendar", category: "longevity", target: 30, rarity: "rare" },
  { id: "generous", name: "Generous", description: "Share 5 resource posts.", icon: "BookOpen", category: "publishing", target: 5, rarity: "uncommon" },
  { id: "veteran", name: "Veteran Freelancer", description: "Reach 5,000 reputation.", icon: "Trophy", category: "trust", target: 5000, rarity: "legendary" },
  { id: "convo-starter", name: "Conversation Starter", description: "Get 50 comments on a single post.", icon: "MessageSquare", category: "helping", target: 50, rarity: "uncommon" },
];

/** Compute progress for every badge. Uses live tables when available, falls back to defaults. */
export const computeBadgeProgress = async (
  uid: string | undefined,
  inputs: BadgeInputs,
): Promise<BadgeProgress[]> => {
  const [badges, earned] = await Promise.all([
    fetchBadges().catch(() => DEFAULT_BADGES),
    uid ? fetchUserBadges(uid).catch((): UserBadge[] => []) : [],
  ]);

  const earnedSet = new Set(earned.map((e) => e.badgeId));
  const earnedAtByBadge = Object.fromEntries(earned.map((e) => [e.badgeId, e.earnedAt]));

  return badges.map((badge) => {
    let current = 0;
    switch (badge.id) {
      case "first-post":
        current = inputs.postCount;
        break;
      case "rising-voice":
        current = inputs.reputation;
        break;
      case "helper":
        current = inputs.commentUpvotesReceived;
        break;
      case "trusted-voice":
        current = inputs.reputation;
        break;
      case "consistent":
        current = inputs.streakDays;
        break;
      case "generous":
        current = inputs.resourceCount;
        break;
      case "veteran":
        current = inputs.reputation;
        break;
      case "convo-starter":
        current = inputs.topPostCommentCount;
        break;
      default:
        current = 0;
    }

    const unlocked = current >= badge.target;
    return {
      badge,
      current: Math.min(current, badge.target),
      unlocked,
      earnedAt: unlocked && earnedSet.has(badge.id) ? earnedAtByBadge[badge.id] : undefined,
    };
  });
};

/* ─── Reputation breakdown ──────────────────────────────────────────────── */

export interface ReputationSource {
  label: string;
  value: number;
}

/** Break down where reputation came from (posts, comments, resources). */
export const computeReputationBreakdown = (inputs: BadgeInputs): ReputationSource[] => {
  const postVotes = Math.floor(inputs.postCount * 2.5);
  const commentVotes = inputs.commentUpvotesReceived;
  const resourceBonus = Math.floor(inputs.resourceCount * 10);
  const streakBonus = Math.floor(inputs.streakDays * 0.5);

  return [
    { label: "Post votes", value: postVotes },
    { label: "Comment upvotes", value: commentVotes },
    { label: "Resource shares", value: resourceBonus },
    { label: "Streak activity", value: streakBonus },
  ].filter((s) => s.value > 0);
};
