import { supabase } from "./supabase";
import { fetchPublicProfile, isProfileError } from "./profile-client";
import { fetchLeads, fetchLeadById, type Lead } from "./leads";

/**
 * Lead applications — the real pipeline behind "Apply Now".
 *
 * Backed by the `lead_applications` table (see
 * supabase_lead_applications_migration.sql): applicants insert their own
 * row, lead owners read/review applications to their leads, and a DB
 * trigger keeps `leads.applicantsCount` in sync. RLS + a guard trigger
 * enforce who may change what; every error here is thrown so the UI can
 * say what actually happened (this replaces the old setTimeout + toast
 * simulation, which discarded the proposal entirely).
 */

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

interface ApplicationRow {
  id: string;
  leadId: string;
  applicantUid: string;
  proposal: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

const rowToApplication = (row: ApplicationRow): LeadApplication => ({
  id: row.id,
  leadId: row.leadId,
  applicantUid: row.applicantUid,
  proposal: row.proposal,
  status: row.status,
  createdAt: new Date(row.createdAt).getTime(),
  updatedAt: new Date(row.updatedAt || row.createdAt).getTime(),
});

const fetchApplicant = async (uid: string): Promise<ApplicationApplicant | undefined> => {
  // Phase 2C: Neon read. A missing profile is `undefined`, not an error — an applicant
  // whose profile has not provisioned yet should not break the application list.
  const result = await fetchPublicProfile(uid);
  if (isProfileError(result)) {
    if (result.error === "not_found") return undefined;
    throw new Error("Could not load the applicant.");
  }
  const data = result.data;
  return {
    uid: data.uid,
    username: data.username,
    name: data.displayName || data.username || "Unknown",
    avatarUrl: data.avatarUrl,
    reputation: data.reputation || 0,
    isVerifiedPro: !!data.isVerifiedPro,
  };
};

const enrichApplicants = async (apps: LeadApplication[]): Promise<LeadApplication[]> => {
  const uids = [...new Set(apps.map((a) => a.applicantUid))];
  const profiles = await Promise.all(uids.map((uid) => fetchApplicant(uid)));
  const byUid = new Map(profiles.filter(Boolean).map((p) => [p!.uid, p]));
  return apps.map((a) => ({ ...a, applicant: byUid.get(a.applicantUid) }));
};

/** The current user's application to one lead, if any (any status). */
export const fetchMyApplication = async (
  leadId: string,
  uid: string
): Promise<LeadApplication | null> => {
  const { data, error } = await supabase
    .from("lead_applications")
    .select("*")
    .eq("leadId", leadId)
    .eq("applicantUid", uid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToApplication(data as ApplicationRow) : null;
};

/**
 * Apply to a lead. Re-applying after withdrawing reactivates the existing
 * row (the table has a unique (leadId, applicantUid) constraint).
 */
export const applyToLead = async (
  leadId: string,
  applicantUid: string,
  proposal: string
): Promise<LeadApplication> => {
  const trimmed = proposal.trim();
  if (!trimmed) throw new Error("Please enter a short cover note or proposal.");

  const existing = await fetchMyApplication(leadId, applicantUid);

  if (existing) {
    if (existing.status !== "withdrawn") {
      throw new Error("You've already applied to this lead.");
    }
    const { data, error } = await supabase
      .from("lead_applications")
      .update({ proposal: trimmed, status: "pending" })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToApplication(data as ApplicationRow);
  }

  const { data, error } = await supabase
    .from("lead_applications")
    .insert({ leadId, applicantUid, proposal: trimmed, status: "pending" })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("You've already applied to this lead.");
    throw new Error(error.message);
  }
  return rowToApplication(data as ApplicationRow);
};

/** All applications to one lead (lead-owner view), newest first. */
export const fetchApplicationsForLead = async (leadId: string): Promise<LeadApplication[]> => {
  const { data, error } = await supabase
    .from("lead_applications")
    .select("*")
    .eq("leadId", leadId)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);
  return enrichApplicants((data as ApplicationRow[]).map(rowToApplication));
};

/** Applications the user has sent, with their leads attached. */
export const fetchMyApplications = async (uid: string): Promise<LeadApplication[]> => {
  const { data, error } = await supabase
    .from("lead_applications")
    .select("*")
    .eq("applicantUid", uid)
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);

  const apps = (data as ApplicationRow[]).map(rowToApplication);
  return Promise.all(
    apps.map(async (app) => ({ ...app, lead: (await fetchLeadById(app.leadId)) ?? undefined }))
  );
};

/** Applications received on leads the user posted (client inbox). */
export const fetchReceivedApplications = async (uid: string): Promise<LeadApplication[]> => {
  const myLeads = (await fetchLeads()).filter((lead) => lead.postedBy.uid === uid);
  if (myLeads.length === 0) return [];
  const leadById = new Map(myLeads.map((lead) => [lead.id, lead]));

  // RLS already limits a bare select to "my applications + applications to
  // my leads"; filtering by owned lead ids keeps the intent explicit and
  // works identically against the mock DB (which has no .in() builder).
  const { data, error } = await supabase
    .from("lead_applications")
    .select("*")
    .order("createdAt", { ascending: false });

  if (error) throw new Error(error.message);

  const received = (data as ApplicationRow[])
    .map(rowToApplication)
    .filter((app) => leadById.has(app.leadId))
    .map((app) => ({ ...app, lead: leadById.get(app.leadId) }));

  return enrichApplicants(received);
};

/** Owner review (accept/reject) or applicant withdraw/re-apply status change. */
export const updateApplicationStatus = async (
  applicationId: string,
  status: ApplicationStatus
): Promise<void> => {
  const { data, error } = await supabase
    .from("lead_applications")
    .update({ status })
    .eq("id", applicationId)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Application not found or not editable.");
};
