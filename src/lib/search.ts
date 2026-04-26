import { ref, get, query, limitToFirst } from "firebase/database";
import { database } from "./firebase";
import { PostData } from "@/components/PostCard";
import { UserProfile } from "./users";

export interface SearchResults {
  posts: PostData[];
  users: UserProfile[];
}

// Simple Levenshtein distance for fuzzy matching
function getLevenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }
  return dp[m][n];
}

function fuzzyMatch(term: string, target: string, threshold: number = 2): boolean {
  if (target.toLowerCase().includes(term)) return true;
  if (term.length < 3) return false;
  
  const words = target.toLowerCase().split(/\s+/);
  return words.some(word => {
    const distance = getLevenshteinDistance(term, word);
    // Dynamic threshold: allow more errors for longer words
    const dynamicThreshold = term.length > 6 ? 2 : 1;
    return distance <= dynamicThreshold;
  });
}

export async function globalSearch(searchTerm: string): Promise<SearchResults> {
  if (!searchTerm || searchTerm.length < 2) return { posts: [], users: [] };

  const term = searchTerm.toLowerCase();
  
  // Search Posts (Local filtering since RTDB doesn't support complex text search)
  const postsRef = ref(database, 'posts');
  const postsSnap = await get(query(postsRef, limitToFirst(50)));
  const posts: PostData[] = [];
  
  if (postsSnap.exists()) {
    postsSnap.forEach((child) => {
      const val = child.val();
      const isMatch = !val.isDeleted && (
        fuzzyMatch(term, val.title) || 
        fuzzyMatch(term, val.body || "") ||
        val.tags?.some((t: string) => fuzzyMatch(term, t))
      );
      
      if (isMatch) {
        posts.push({ id: child.key as string, ...val });
      }
    });
  }

  // Search Users
  const usersRef = ref(database, 'users');
  const usersSnap = await get(query(usersRef, limitToFirst(50)));
  const users: UserProfile[] = [];

  if (usersSnap.exists()) {
    usersSnap.forEach((child) => {
      const val = child.val();
      const isMatch = (
        fuzzyMatch(term, val.displayName || "") || 
        fuzzyMatch(term, val.username || "") ||
        fuzzyMatch(term, val.bio || "")
      );

      if (isMatch) {
        users.push({ uid: child.key as string, ...val });
      }
    });
  }

  return { 
    posts: posts.slice(0, 5), 
    users: users.slice(0, 5) 
  };
}
