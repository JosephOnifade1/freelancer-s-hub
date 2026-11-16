import { AppLink as Link } from "@/components/AppLink";
import { DollarSign, MapPin, Users, ArrowRight, BadgeCheck } from "lucide-react";
import { Lead } from "@/lib/leads";
import { formatTimeAgo } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { VerifiedBadge } from "@/components/VerifiedBadge";

interface LeadCardProps {
  lead: Lead;
}

export function LeadCard({ lead }: LeadCardProps) {
  const typeTagClass = {
    "Bounty": "tag tag-gold",
    "Project": "tag tag-ember",
    "Retainer": "tag tag-verdigris",
    "Full-time": "tag tag-success",
  };

  return (
    <div className="group relative panel rounded-xl p-4 sm:p-5 transition-all duration-200 hover:border-line-strong">
      <div className="flex flex-col gap-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[10px] ${typeTagClass[lead.type] || "tag"}`}>
                {lead.type}
              </span>
              {lead.isVerified && (
                <span className="tag tag-verdigris text-[10px]">
                  Verified
                </span>
              )}
              <span className="eyebrow text-[10px]">
                Posted {formatTimeAgo(lead.postedAt)}
              </span>
            </div>
            <Link href={`/l/${lead.id}`}>
              <h3 className="font-heading text-base sm:text-lg font-bold text-ink leading-tight group-hover:text-ember transition-colors line-clamp-1">
                {lead.title}
              </h3>
            </Link>
          </div>
          <div className="text-right shrink-0">
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sunken border border-line">
              <span className="num text-xs font-bold text-ink">{lead.budget}</span>
            </div>
          </div>
        </div>

        {/* Details Row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-3">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-ink-4" />
            <span>{lead.location}</span>
          </div>
          <div className="flex items-center gap-1 num">
            <Users className="h-3 w-3 text-ink-4" />
            <span>{lead.applicantsCount || 0} applicants</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Link href={`/f/${lead.postedBy.username || lead.postedBy.uid}`} className="flex items-center gap-1.5 hover:text-ink transition-colors">
              <div className="h-4 w-4 rounded-md overflow-hidden bg-sunken border border-line">
                {lead.postedBy.avatar ? (
                  <img src={lead.postedBy.avatar} alt={lead.postedBy.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex items-center justify-center text-[8px] font-bold h-full w-full text-ink">
                    {lead.postedBy.name.charAt(0)}
                  </span>
                )}
              </div>
              <span>{lead.postedBy.name}</span>
              <VerifiedBadge isVerified={!!lead.postedBy.isVerified} size={10} showTooltip={false} />
            </Link>
          </div>
        </div>

        {/* Description Snippet */}
        <p className="text-xs text-ink-2 line-clamp-2 leading-relaxed">
          {lead.description}
        </p>

        {/* Skills & Action */}
        <div className="flex items-center justify-between pt-2 border-t border-line">
          <div className="flex flex-wrap gap-1">
            {lead.skills.slice(0, 3).map((skill) => (
              <span key={skill} className="tag text-[9.5px]">
                {skill}
              </span>
            ))}
            {lead.skills.length > 3 && (
              <span className="eyebrow text-[9px] self-center ml-0.5">+{lead.skills.length - 3} more</span>
            )}
          </div>
          <Link 
            href={`/l/${lead.id}`} 
            className="inline-flex items-center gap-1 text-xs font-semibold text-ember hover:underline"
          >
            Details <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
