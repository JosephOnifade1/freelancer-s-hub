import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PenTool, HelpCircle, FileText, BarChart2 } from "lucide-react";
import { useAuth } from "@/hooks/auth-context";
import { getUserProfile } from "@/lib/users";

type ComposerType = "discussion" | "question" | "resource" | "poll";

interface ComposerBarProps {
  /** Pre-selects this B-Space on /submit. Omit on the main feed. */
  spaceSlug?: string;
  placeholder?: string;
}

const ACTIONS: { type: ComposerType; label: string; icon: typeof PenTool }[] = [
  { type: "discussion", label: "Post", icon: PenTool },
  { type: "question", label: "Question", icon: HelpCircle },
  { type: "resource", label: "Resource", icon: FileText },
  { type: "poll", label: "Poll", icon: BarChart2 },
];

// The one entry point for starting a post from a feed. Every feed-style page
// (home, B-Space) renders this instead of carrying its own copy.
export function ComposerBar({ spaceSlug, placeholder = "Start a post" }: ComposerBarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user ? getUserProfile(user.uid) : null),
    enabled: !!user,
  });

  const go = (type: ComposerType) => {
    const params = new URLSearchParams({ type });
    if (spaceSlug) params.set("space", spaceSlug);
    navigate(`/submit?${params.toString()}`);
  };

  if (!user) {
    const params = new URLSearchParams({ type: "discussion" });
    if (spaceSlug) params.set("space", spaceSlug);
    return (
      <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
        <span className="min-w-0 flex-1">Want to join the conversation?</span>
        <Link
          to="/login"
          state={{ from: { pathname: "/submit", search: `?${params}` } }}
          className="inline-flex min-h-9 items-center rounded-lg bg-brand px-3 font-semibold text-brand-foreground"
        >
          Sign in to post
        </Link>
      </div>
    );
  }

  const avatar = user?.photoURL || profile?.avatarUrl;
  const initial = (profile?.displayName || profile?.username || user?.displayName || "?").charAt(0).toUpperCase();

  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-sm font-bold text-foreground">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
        </div>
        <button
          type="button"
          onClick={() => go("discussion")}
          className="h-8 flex-1 truncate rounded-lg border border-border bg-background px-2 text-left font-body text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {placeholder}
        </button>

        {/* Post type pills */}
        <div className="flex items-center gap-1 shrink-0">
          {ACTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              aria-label={label}
              onClick={() => go(type)}
              className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="sr-only">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
