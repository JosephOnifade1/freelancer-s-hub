import { AppLink as Link } from "@/components/AppLink";
import { loginPath } from "@/lib/return-path";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: () => (user ? getUserProfile(user.uid) : null),
    enabled: !!user,
  });

  const go = (type: ComposerType) => {
    const params = new URLSearchParams({ type });
    if (spaceSlug) params.set("space", spaceSlug);
    router.push(`/submit?${params.toString()}`);
  };

  if (!user) {
    const params = new URLSearchParams({ type: "discussion" });
    if (spaceSlug) params.set("space", spaceSlug);
    return (
      <div className="panel rounded-xl p-3 text-xs text-ink-3 flex items-center justify-between">
        <span className="min-w-0 flex-1">Want to join the conversation?</span>
        <Link
          href={loginPath(`/submit?${params}`)}
          className="btn btn-primary btn-sm"
        >
          Sign in to post
        </Link>
      </div>
    );
  }

  const avatar = user?.photoURL || profile?.avatarUrl;
  const initial = (profile?.displayName || profile?.username || user?.displayName || "?").charAt(0).toUpperCase();

  return (
    <div className="panel rounded-xl p-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sunken border border-line font-heading text-xs font-bold text-ink">
          {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
        </div>
        <button
          type="button"
          onClick={() => go("discussion")}
          className="h-8 flex-1 truncate rounded-md border border-line bg-sunken px-3 text-left font-body text-xs text-ink-3 transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/50"
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
              className="flex items-center gap-1 rounded-md px-2 py-1 text-ink-3 transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/50 text-[11px]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
