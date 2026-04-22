import { Badge } from "@/components/ui/badge";

type PostType = "discussion" | "question" | "resource" | "weekly";

const typeConfig: Record<PostType, { label: string; className: string }> = {
  discussion: { label: "Discussion", className: "bg-badge-discussion/15 text-badge-discussion border-badge-discussion/30" },
  question: { label: "Question", className: "bg-badge-question/15 text-badge-question border-badge-question/30" },
  resource: { label: "Resource", className: "bg-badge-resource/15 text-badge-resource border-badge-resource/30" },
  weekly: { label: "Weekly", className: "bg-badge-weekly/15 text-badge-weekly border-badge-weekly/30" },
};

interface PostTypeBadgeProps {
  type: PostType;
}

export function PostTypeBadge({ type }: PostTypeBadgeProps) {
  const config = typeConfig[type] || { label: "Post", className: "bg-secondary text-secondary-foreground border-border" };
  return (
    <Badge variant="outline" className={`font-body text-[10px] font-semibold uppercase tracking-wider ${config.className}`}>
      {config.label}
    </Badge>
  );
}
