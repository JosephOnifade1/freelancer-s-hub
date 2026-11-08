import { useState } from "react";
import { Flag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  createReport,
  REPORT_REASONS,
  type ReportEntityType,
  type ReportReason,
} from "@/lib/reports";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: ReportEntityType;
  entityId: string;
  /** e.g. "this post" / "this lead" — used in the copy. */
  entityLabel?: string;
}

/**
 * Report dialog backed by the real `reports` table. Submissions land in
 * the moderators' queue at /admin (previously, Report buttons showed a
 * "reported for review" toast and stored nothing).
 */
export function ReportDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel = "this content",
}: ReportDialogProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      toast.error("Please log in to report content.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createReport({
        reporterUid: user.uid,
        entityType,
        entityId,
        reason,
        details,
      });
      onOpenChange(false);
      setDetails("");
      setReason("spam");
      toast.success("Report submitted. A moderator will review it.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-muted-foreground" /> Report {entityLabel}
          </DialogTitle>
          <DialogDescription>
            Tell the moderation team what's wrong. Reports are reviewed by a
            moderator — they aren't shown to the person you report.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left font-body text-sm transition-colors",
                  reason === r.value
                    ? "border-brand bg-brand/10 font-medium text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                aria-pressed={reason === r.value}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    reason === r.value ? "bg-brand" : "bg-muted-foreground/40"
                  )}
                />
                {r.label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Anything else moderators should know? (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            className="resize-none"
            maxLength={1000}
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
