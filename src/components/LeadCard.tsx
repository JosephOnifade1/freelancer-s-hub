import { Link } from "react-router-dom";
import { DollarSign, MapPin, Users, ArrowRight, BadgeCheck } from "lucide-react";
import { Lead } from "@/lib/leads";
import { formatTimeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/VerifiedBadge";

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
  const typeColors = {
    "Bounty": "bg-amber-500/10 text-amber-500 border-amber-500/20",
    "Project": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    "Retainer": "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "Full-time": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  };

  return (
    <div className="group relative rounded-2xl border border-border bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={`font-heading text-[10px] uppercase tracking-wider px-2 py-0 ${typeColors[lead.type]}`}>
                {lead.type}
              </Badge>
              {lead.isVerified && (
                <span className="inline-flex items-center gap-1 px-2 py-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 font-heading text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                  <BadgeCheck className="h-3 w-3" /> Verified
                </span>
              )}
              <span className="font-body text-[11px] text-muted-foreground">
                Posted {formatTimeAgo(lead.postedAt)}
              </span>
            </div>
            <Link to={`/l/${lead.id}`}>
              <h3 className="font-heading text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1">
                {lead.title}
              </h3>
            </Link>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20">
              <span className="font-heading text-sm font-bold text-primary">{lead.budget}</span>
            </div>
          </div>
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {lead.location}
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {lead.applicantsCount || 0} applicants
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Link to={`/f/${lead.postedBy.uid}`} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
              <div className="h-4 w-4 rounded-full overflow-hidden bg-muted">
                {lead.postedBy.avatar ? (
                  <img src={lead.postedBy.avatar} alt={lead.postedBy.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex items-center justify-center text-[8px] font-bold h-full w-full">
                    {lead.postedBy.name.charAt(0)}
                  </span>
                )}
              </div>
              {lead.postedBy.name}
              <VerifiedBadge isVerified={!!lead.postedBy.isVerified} size={10} showTooltip={false} />
            </Link>
          </div>
        </div>

        {/* Description Snippet */}
        <p className="font-body text-sm text-muted-foreground line-clamp-2">
          {lead.description}
        </p>

        {/* Skills & Action */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex flex-wrap gap-1.5">
            {lead.skills.slice(0, 3).map((skill) => (
              <span key={skill} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-medium text-secondary-foreground">
                {skill}
              </span>
            ))}
            {lead.skills.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">+{lead.skills.length - 3} more</span>
            )}
          </div>
          <Link 
            to={`/l/${lead.id}`} 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:gap-2 transition-all"
          >
            Details <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
