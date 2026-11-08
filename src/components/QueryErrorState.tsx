import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";

interface QueryErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Standard error panel for failed React Query loads. Fetchers throw on
 * backend errors (instead of returning empty data), and surfaces render
 * this so an outage is never mistaken for "nothing here yet".
 */
export function QueryErrorState({
  title = "Couldn't load this content",
  message,
  onRetry,
}: QueryErrorStateProps) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title={title}
      description={message || "Something went wrong while loading. Check your connection and try again."}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}
