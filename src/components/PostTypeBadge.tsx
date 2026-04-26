import { Badge } from "@/components/ui/badge";
import { BookOpen, MessageSquare, CircleHelp, Sparkles } from "lucide-react";

type PostType = "discussion" | "question" | "resource" | "weekly";

const typeConfig: Record<PostType, { label: string; className: string; icon?: React.ReactNode }> = {
  discussion: { 
    label: "Discussion", 
    className: "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20", 
    icon: <MessageSquare className="h-3.5 w-3.5" /> 
  },
  question: { 
    label: "Question", 
    className: "bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20", 
    icon: <CircleHelp className="h-3.5 w-3.5" /> 
  },
  resource: { 
    label: "Resource", 
    className: "bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] border-[var(--brand-primary)]/20", 
    icon: <Sparkles className="h-3.5 w-3.5" /> 
  },
  weekly: { 
    label: "Weekly", 
    className: "bg-purple-500/10 text-purple-500 border-purple-500/20" 
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
