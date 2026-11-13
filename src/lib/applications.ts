import { marketplaceRequest } from "./marketplace-client";
import type { Lead } from "./leads";

export type ApplicationStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface ApplicationApplicant {
  uid: string;
  username?: string;
  name: string;
  avatarUrl?: string;
  reputation: number;
  isVerifiedPro: boolean;
}

export interface LeadApplication {
  id: string;
  leadId: string;
  applicantUid: string;
  proposal: string;
  status: ApplicationStatus;
  createdAt: number;
  updatedAt: number;
  applicant?: ApplicationApplicant;
  lead?: Lead;
}

// uid arguments remain call-site compatible, but never cross the authorization boundary.
export const fetchMyApplication = async (leadId: string, _uid: string): Promise<LeadApplication|null> =>
  (await marketplaceRequest<LeadApplication[]>("applications",{ view:"mine",id:leadId }))[0] ?? null;
export const applyToLead = (leadId: string, _applicantUid: string, proposal: string) =>
  marketplaceRequest<LeadApplication>("applications",{ id:leadId },"POST",{ proposal });
export const fetchApplicationsForLead = (leadId: string) =>
  marketplaceRequest<LeadApplication[]>("applications",{ view:"lead",id:leadId });
export const fetchMyApplications = (_uid: string) => marketplaceRequest<LeadApplication[]>("applications",{ view:"sent" });
export const fetchReceivedApplications = (_uid: string) => marketplaceRequest<LeadApplication[]>("applications",{ view:"received" });
export const fetchApplicationById = async (id: string): Promise<LeadApplication|null> =>
  (await marketplaceRequest<LeadApplication[]>("applications",{ view:"detail",id }))[0] ?? null;
export const updateApplicationStatus = async (id: string,status: ApplicationStatus): Promise<void> => {
  await marketplaceRequest("applications",{ id },"PATCH",{ status });
};
