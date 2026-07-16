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
    name: string;
    avatar?: string;
    isVerified?: boolean;
  };
  postedAt: number;
  applicantsCount: number;
}

export const fetchLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, title, description, budget, currency, location, type, status,
      skills, isVerified, postedAt, applicantsCount, postedByUid,
      profiles!leads_postedByUid_fkey (username, displayName, avatarUrl, isVerifiedPro)
    `)
    .order("postedAt", { ascending: false });

  if (error) {
    console.error("Error fetching leads:", error);
    return [];
  }

  return (data || []).map((l: any) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    budget: l.budget,
    currency: l.currency,
    location: l.location,
    type: l.type,
    status: l.status,
    skills: l.skills || [],
    isVerified: l.isVerified,
    postedAt: new Date(l.postedAt).getTime(),
    applicantsCount: l.applicantsCount,
    postedBy: {
      uid: l.postedByUid,
      name: l.profiles?.displayName || l.profiles?.username || "Unknown",
      avatar: l.profiles?.avatarUrl,
      isVerified: l.profiles?.isVerifiedPro || false,
    },
  }));
};

export const fetchLeadById = async (id: string): Promise<Lead | null> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, title, description, budget, currency, location, type, status,
      skills, isVerified, postedAt, applicantsCount, postedByUid,
      profiles!leads_postedByUid_fkey (username, displayName, avatarUrl, isVerifiedPro)
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    budget: data.budget,
    currency: data.currency,
    location: data.location,
    type: data.type,
    status: data.status,
    skills: data.skills || [],
    isVerified: data.isVerified,
    postedAt: new Date(data.postedAt).getTime(),
    applicantsCount: data.applicantsCount,
    postedBy: {
      uid: data.postedByUid,
      name: (data as any).profiles?.displayName || (data as any).profiles?.username || "Unknown",
      avatar: (data as any).profiles?.avatarUrl,
      isVerified: (data as any).profiles?.isVerifiedPro || false,
    },
  };
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
