import { LucideIcon, Rocket } from "lucide-react";
import { Link } from "react-router-dom";

interface ComingSoonProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  backTo?: string;
  backLabel?: string;
}

export const ComingSoon = ({
  title = "Coming Soon",
  description = "This feature is being built. Check back soon!",
  icon: Icon = Rocket,
  backTo = "/",
  backLabel = "Back to Home",
}: ComingSoonProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      {/* Glow ring */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <Icon className="h-9 w-9 text-primary" strokeWidth={1.5} />
        </div>
      </div>

      {/* Badge */}
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        In Development
      </span>

      <h2 className="font-heading text-2xl font-bold text-foreground mb-2">{title}</h2>
      <p className="font-body text-sm text-muted-foreground max-w-sm leading-relaxed mb-8">
        {description}
      </p>

      <Link
        to={backTo}
        className="inline-flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 px-5 py-2.5 font-body text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
      >
        {backLabel}
      </Link>
    </div>
  );
};
