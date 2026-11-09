import { supabase } from "./supabase";

export type LeadType = "Bounty" | "Project" | "Retainer" | "Full-time";
export type LeadStatus = "open" | "in-progress" | "closed";

export interface Lead {
  id: string;
  title: string;
  description: string;
  budget: string;
  currency: string;
  location: string;
  type: LeadType;
  status: LeadStatus;
  skills: string[];
  isVerified?: boolean;
  postedBy: {
    uid: string;
    username?: string;
    name: string;
    avatar?: string;
    isVerified?: boolean;
  };
  postedAt: number;
  applicantsCount: number;
}

interface LeadRow {
  id: string;
  title: string;
  description: string;
  budget: string;
  currency: string;
  location: string;
  type: LeadType;
  status: LeadStatus;
  skills?: string[];
  isVerified?: boolean;
  postedAt: string;
  applicantsCount: number;
  postedByUid: string;
  profiles?: {
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    isVerifiedPro?: boolean;
  } | null;
}

const LEAD_COLUMNS = `
  id, title, description, budget, currency, location, type, status,
  skills, isVerified, postedAt, applicantsCount, postedByUid,
  profiles!leads_postedByUid_fkey (username, displayName, avatarUrl, isVerifiedPro)
`;

const mapLead = (row: LeadRow): Lead => ({
  id: row.id,
  title: row.title,
  description: row.description,
  budget: row.budget,
  currency: row.currency || "USD",
  location: row.location,
  type: row.type,
  status: row.status,
  skills: row.skills || [],
  isVerified: row.isVerified,
  postedAt: new Date(row.postedAt).getTime(),
  applicantsCount: row.applicantsCount || 0,
  postedBy: {
    uid: row.postedByUid,
    username: row.profiles?.username,
    name: row.profiles?.displayName || row.profiles?.username || "Unknown",
    avatar: row.profiles?.avatarUrl,
    isVerified: !!row.profiles?.isVerifiedPro,
  },
});

/** Real, database-backed opportunities only. Never fall back to browser demo leads. */
export async function fetchLeads(): Promise<Lead[]> {
  const { data, error } = await supabase.from("leads")
    .select(LEAD_COLUMNS).order("postedAt", { ascending: false });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load opportunities.");
  return (data as LeadRow[]).map(mapLead);
}

export async function fetchLeadById(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from("leads")
    .select(LEAD_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapLead(data as LeadRow) : null;
}

export async function createLead(
  leadData: Omit<Lead, "id" | "postedAt" | "applicantsCount" | "status">
): Promise<string> {
  const { data, error } = await supabase.from("leads")
    .insert({
      title: leadData.title.trim(),
      description: leadData.description.trim(),
      budget: leadData.budget.trim(),
      currency: leadData.currency,
      location: leadData.location.trim(),
      type: leadData.type,
      skills: leadData.skills || [],
      isVerified: false,
      status: "open",
      applicantsCount: 0,
      postedByUid: leadData.postedBy.uid,
    })
    .select("id").single();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("The opportunity was not saved. Please try again.");
  return data.id as string;
}
