import { ref, get, push, set, serverTimestamp } from "firebase/database";
import { database } from "./firebase";

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
  const leadsRef = ref(database, 'leads');
  const snapshot = await get(leadsRef);
  
  if (!snapshot.exists()) return [];
  
  const leads: Lead[] = [];
  snapshot.forEach((child) => {
    leads.push({ id: child.key as string, ...child.val() });
  });
  
  return leads.sort((a, b) => b.postedAt - a.postedAt);
};

export const fetchLeadById = async (id: string): Promise<Lead | null> => {
  const leadRef = ref(database, `leads/${id}`);
  const snapshot = await get(leadRef);
  return snapshot.exists() ? { id: snapshot.key as string, ...snapshot.val() } : null;
};

export const createLead = async (leadData: Omit<Lead, 'id' | 'postedAt' | 'applicantsCount' | 'status'>) => {
  const leadsRef = ref(database, 'leads');
  const newLeadRef = push(leadsRef);
  
  const finalData = {
    ...leadData,
    postedAt: serverTimestamp(),
    applicantsCount: 0,
    status: "open",
    isVerified: false,
  };
  
  await set(newLeadRef, finalData);
  return newLeadRef.key;
};
