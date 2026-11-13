import { marketplaceRequest } from "./marketplace-client";

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

export interface LeadFilters { status?: LeadStatus; type?: LeadType; search?: string; owner?: string }
export function fetchLeads(filters: LeadFilters = {}): Promise<Lead[]> {
  const params: Record<string,string>={};
  if (filters.status) params.status=filters.status;
  if (filters.type) params.type=filters.type;
  if (filters.search) params.q=filters.search;
  if (filters.owner) params.owner=filters.owner;
  return marketplaceRequest("leads",params);
}
export const fetchLeadById = (id: string) => marketplaceRequest<Lead|null>("lead",{ id });
export function createLead(data: Omit<Lead,"id"|"postedAt"|"applicantsCount"|"status">): Promise<string> {
  return marketplaceRequest("leads",{},"POST",{ title:data.title,description:data.description,budget:data.budget,
    currency:data.currency,location:data.location,type:data.type,skills:data.skills });
}
export const updateLead = (id: string, patch: Partial<Pick<Lead,"title"|"description"|"budget"|"currency"|"location"|"type"|"skills"|"status">>) =>
  marketplaceRequest<boolean>("leads",{ id },"PATCH",patch);
export const archiveLead = (id: string) => marketplaceRequest<boolean>("archive",{ id },"POST",{});
export const archiveLeadAsStaff = (id: string) => marketplaceRequest<boolean>("staff-archive",{ id },"POST",{});

export const fetchLeadsByIds = (ids: string[]) => marketplaceRequest<Lead[]>("leads",{ ids:[...new Set(ids)].join(",") });
