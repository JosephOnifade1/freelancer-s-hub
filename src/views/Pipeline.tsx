import { useMemo, useState } from "react";
import { AppLink as Link } from "@/components/AppLink";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/auth-context";
import { addPipelineItem, changePipelineStage, fetchPipeline, PIPELINE_STAGES, removePipelineItem, type PipelineStage } from "@/lib/pipeline";

type Sort = "updated" | "client";

/** Private, server-persisted CRM. No sample clients, fake activity or browser-wide data. */
export default function Pipeline() {
  const { user } = useAuth();
  const uid = user?.uid;
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [clientName, setClientName] = useState("");
  const [title, setTitle] = useState("");
  const [budget, setBudget] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | PipelineStage>("all");
  const [sort, setSort] = useState<Sort>("updated");
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["pipeline", uid], queryFn: () => fetchPipeline(uid as string), enabled: !!uid,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pipeline", uid] });
  const addMutation = useMutation({
    mutationFn: () => addPipelineItem(uid as string, { clientName, title, budget }),
    onSuccess: () => {
      setAdding(false); setClientName(""); setTitle(""); setBudget("");
      invalidate(); toast.success("Added to your private pipeline");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: PipelineStage }) => changePipelineStage(uid as string, id, stage),
    onSuccess: () => { invalidate(); toast.success("Stage updated"); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => removePipelineItem(uid as string, id),
    onSuccess: () => { invalidate(); toast.success("Removed from your pipeline"); },
    onError: (error: Error) => toast.error(error.message),
  });

  const visible = useMemo(() => items
    .filter((item) => stageFilter === "all" || item.stage === stageFilter)
    .sort((a, b) => sort === "client"
      ? a.clientName.localeCompare(b.clientName)
      : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [items, stageFilter, sort]);
  const won = items.filter((item) => item.stage === "won").length;

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        <PageHeader title="My pipeline" subtitle="Your private, account-synced project tracker. Only you can see these items."
          action={<Button onClick={() => setAdding(true)} className="min-h-11 gap-2"><Plus className="h-4 w-4" /> Add prospect</Button>} />
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <span className="mr-auto text-muted-foreground"><strong className="text-foreground">{items.length}</strong> tracked · <strong className="text-foreground">{won}</strong> marked won</span>
          <label className="flex items-center gap-2 text-muted-foreground">Stage
            <select aria-label="Filter pipeline stage" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as typeof stageFilter)} className="min-h-10 rounded-radius-md border border-border bg-background px-3 font-body text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">All stages</option>
              {PIPELINE_STAGES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-muted-foreground">Sort
            <select aria-label="Sort pipeline" value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="min-h-10 rounded-radius-md border border-border bg-background px-3 font-body text-foreground focus-visible:ring-2 focus-visible:ring-ring">
              <option value="updated">Recently updated</option><option value="client">Client A–Z</option>
            </select>
          </label>
        </div>

        {isError ? <QueryErrorState title="Couldn't load your pipeline" onRetry={() => refetch()} />
          : isLoading ? <p role="status" className="py-12 text-center text-sm text-muted-foreground">Loading your pipeline…</p>
          : visible.length === 0 ? <EmptyState icon={Briefcase} title={items.length ? "No items at this stage" : "Your pipeline is empty"}
              description={items.length ? "Select another stage to see your projects." : "Add a prospect manually, or save a real opportunity to track it here."}
              action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => setAdding(true)}>Add prospect</Button><Button variant="outline" asChild><Link href="/l">Browse opportunities</Link></Button></div>} />
          : <div className="grid gap-3 md:grid-cols-2">
              {visible.map((item) => (
                <article key={item.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{item.clientName} · {item.source}</p>
                      <h2 className="mt-1 text-base font-semibold leading-snug text-foreground">{item.title}</h2>
                      {item.budget && <p className="mt-1 text-sm text-muted-foreground">Budget: {item.budget}</p>}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><button type="button" aria-label={`Remove ${item.title} from pipeline`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-4 w-4" /></button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Remove from your pipeline?</AlertDialogTitle><AlertDialogDescription>This removes your tracking entry; it does not delete the public opportunity.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => removeMutation.mutate(item.id)}>Remove</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">Stage
                      <select aria-label={`Stage for ${item.title}`} value={item.stage} disabled={stageMutation.isPending} onChange={(event) => stageMutation.mutate({ id: item.id, stage: event.target.value as PipelineStage })} className="min-h-10 rounded-radius-md border border-border bg-background px-2 font-body text-foreground disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring">
                        {PIPELINE_STAGES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                      </select>
                    </label>
                    {item.leadId && <Link href={`/l/${item.leadId}`} className="text-sm font-semibold text-brand hover:underline">View opportunity →</Link>}
                  </div>
                </article>
              ))}
            </div>}

        <Dialog open={adding} onOpenChange={setAdding}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add a prospect</DialogTitle><DialogDescription>Track a project privately. Adding it here does not publish an opportunity.</DialogDescription></DialogHeader>
            <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); addMutation.mutate(); }}>
              <div className="space-y-1.5"><Label htmlFor="pipeline-client">Client or company</Label><Input id="pipeline-client" value={clientName} onChange={(event) => setClientName(event.target.value)} required maxLength={120} /></div>
              <div className="space-y-1.5"><Label htmlFor="pipeline-title">Project</Label><Input id="pipeline-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={180} /></div>
              <div className="space-y-1.5"><Label htmlFor="pipeline-budget">Estimated budget (optional)</Label><Input id="pipeline-budget" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="e.g. $2,000–$3,000" maxLength={80} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit" disabled={addMutation.isPending}>{addMutation.isPending ? "Saving…" : "Add to pipeline"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
