import { socialRequest } from "./social-client";
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

export const fetchAllCommunities = () => socialRequest<CommunityData[]>("communities");
export const fetchCommunity = async (slug: string): Promise<CommunityData | null> =>
  (await socialRequest<CommunityData[]>("communities", { slug }))[0] ?? null;
export const createCommunity = async (slug: string, data: { name: string; description: string; topics: string[]; ownerId: string }) => {
  const created = await socialRequest<CommunityData>("communities", {}, "POST", {
    slug, name: data.name, description: data.description, topics: data.topics,
    category: TOPIC_TO_CATEGORY[data.topics[0]] || "Other",
  });
  return created.slug;
};
export const updateCommunity = (slug: string, patch: Partial<Pick<CommunityData, "slug" | "name" | "description" | "topics" | "category" | "icon">>) =>
  socialRequest<CommunityData>("communities", { slug }, "PATCH", patch);
// uid retained for compatibility, never sent as the mutation actor.
export const joinCommunity = (_uid: string, slug: string) => socialRequest("membership", { slug }, "POST", { joined: true });
export const leaveCommunity = (_uid: string, slug: string) => socialRequest("membership", { slug }, "POST", { joined: false });
export const getUserCommunities = (uid: string) => socialRequest<string[]>("memberships", { uid });
export interface CommunityMember {
  uid: string; username?: string; displayName?: string; avatarUrl?: string;
  reputation: number; isVerifiedPro?: boolean;
}
export const fetchCommunityMembers = (slug: string) => socialRequest<CommunityMember[]>("members", { slug });
