import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Trash2, PenLine, Clock } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/hooks/auth-context";
import { readDraft, deleteDraft } from "@/lib/drafts";
import { toast } from "sonner";

export default function Drafts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => readDraft(user?.uid || ""));

  const handleDelete = () => {
    if (!user?.uid || !window.confirm("Delete this draft? This cannot be undone.")) return;
    deleteDraft(user.uid);
    setDraft(null);
    toast.success("Draft deleted");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <PageHeader title="Drafts" subtitle="Text and settings are saved on this device, for this account only. Files must be reselected after a reload." />
        {!draft ? (
          <EmptyState icon={FileText} title="No saved drafts" description="Start a post to save a draft here. Text and settings autosave as you write."
            action={<Link to="/submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Create a post</Link>} />
        ) : (
          <article className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-muted-foreground"><FileText className="h-4 w-4" /> {draft.postType} {draft.selectedTargetId && `· ${draft.selectedTargetId}`}</p>
                <h2 className="truncate text-base font-bold text-foreground">{draft.title || <span className="italic text-muted-foreground">Untitled draft</span>}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => navigate("/submit?restore=1")} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><PenLine className="h-4 w-4" /> Continue editing</button>
                <button onClick={handleDelete} aria-label="Delete draft" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {draft.body && <p className="line-clamp-4 border-l-2 border-border pl-3 text-sm text-muted-foreground">{draft.body}</p>}
            {draft.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{draft.tags.map((tag) => <span key={tag} className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">#{tag}</span>)}</div>}
            <div className="flex items-center gap-1.5 border-t border-border pt-3 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> Last saved {new Date(draft.savedAt).toLocaleString()} · not published</div>
          </article>
        )}
      </div>
    </AppLayout>
  );
}
