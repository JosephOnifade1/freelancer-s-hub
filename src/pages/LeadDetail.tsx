import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { fetchLeadById } from "@/lib/leads";
import { 
  ArrowLeft, 
  DollarSign, 
  MapPin, 
  Calendar, 
  Users, 
  ShieldCheck, 
  ExternalLink,
  MessageCircle,
  Share2,
  BadgeCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { formatTimeAgo } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/editor/MarkdownRenderer";

const LeadDetail = () => {
  const { leadId } = useParams<{ leadId: string }>();

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadId ? fetchLeadById(leadId) : null,
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse">
           <div className="h-4 w-24 bg-muted rounded mb-6" />
           <div className="h-10 w-3/4 bg-muted rounded mb-4" />
           <div className="h-32 bg-muted rounded mb-8" />
           <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!lead) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
           <h2 className="font-heading text-2xl font-bold">Opportunity not found</h2>
           <p className="font-body text-muted-foreground mt-2 mb-6">The lead you are looking for may have been closed or removed.</p>
           <Link to="/l">
             <Button variant="outline">Back to Bounty Board</Button>
           </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/l" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8 group">
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" /> Back to Bounty Board
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Main Header Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                  {lead.type}
                </Badge>
                <span className="text-xs text-muted-foreground font-body">
                  Posted {formatTimeAgo(lead.postedAt)}
                </span>
              </div>
              <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground leading-tight">
                {lead.title}
              </h1>
              {lead.isVerified && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/25 w-fit">
                  <BadgeCheck className="h-4 w-4 text-emerald-400" />
                  <span className="font-heading text-sm font-bold text-emerald-400 tracking-wide">Verified Opportunity</span>
                  <span className="font-body text-xs text-emerald-500/70">— vetted by a Borynx moderator</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-body text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {lead.location}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Apply by: Flexible
                </div>
                <div className="flex items-center gap-2 text-emerald-500 font-bold">
                  <DollarSign className="h-4 w-4" />
                  {lead.budget}
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="prose prose-invert max-w-none">
              <h3 className="font-heading text-lg font-bold mb-4">Project Overview</h3>
              <MarkdownRenderer content={lead.description} />
            </div>

            {/* Skills Required */}
            <div className="space-y-4 pt-6 border-t border-border/50">
              <h3 className="font-heading text-lg font-bold">Requirements & Skills</h3>
              <div className="flex flex-wrap gap-2">
                {lead.skills.map((skill) => (
                  <span key={skill} className="px-3 py-1.5 rounded-xl bg-secondary font-body text-xs font-medium text-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Apply & Author */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 shadow-lg shadow-primary/5 sticky top-24">
              <div className="mb-6">
                <p className="text-xs text-muted-foreground font-body mb-1">Opportunity Status</p>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold font-heading text-foreground uppercase tracking-wide">Accepting Proposals</span>
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full h-12 font-heading font-bold text-base rounded-xl glow-primary">
                  Apply Now
                </Button>
                <Button variant="outline" className="w-full h-12 font-heading font-bold text-base rounded-xl gap-2">
                  <MessageCircle className="h-4 w-4" /> Message Client
                </Button>
              </div>

              <div className="mt-6 pt-6 border-t border-border/50 space-y-4">
                <p className="text-xs text-muted-foreground font-body">Posted by</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-muted">
                    {lead.postedBy.avatar ? (
                      <img src={lead.postedBy.avatar} alt={lead.postedBy.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex items-center justify-center font-bold h-full w-full">
                        {lead.postedBy.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <Link to={`/f/${lead.postedBy.uid}`} className="font-heading font-bold text-sm hover:text-primary transition-colors flex items-center gap-1">
                      {lead.postedBy.name}
                      <VerifiedBadge isVerified={!!lead.postedBy.isVerified} size={12} showTooltip={false} />
                    </Link>
                    <p className="text-[10px] text-muted-foreground">Premium Client</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                 <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Share2 className="h-3.5 w-3.5" /> Share
                 </button>
                 <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ShieldCheck className="h-3.5 w-3.5" /> Report
                 </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LeadDetail;
