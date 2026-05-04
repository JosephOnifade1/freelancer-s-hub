import { PostData } from "@/components/PostCard";

export type SortType = "best" | "hot" | "new";

/**
 * Calculates the Hot Score for a post based on Reddit's Hot algorithm.
 * Uses a logarithmic scale for net votes and time decay.
 */
export function getHotScore(ups: number, downs: number, createdAt: number | Date): number {
  const s = ups - downs;
  const order = Math.log10(Math.max(Math.abs(s), 1));
  let sign = 0;
  if (s > 0) sign = 1;
  else if (s < 0) sign = -1;

  // Time in seconds since a very old date (e.g., Dec 8, 2005 - Reddit's launch)
  const epoch = 1134028003;
  const dateUnix = typeof createdAt === 'number' 
    ? createdAt / 1000 
    : createdAt.getTime() / 1000;
  
  const seconds = dateUnix - epoch;

  // 45000 seconds = 12.5 hours decay
  return Math.round((order + sign * seconds / 45000) * 10000000) / 10000000;
}

/**
 * Calculates the Best Score using the Wilson Score Interval lower bound.
 * Predicts post quality based on upvote-to-downvote ratios.
 */
export function getBestScore(ups: number, downs: number): number {
  const n = ups + downs;
  if (n === 0) return 0;

  const z = 1.96; // 95% confidence interval
  const phat = ups / n;

  return (
    (phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n)) /
    (1 + (z * z) / n)
  );
}

/**
 * Sorts an array of posts based on the specified SortType.
 * Modifies the array in place or returns a sorted copy (best to pass a copy).
 */
export function sortPosts(posts: PostData[], sortType: SortType, userTopics?: string[]): PostData[] {
  return posts.sort((a, b) => {
    if (sortType === "new") {
      const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
      return timeB - timeA;
    }

    // Fallback logic for legacy posts without explicit ups/downs
    const aUps = a.ups !== undefined ? a.ups : Math.max(a.score || 0, 0);
    const aDowns = a.downs !== undefined ? a.downs : Math.max(-(a.score || 0), 0);
    
    const bUps = b.ups !== undefined ? b.ups : Math.max(b.score || 0, 0);
    const bDowns = b.downs !== undefined ? b.downs : Math.max(-(b.score || 0), 0);

    // Calculate boost multipliers based on user favorite topics
    let aBoost = 1;
    let bBoost = 1;

    if (userTopics && userTopics.length > 0) {
      if (a.tags && a.tags.some(t => userTopics.includes(t.toLowerCase()))) aBoost = 1.15;
      if (b.tags && b.tags.some(t => userTopics.includes(t.toLowerCase()))) bBoost = 1.15;
    }

    if (sortType === "best") {
      const bestA = getBestScore(aUps, aDowns) * aBoost;
      const bestB = getBestScore(bUps, bDowns) * bBoost;
      
      // Fallback to time if scores are perfectly identical
      if (bestB === bestA) {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
        return timeB - timeA;
      }
      return bestB - bestA;
    }

    if (sortType === "hot") {
      const timeA = typeof a.createdAt === 'number' ? a.createdAt : Date.now();
      const timeB = typeof b.createdAt === 'number' ? b.createdAt : Date.now();
      
      const hotA = getHotScore(aUps, aDowns, timeA) * aBoost;
      const hotB = getHotScore(bUps, bDowns, timeB) * bBoost;
      return hotB - hotA;
    }

    return 0;
  });
}
