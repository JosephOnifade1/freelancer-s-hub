import { MessageSquare, CircleHelp, Sparkles, BarChart2, BookOpen } from "lucide-react";

/** Agent 2 Ledger post-kind taxonomy.
 * discussion → neutral tag
 * resource   → verdigris (trust/knowledge)
 * question   → ember (help / urgent)
 * weekly     → gold  (community highlight)
 * poll       → neutral tag
 */
type PostType = "discussion" | "question" | "resource" | "weekly" | "poll";

const typeConfig: Record<PostType, { label: string; tagClass: string; icon?: React.ReactNode }> = {
  discussion: {
    label: "Discussion",
    tagClass: "tag",
    icon: <MessageSquare className="h-3 w-3" />,
  },
  question: {
    label: "Help",
    tagClass: "tag tag-ember",
    icon: <CircleHelp className="h-3 w-3" />,
  },
  resource: {
    label: "Resource",
    tagClass: "tag tag-verdigris",
    icon: <BookOpen className="h-3 w-3" />,
  },
  weekly: {
    label: "Weekly",
    tagClass: "tag tag-gold",
    icon: <Sparkles className="h-3 w-3" />,
  },
  poll: {
    label: "Poll",
    tagClass: "tag",
    icon: <BarChart2 className="h-3 w-3" />,
  },
};

interface PostTypeBadgeProps {
  type: PostType;
}

export function PostTypeBadge({ type }: PostTypeBadgeProps) {
  const config = typeConfig[type] ?? { label: "Post", tagClass: "tag", icon: undefined };
  return (
    <span className={`${config.tagClass} inline-flex items-center gap-1 text-[10px]`}>
      {config.icon}
      {config.label}
    </span>
  );
}
