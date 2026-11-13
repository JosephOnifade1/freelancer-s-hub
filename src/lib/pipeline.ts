import { marketplaceRequest } from "./marketplace-client";
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

export const fetchPipeline = (_uid: string) => marketplaceRequest<PipelineItem[]>("pipeline");
export const addPipelineItem = (_uid: string,item: { title:string;clientName:string;budget?:string;leadId?:string|null;source?:string }) =>
  marketplaceRequest<PipelineItem>("pipeline",{},"POST",item);

export function saveOpportunity(uid: string, lead: Lead) {
  return addPipelineItem(uid, {
    leadId: lead.id,
    title: lead.title,
    clientName: lead.postedBy.name,
    budget: `${lead.budget} ${lead.currency}`,
    source: "Borynx opportunity",
  });
}

export async function changePipelineStage(_uid: string,id: string,stage: PipelineStage): Promise<void> {
  await marketplaceRequest("pipeline",{ id },"PATCH",{ stage });
}
export async function removePipelineItem(_uid: string,id: string): Promise<void> {
  await marketplaceRequest("pipeline",{ id },"DELETE");
}
