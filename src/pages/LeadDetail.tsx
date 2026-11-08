import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeadById } from "@/lib/leads";
import { ReportDialog } from "@/components/ReportDialog";
import {
  applyToLead,
  fetchMyApplication,
  updateApplicationStatus,
} from "@/lib/applications";
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
  BadgeCheck,
  CheckCircle2,
  Send
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { formatTimeAgo } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/editor/MarkdownRenderer";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const LeadDetail = () => {
  const { leadId } = useParams<{ leadId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => leadId ? fetchLeadById(leadId) : null,
    enabled: !!leadId,
  });

  // Real application state from lead_applications (replaces local-only flag).
  const { data: myApplication } = useQuery({
    queryKey: ['myApplication', leadId, user?.uid],
    queryFn: () => (leadId && user?.uid ? fetchMyApplication(leadId, user.uid) : null),
    enabled: !!leadId && !!user?.uid,
  });

  const hasApplied = !!myApplication && myApplication.status !== "withdrawn";
  const isOwnLead = !!user?.uid && !!lead && lead.postedBy.uid === user.uid;
  const isOpen = lead?.status === "open";

  const refreshApplication = () => {
    queryClient.invalidateQueries({ queryKey: ['myApplication', leadId, user?.uid] });
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
    queryClient.invalidateQueries({ queryKey: ['myApplications'] });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Opportunity link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleMessageClient = () => {
    // No DM system exists yet; messaging unlock state follows the REAL
    // application status instead of a promise disconnected from any data.
    if (myApplication?.status === "accepted") {
      toast.info("Your proposal was accepted. Open the client's profile to continue the conversation.");
    } else {
      toast.info("Messaging unlocks once the client accepts your proposal. You can view the client's profile meanwhile.");
    }
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !leadId) {
      toast.error("Please log in to apply.");
      return;
    }
    if (!proposalText.trim()) {
      toast.error("Please enter a short cover note or proposal.");
      return;
    }

    setIsSubmittingProposal(true);
    try {
      await applyToLead(leadId, user.uid, proposalText);
      setIsApplyOpen(false);
      setProposalText("");
      refreshApplication();
      toast.success("Application submitted. The client can review it in their Applications inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit application.");
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleWithdraw = async () => {
    if (!myApplication) return;
    try {
      await updateApplicationStatus(myApplication.id, "withdrawn");
      refreshApplication();
      toast.success("Application withdrawn.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw application.");
    }
  };

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
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
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
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-success/10 border border-success/25 w-fit">
                  <BadgeCheck className="h-4 w-4 text-success" />
                  <span className="font-heading text-sm font-bold text-success ">Verified Opportunity</span>
                  <span className="font-body text-xs text-success/70">— vetted by a Borynx moderator</span>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 font-body text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {lead.location}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  Apply by: Flexible
                </div>
                <div className="flex items-center gap-2 text-success font-bold">
                  <DollarSign className="h-4 w-4" />
                  {lead.budget}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {lead.applicantsCount} applicant{lead.applicantsCount === 1 ? "" : "s"}
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
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 shadow-lg shadow-brand/5 sticky top-24">
              <div className="mb-6">
                <p className="text-xs text-muted-foreground font-body mb-1">Opportunity Status</p>
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${isOpen ? "bg-success" : "bg-muted-foreground"}`} />
                  <span className="text-sm font-bold font-heading text-foreground ">
                    {isOpen ? "Accepting Proposals" : "Closed"}
                  </span>
                </div>
                {hasApplied && myApplication && (
                  <p className="mt-2 text-xs text-muted-foreground font-body">
                    Your application is <span className="font-semibold text-foreground capitalize">{myApplication.status}</span>.
                  </p>
                )}
                {isOwnLead && (
                  <p className="mt-2 text-xs text-muted-foreground font-body">
                    This is your lead. Review applicants in your{" "}
                    <Link to="/applications" className="font-semibold text-brand hover:underline">Applications inbox</Link>.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => setIsApplyOpen(true)}
                  disabled={hasApplied || isOwnLead || !isOpen}
                  className={`w-full h-12 font-heading font-bold text-base rounded-xl transition-all ${
                    hasApplied ? "bg-success/20 text-success border border-success/30 hover:bg-success/30" : ""
                  }`}
                >
                  {hasApplied ? (
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" /> Applied
                    </span>
                  ) : isOwnLead ? (
                    "Your Lead"
                  ) : !isOpen ? (
                    "Applications Closed"
                  ) : (
                    "Apply Now"
                  )}
                </Button>
                {myApplication?.status === "pending" && (
                  <Button
                    onClick={handleWithdraw}
                    variant="ghost"
                    className="w-full font-heading text-sm text-muted-foreground hover:text-destructive"
                  >
                    Withdraw application
                  </Button>
                )}
                <Button 
                  onClick={handleMessageClient}
                  variant="outline" 
                  className="w-full h-12 font-heading font-bold text-base rounded-xl gap-2"
                >
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
                    <Link to={`/f/${lead.postedBy.username || lead.postedBy.uid}`} className="font-heading font-bold text-sm hover:text-brand transition-colors flex items-center gap-1">
                      {lead.postedBy.name}
                      <VerifiedBadge isVerified={!!lead.postedBy.isVerified} size={12} showTooltip={false} />
                    </Link>
                    <p className="text-[10px] text-muted-foreground">Client</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                 <button 
                   onClick={handleShare}
                   className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                 >
                    <Share2 className="h-3.5 w-3.5" /> Share
                 </button>
                 <button
                   onClick={() => setIsReportOpen(true)}
                   className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                 >
                    <ShieldCheck className="h-3.5 w-3.5" /> Report
                 </button>
              </div>
            </div>
          </div>
        </div>

        <ReportDialog
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          entityType="lead"
          entityId={lead.id}
          entityLabel="this lead"
        />

        {/* Apply Dialog */}
        <Dialog open={isApplyOpen} onOpenChange={setIsApplyOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Apply for Opportunity</DialogTitle>
              <DialogDescription>
                Send a quick pitch and proposal to <span className="font-semibold text-foreground">{lead.postedBy.name}</span>.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleApplySubmit} className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Your Proposal / Cover Note</label>
                <Textarea
                  placeholder="Explain why you're a great fit for this project, relevant portfolio links, or questions for the client..."
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  rows={4}
                  className="resize-none"
                  required
                />
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Budget: </span>{lead.budget} {lead.currency || "USD"} &bull; {lead.type}
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" onClick={() => setIsApplyOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingProposal} className="gap-2">
                  <Send className="h-4 w-4" />
                  {isSubmittingProposal ? "Submitting..." : "Submit Proposal"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default LeadDetail;
