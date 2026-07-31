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

type LeadProfileRow = {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  isVerifiedPro?: boolean | null;
};

type LeadRow = {
  id: string;
  title: string;
  description: string;
  budget: string;
  currency: string;
  location: string;
  type: LeadType;
  status: LeadStatus;
  skills?: string[] | null;
  isVerified?: boolean | null;
  postedAt: string;
  applicantsCount?: number | null;
  postedByUid: string;
  profiles?: LeadProfileRow | null;
};

const mapLeadRow = (lead: LeadRow): Lead => ({
  id: lead.id,
  title: lead.title,
  description: lead.description,
  budget: lead.budget,
  currency: lead.currency,
  location: lead.location,
  type: lead.type,
  status: lead.status,
  skills: lead.skills || [],
  isVerified: lead.isVerified ?? false,
  postedAt: new Date(lead.postedAt).getTime(),
  applicantsCount: lead.applicantsCount || 0,
  postedBy: {
    uid: lead.postedByUid,
    username: lead.profiles?.username || undefined,
    name: lead.profiles?.displayName || lead.profiles?.username || "Unknown",
    avatar: lead.profiles?.avatarUrl || undefined,
    isVerified: lead.profiles?.isVerifiedPro || false,
  },
});

const LEAD_SELECT = `
  id, title, description, budget, currency, location, type, status,
  skills, isVerified, postedAt, applicantsCount, postedByUid,
  profiles!leads_postedByUid_fkey (username, displayName, avatarUrl, isVerifiedPro)
`;

export const fetchLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .order("postedAt", { ascending: false });

  if (error || !data) {
    console.warn("Could not fetch leads from Supabase backend:", error?.message || error);
    return [];
  }

  return (data as LeadRow[]).map(mapLeadRow);
};

export const fetchLeadById = async (id: string): Promise<Lead | null> => {
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return mapLeadRow(data as LeadRow);
};

export const createLead = async (
  leadData: Omit<Lead, "id" | "postedAt" | "applicantsCount" | "status">
) => {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      title: leadData.title,
      description: leadData.description,
      budget: leadData.budget,
      currency: leadData.currency,
      location: leadData.location,
      type: leadData.type,
      skills: leadData.skills || [],
      isVerified: false,
      status: "open",
      applicantsCount: 0,
      postedByUid: leadData.postedBy.uid,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data?.id as string;
};
