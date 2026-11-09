import { supabase } from "./supabase";
import type { Lead } from "./leads";

export type PipelineStage = "new" | "conversation" | "proposal" | "negotiation" | "won";

export const PIPELINE_STAGES: { id: PipelineStage; label: string }[] = [
  { id: "new", label: "New" },
  { id: "conversation", label: "In conversation" },
  { id: "proposal", label: "Proposal sent" },
  { id: "negotiation", label: "Negotiating" },
  { id: "won", label: "Won" },
];

export interface PipelineItem {
  id: string;
  userUid: string;
  leadId: string | null;
  clientName: string;
  title: string;
  budget: string;
  stage: PipelineStage;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchPipeline(uid: string): Promise<PipelineItem[]> {
  const { data, error } = await supabase.from("lead_pipeline")
    .select("*").eq("userUid", uid).order("updatedAt", { ascending: false });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not load your pipeline.");
  return data as PipelineItem[];
}

export async function addPipelineItem(uid: string, item: {
  title: string;
  clientName: string;
  budget?: string;
  leadId?: string | null;
  source?: string;
}): Promise<PipelineItem> {
  const title = item.title.trim();
  const clientName = item.clientName.trim();
  if (!uid || !title || !clientName) throw new Error("Add a client and a project title.");
  const { data, error } = await supabase.from("lead_pipeline")
    .insert({
      userUid: uid, leadId: item.leadId || null, title, clientName,
      budget: item.budget?.trim() || "", source: item.source || "Manual",
      stage: "new",
    })
    .select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("This opportunity is already in your pipeline.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("Could not save this pipeline item.");
  return data as PipelineItem;
}

export function saveOpportunity(uid: string, lead: Lead) {
  return addPipelineItem(uid, {
    leadId: lead.id,
    title: lead.title,
    clientName: lead.postedBy.name,
    budget: `${lead.budget} ${lead.currency}`,
    source: "Borynx opportunity",
  });
}

export async function changePipelineStage(uid: string, id: string, stage: PipelineStage): Promise<void> {
  const { data, error } = await supabase.from("lead_pipeline")
    .update({ stage, updatedAt: new Date().toISOString() })
    .eq("id", id).eq("userUid", uid).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That item is no longer in your pipeline.");
}

export async function removePipelineItem(uid: string, id: string): Promise<void> {
  const { data, error } = await supabase.from("lead_pipeline")
    .delete().eq("id", id).eq("userUid", uid).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("That item is no longer in your pipeline.");
}
