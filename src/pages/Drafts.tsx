import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Trash2, PenLine, Clock } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

interface SavedDraft {
  title: string;
  body: string;
  postType: string;
  selectedSpaceSlug: string;
  tags: string[];
  savedAt?: number;
}

const DRAFT_KEY = "borynx_post_draft";

function loadDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const Drafts = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SavedDraft | null>(loadDraft);

  const handleEdit = () => {
    // Navigate to create post — CreatePost already reads from localStorage
    const params = draft?.postType ? `?type=${draft.postType}` : "";
    navigate(`/submit${params}`);
  };

  const handleDelete = () => {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
    toast.success("Draft deleted");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <PageHeader
          title="Drafts"
          subtitle="Your locally saved post drafts."
        />

        {!draft ? (
          <EmptyState
            icon={FileText}
            title="No saved drafts"
            description="When you save a post draft from the Create Post page it will appear here."
          />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            {/* Draft header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {draft.postType || "discussion"}
                    {draft.selectedSpaceSlug && ` · b/${draft.selectedSpaceSlug}`}
                  </span>
                </div>
                <h2 className="font-heading text-base font-bold text-foreground leading-snug truncate">
                  {draft.title || <span className="italic text-muted-foreground">Untitled draft</span>}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Continue editing
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body preview */}
            {draft.body && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 border-l-2 border-border pl-3">
                {draft.body}
              </p>
            )}

            {/* Tags */}
            {draft.tags && draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((t) => (
                  <span
                    key={t}
                    className="px-2.5 py-1 rounded-lg bg-muted text-xs text-muted-foreground font-medium"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <Clock className="h-3 w-3" />
              <span>Saved locally · not yet published</span>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Drafts;
