import { Badge } from "@/components/ui/badge";
import { BookOpen, MessageSquare, CircleHelp, Sparkles, BarChart2 } from "lucide-react";

type PostType = "discussion" | "question" | "resource" | "weekly" | "poll";

const typeConfig: Record<PostType, { label: string; className: string; icon?: React.ReactNode }> = {
  discussion: {
    label: "Discussion",
    className: "bg-primary/10 text-primary border-primary/30",
    icon: <MessageSquare className="h-3.5 w-3.5" />
  },
  question: {
    label: "Question",
    className: "bg-info/10 text-info border-info/30",
    icon: <CircleHelp className="h-3.5 w-3.5" />
  },
  resource: {
    label: "Resource",
    className: "bg-primary/10 text-primary border-primary/30",
    icon: <Sparkles className="h-3.5 w-3.5" />
  },
  weekly: {
    label: "Weekly",
    className: "bg-warning/10 text-warning border-warning/30"
  },
  poll: {
    label: "Poll",
    className: "bg-info/10 text-info border-info/30",
    icon: <BarChart2 className="h-3.5 w-3.5" />
  },
};

interface PostTypeBadgeProps {
  type: PostType;
}

export function PostTypeBadge({ type }: PostTypeBadgeProps) {
  const config = typeConfig[type] || { label: "Post", className: "bg-secondary text-secondary-foreground border-border" };
  return (
    <Badge variant="outline" className={`font-body text-[10px] font-bold uppercase tracking-wider ${config.className} flex items-center gap-1.5 py-0.5 px-2`}>
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  );
}
