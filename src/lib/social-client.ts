export async function socialRequest<T>(op: string, params: Record<string, string> = {}, method = "GET", body?: unknown): Promise<T> {
  const search = new URLSearchParams({ op, ...params });
  const response = await fetch(`/api/social?${search}`, {
    method, cache: "no-store", headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Could not load social data.");
  return result.data as T;
}
export const fetchSocialFacts = () => socialRequest<{ memberSlugs: string[]; ownedSlugs: string[] }>("facts");
export interface SocialProfile { uid: string; username?: string; displayName?: string; avatarUrl?: string; reputation: number; isVerifiedPro?: boolean }
export const fetchFollowers = (uid: string) => socialRequest<SocialProfile[]>("followers", { uid });
export const fetchFollowing = (uid: string) => socialRequest<SocialProfile[]>("following", { uid });
export const setFollowing = (target: string, following: boolean | "toggle") => socialRequest<{ following: boolean }>("follow", {}, "POST", { target, following });
