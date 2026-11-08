import { supabase } from "./supabase";
import {
  Code2,
  Palette,
  Briefcase,
  Megaphone,
  Leaf,
  Globe,
  type LucideIcon,
} from "lucide-react";

export interface CommunityData {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  category: "Development" | "Design" | "Business" | "Marketing" | "Lifestyle" | "Other";
  topics: string[];
  createdAt: string;
  ownerId: string;
  memberCount: number;
  // Cosmetic fields below are NOT stored in the database — they're derived
  // client-side from category/slug via getCommunityStyle(). Keeping them off
  // the DB means nobody has to hand-maintain "online count" or "trending"
  // badges as fake data; the visuals just follow the category.
  onlineCount?: number;
  badge?: "Trending" | "Most Active" | "New" | string;
  isVerified?: boolean;
  bgGradient?: string;
  accentColor?: string;
}

// ─── Visual styling lookup (category → look) ───────────────────────────────
// This is intentionally NOT in the database. It's presentation logic: given
// a category, what icon/accent should the card use. Add a new category style
// here if you add a new category — no DB migration needed.
// Kept to the terminal's functional palette (acid green / cyan / amber) —
// no decorative rainbow, categories differentiate by icon + label, not hue.
const CATEGORY_STYLE: Record<
  string,
  { icon: LucideIcon; bgGradient: string; accentColor: string; iconBg: string }
> = {
  Development: {
    icon: Code2,
    bgGradient: "",
    accentColor: "bg-primary",
    iconBg: "bg-muted text-foreground border-border",
  },
  Design: {
    icon: Palette,
    bgGradient: "",
    accentColor: "bg-primary",
    iconBg: "bg-muted text-foreground border-border",
  },
  Business: {
    icon: Briefcase,
    bgGradient: "",
    accentColor: "bg-primary",
    iconBg: "bg-muted text-foreground border-border",
  },
  Marketing: {
    icon: Megaphone,
    bgGradient: "",
    accentColor: "bg-primary",
    iconBg: "bg-muted text-foreground border-border",
  },
  Lifestyle: {
    icon: Leaf,
    bgGradient: "",
    accentColor: "bg-primary",
    iconBg: "bg-muted text-foreground border-border",
  },
  Other: {
    icon: Globe,
    bgGradient: "",
    accentColor: "bg-primary",
    iconBg: "bg-muted text-foreground border-border",
  },
};

export const getCommunityStyle = (category: string) =>
  CATEGORY_STYLE[category] || CATEGORY_STYLE.Other;

// Maps the create-community-modal's topic checkboxes to a DB category.
const TOPIC_TO_CATEGORY: Record<string, CommunityData["category"]> = {
  development: "Development",
  design: "Design",
  business: "Business",
  marketing: "Marketing",
  logistics: "Other",
  workflow: "Other",
};

interface CommunityRow {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  category?: CommunityData["category"];
  topics?: string[];
  createdAt: string;
  ownerId: string;
  memberCount?: number;
}

interface CommunityMembershipRow {
  communitySlug: string;
}

interface CommunityMemberRow {
  profiles: CommunityMember | null;
}

const dbRowToCommunity = (row: CommunityRow): CommunityData => ({
  id: row.slug,
  name: row.name,
  slug: row.slug,
  description: row.description,
  icon: row.icon,
  category: row.category || "Other",
  topics: row.topics || [],
  createdAt: row.createdAt,
  ownerId: row.ownerId,
  memberCount: row.memberCount || 0,
});

export const fetchAllCommunities = async (): Promise<CommunityData[]> => {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .order("memberCount", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load spaces.");

  return data.map(dbRowToCommunity);
};

export const fetchCommunity = async (slug: string): Promise<CommunityData | null> => {
  const { data, error } = await supabase
    .from("communities")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return dbRowToCommunity(data);
};

export const createCommunity = async (
  slug: string,
  data: { name: string; description: string; topics: string[]; ownerId: string }
) => {
  const category = TOPIC_TO_CATEGORY[data.topics[0]] || "Other";

  const { error } = await supabase.from("communities").insert({
    slug: slug.toLowerCase(),
    name: data.name,
    description: data.description,
    category,
    topics: data.topics,
    ownerId: data.ownerId,
    memberCount: 1,
  });

  if (error) throw new Error(error.message);

  // Creator auto-joins their own community
  await joinCommunity(data.ownerId, slug.toLowerCase());

  return slug.toLowerCase();
};

export const joinCommunity = async (uid: string, slug: string) => {
  const { error } = await supabase
    .from("community_members")
    .insert({ userId: uid, communitySlug: slug });

  if (error) throw new Error(error.message);

  const { error: rpcError } = await supabase.rpc("increment_community_members", { community_slug: slug });
  if (rpcError) throw new Error(rpcError.message);
};

export const leaveCommunity = async (uid: string, slug: string) => {
  const { error } = await supabase
    .from("community_members")
    .delete()
    .eq("userId", uid)
    .eq("communitySlug", slug);

  if (error) throw new Error(error.message);

  await supabase.rpc("decrement_community_members", { community_slug: slug });
};

// Returns the list of community slugs the user has actually joined,
// straight from the community_members join table.
export const getUserCommunities = async (uid: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("community_members")
    .select("communitySlug")
    .eq("userId", uid);

  if (error || !data) return [];
  return (data as CommunityMembershipRow[]).map((row) => row.communitySlug);
};

// ─── Real member list for a B-Space ────────────────────────────────────────
// Straight from community_members joined to profiles. No placeholder people.
export interface CommunityMember {
  uid: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  reputation: number;
  isVerifiedPro?: boolean;
}

export const fetchCommunityMembers = async (slug: string): Promise<CommunityMember[]> => {
  const { data, error } = await supabase
    .from("community_members")
    .select("userId, profiles(uid, username, displayName, avatarUrl, reputation, isVerifiedPro)")
    .eq("communitySlug", slug);

  if (error || !data) return [];

  return (data as unknown as CommunityMemberRow[])
    .map((row) => row.profiles)
    .filter((profile): profile is CommunityMember => Boolean(profile))
    .map((p) => ({
      uid: p.uid,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      reputation: p.reputation || 0,
      isVerifiedPro: !!p.isVerifiedPro,
    }))
    .sort((a: CommunityMember, b: CommunityMember) => b.reputation - a.reputation);
};
