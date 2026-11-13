import { badgeRequest } from "./badge-client";

/** Badge catalog/earned reads; no public award mutator. */

export type BadgeCategory =
  "publishing" | "helping" | "community" | "trust" | "longevity";
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

/** Public catalog and public earned-badge projection, now read from Neon. */
export const fetchBadges = (): Promise<Badge[]> => badgeRequest();
export const fetchUserBadges = (uid: string): Promise<UserBadge[]> =>
  uid ? badgeRequest(uid) : Promise.resolve([]);

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

/** Compute progress for every badge. Uses authoritative Neon catalog/earned rows; errors remain visible. */
export const computeBadgeProgress = async (
  uid: string | undefined,
  inputs: BadgeInputs,
): Promise<BadgeProgress[]> => {
  const [badges, earned] = await Promise.all([
    fetchBadges(),
    uid ? fetchUserBadges(uid) : [],
  ]);

  const earnedSet = new Set(earned.map((e) => e.badgeId));
  const earnedAtByBadge = Object.fromEntries(
    earned.map((e) => [e.badgeId, e.earnedAt]),
  );

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
      earnedAt:
        unlocked && earnedSet.has(badge.id)
          ? earnedAtByBadge[badge.id]
          : undefined,
    };
  });
};

/* ─── Reputation breakdown ──────────────────────────────────────────────── */

export interface ReputationSource {
  label: string;
  value: number;
}

/** Break down where reputation came from (posts, comments, resources). */
export const computeReputationBreakdown = (
  inputs: BadgeInputs,
): ReputationSource[] => {
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
