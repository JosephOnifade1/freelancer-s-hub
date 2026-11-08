import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Plus, Filter, MoreHorizontal, ChevronDown, Check, SlidersHorizontal, Info, Calendar as CalendarIcon, List as ListIcon, LayoutGrid, Wand2, Trash2, CheckCircle2, Send, MessageSquare, ArrowUpRight, ExternalLink, Sparkles } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { 
  BoardLead, 
  BoardStage, 
  getBoardLeads, 
  saveBoardLead, 
  updateBoardLeadStage, 
  deleteBoardLead,
  fetchLeads,
  syncSupabaseLeadsToBoard
} from "@/lib/leads";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type ViewMode = "Board" | "List" | "Calendar";

const STAGES: { id: BoardStage; label: string; dotColor: string; badgeColor: string }[] = [
  { id: "new", label: "New Leads", dotColor: "bg-info", badgeColor: "text-info" },
  { id: "conversation", label: "In Conversation", dotColor: "bg-brand", badgeColor: "text-brand" },
  { id: "proposal", label: "Proposal Sent", dotColor: "bg-warning", badgeColor: "text-warning" },
  { id: "negotiation", label: "Negotiation", dotColor: "bg-foreground", badgeColor: "text-foreground" },
  { id: "won", label: "Closed Won", dotColor: "bg-success", badgeColor: "text-success" },
];

const CATEGORIES = [
  "All",
  "Web Design",
  "UI/UX",
  "Development",
  "Design",
  "Productivity",
  "No-Code",
  "Mobile Design"
];

export default function LeadsBoard() {
  const [leads, setLeads] = useState<BoardLead[]>(() => getBoardLeads());
  const { data: remoteLeads } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
  });

  useEffect(() => {
    if (remoteLeads && remoteLeads.length > 0) {
      const merged = syncSupabaseLeadsToBoard(remoteLeads);
      setLeads([...merged]);
    }
  }, [remoteLeads]);
  const [viewMode, setViewMode] = useState<ViewMode>("Board");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Last Updated");
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [remindersModalOpen, setRemindersModalOpen] = useState(false);
  
  // Add Lead Modal State
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [targetStageForNewLead, setTargetStageForNewLead] = useState<BoardStage>("new");
  
  // New Lead Form Fields
  const [companyName, setCompanyName] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [budgetVal, setBudgetVal] = useState("$2,500 - $3,500");
  const [categoryVal, setCategoryVal] = useState("Web Design");
  const [sourceVal, setSourceVal] = useState("Borynx Spaces");

  // Filter leads by category
  const filteredLeads = leads.filter(l => categoryFilter === "All" || l.category === categoryFilter);

  // Group leads by stage
  const getLeadsByStage = (stage: BoardStage) => {
    return filteredLeads.filter(l => l.stage === stage);
  };

  // Helper stats
  const totalLeadsCount = leads.length;
  const wonCount = leads.filter(l => l.stage === "won").length;
  const conversionRate = totalLeadsCount > 0 ? Math.round((wonCount / totalLeadsCount) * 100) : 0;

  // Source breakdown counts
  const sourceCounts = {
    "Borynx Spaces": leads.filter(l => l.source === "Borynx Spaces").length,
    "Direct / Profile": leads.filter(l => l.source === "Direct / Profile").length,
    "Referrals": leads.filter(l => l.source === "Referrals").length,
    "Search": leads.filter(l => l.source === "Search").length,
    "Other": leads.filter(l => !["Borynx Spaces", "Direct / Profile", "Referrals", "Search"].includes(l.source || "")).length,
  };

  const handleOpenAddLead = (stage: BoardStage = "new") => {
    setTargetStageForNewLead(stage);
    setCompanyName("");
    setProjectTitle("");
    setBudgetVal("$2,500 - $3,500");
    setCategoryVal("Web Design");
    setSourceVal("Borynx Spaces");
    setAddLeadOpen(true);
  };

  const handleCreateLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !projectTitle.trim()) {
      toast.error("Please fill in client name and project summary");
      return;
    }

    const created = saveBoardLead({
      company: companyName.trim(),
      title: projectTitle.trim(),
      budget: budgetVal.trim(),
      stage: targetStageForNewLead,
      category: categoryVal,
      source: sourceVal,
    });

    setLeads(getBoardLeads());
    setAddLeadOpen(false);
    toast.success(`Lead added to ${STAGES.find(s => s.id === targetStageForNewLead)?.label}`);
  };

  const handleStageChange = (leadId: string, newStage: BoardStage) => {
    const updated = updateBoardLeadStage(leadId, newStage);
    setLeads(updated);
    toast.success(`Moved lead to ${STAGES.find(s => s.id === newStage)?.label}`);
  };

  const handleDeleteLead = (leadId: string) => {
    const updated = deleteBoardLead(leadId);
    setLeads(updated);
    toast.success("Lead removed from board");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1600px] px-3 sm:px-6 py-6 space-y-6">
        
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">Leads Board</h1>
              <button 
                onClick={() => setInfoModalOpen(true)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title="About Leads Board"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Track and manage your leads from discovery to closed.
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => handleOpenAddLead("new")}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground font-medium text-xs flex items-center gap-1.5 transition-all shadow-md "
            >
              <Plus className="h-4 w-4" /> Add Lead
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-xl border border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuItem onClick={() => handleOpenAddLead("new")}>
                  <Plus className="h-3.5 w-3.5 mr-2" /> Add New Lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.success("Leads exported to CSV")}>
                  <ExternalLink className="h-3.5 w-3.5 mr-2" /> Export to CSV
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    localStorage.removeItem("borynx_board_leads_v2");
                    setLeads(getBoardLeads());
                    toast.success("Board reset to initial demo data");
                  }}
                >
                  Reset Demo Data
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* View Switcher Tabs & Filter Controls */}
        <div className="space-y-4">
          
          {/* Tabs row: Board, List, Calendar */}
          <div className="border-b border-border/50 flex items-center gap-8 text-sm font-medium">
            <button
              onClick={() => setViewMode("Board")}
              className={`pb-3 flex items-center gap-2 transition-all relative ${
                viewMode === "Board"
                  ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </button>
            <button
              onClick={() => setViewMode("List")}
              className={`pb-3 flex items-center gap-2 transition-all relative ${
                viewMode === "List"
                  ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListIcon className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setViewMode("Calendar")}
              className={`pb-3 flex items-center gap-2 transition-all relative ${
                viewMode === "Calendar"
                  ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="h-4 w-4" /> Calendar
            </button>
          </div>

          {/* Filter & Sort Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            
            {/* Left Category Filter Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="px-3.5 py-1.5 rounded-lg border border-border/60 bg-card text-xs text-foreground font-medium flex items-center gap-2 hover:border-border transition-colors shadow-sm">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{categoryFilter === "All" ? "All Leads" : categoryFilter}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44 text-xs">
                {CATEGORIES.map((cat) => (
                  <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>
                    {categoryFilter === cat && <Check className="h-3.5 w-3.5 mr-2 text-brand" />}
                    <span className={categoryFilter === cat ? "font-bold text-foreground" : ""}>{cat === "All" ? "All Leads" : cat}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Right Controls: Sort & Layout Button */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-3.5 py-1.5 rounded-lg border border-border/60 bg-card text-xs text-foreground font-medium flex items-center gap-2 hover:border-border transition-colors shadow-sm">
                    <span className="text-muted-foreground">Sort:</span>
                    <span>{sortBy}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  {["Last Updated", "Value: High to Low", "Value: Low to High", "Newest First"].map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setSortBy(s)}>
                      {sortBy === s && <Check className="h-3.5 w-3.5 mr-2 text-brand" />}
                      <span>{s}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button 
                className="p-2 rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground hover:border-border transition-colors shadow-sm"
                onClick={() => toast.info("Board display density set to comfortable")}
                title="Display Options"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </button>
            </div>

          </div>

        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Board View (8 or 9 cols) */}
          <div className="lg:col-span-8 xl:col-span-9 min-w-0">
            
            {viewMode === "Board" && (
              <div className="flex items-start gap-3.5 overflow-x-auto pb-4">
                {STAGES.map((stage) => {
                  const stageLeads = getLeadsByStage(stage.id);

                  return (
                    <div 
                      key={stage.id} 
                      className="rounded-xl border border-border bg-muted/50 p-3 space-y-3 w-[260px] shrink-0"
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between px-1 pt-1">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${stage.dotColor}`} />
                          <h3 className="font-heading text-xs font-bold text-foreground whitespace-nowrap">{stage.label}</h3>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{stageLeads.length}</span>
                        </div>
                        <button 
                          onClick={() => handleOpenAddLead(stage.id)}
                          className="p-1 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                          title={`Add lead to ${stage.label}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Lead Cards in Stage */}
                      <div className="space-y-2.5">
                        {stageLeads.map((lead) => (
                          <div 
                            key={lead.id}
                            className="rounded-xl border border-border/40 bg-card p-3.5 space-y-2.5 hover:border-border transition-all shadow-sm group"
                          >
                            {/* Card Header: Avatar, Name, Options */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                {lead.avatarUrl ? (
                                  <img 
                                    src={lead.avatarUrl} 
                                    alt={lead.company} 
                                    className="h-6 w-6 rounded-full object-cover shrink-0" 
                                  />
                                ) : (
                                  <div className={`h-6 w-6 rounded-full ${lead.avatarColor || "bg-brand"} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}>
                                    {lead.initials || lead.company.charAt(0)}
                                  </div>
                                )}
                                <span className="font-heading text-xs font-bold text-foreground truncate">
                                  {lead.company}
                                </span>
                                {lead.isVerified && <VerifiedBadge isVerified={true} size={12} />}
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="text-muted-foreground/60 hover:text-foreground p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 text-xs">
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Move Stage</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-40 text-xs">
                                      {STAGES.map((s) => (
                                        <DropdownMenuItem 
                                          key={s.id} 
                                          onClick={() => handleStageChange(lead.id, s.id)}
                                          disabled={lead.stage === s.id}
                                        >
                                          <span className={`h-1.5 w-1.5 rounded-full ${s.dotColor} mr-2`} />
                                          {s.label}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>

                                  <DropdownMenuItem asChild>
                                    <Link to={`/l/${lead.id}`} className="flex items-center cursor-pointer">
                                      <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Details
                                    </Link>
                                  </DropdownMenuItem>

                                  <DropdownMenuItem onClick={() => handleDeleteLead(lead.id)} className="text-destructive cursor-pointer">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Summary / Description */}
                            <Link to={`/l/${lead.id}`} className="block group/link">
                              <p className="text-xs text-muted-foreground/90 leading-snug line-clamp-2 group-hover/link:text-foreground transition-colors">
                                {lead.title}
                              </p>
                            </Link>

                            {/* Value and Time row */}
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="tabular-nums font-bold text-foreground/90">{lead.budget}</span>
                              <span className="text-muted-foreground/70 tabular-nums ">{lead.timeAgo}</span>
                            </div>

                            {/* Tags & Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="px-2 py-0.5 rounded bg-secondary/50 text-[10px] tabular-nums text-muted-foreground">
                                {lead.category}
                              </span>

                              {/* Special Status Badges matching screenshot */}
                              {lead.statusBadge === "Paid" && (
                                <span className="px-1.5 py-0.5 rounded bg-success/10 text-success text-[10px] tabular-nums font-bold flex items-center gap-1 border border-success/20 ml-auto">
                                  <Check className="h-2.5 w-2.5" /> Paid
                                </span>
                              )}

                              {lead.statusBadge && lead.statusBadge.startsWith("Sent") && (
                                <span className="text-[10px] text-warning tabular-nums flex items-center gap-1 ml-auto">
                                  <Check className="h-2.5 w-2.5" /> {lead.statusBadge}
                                </span>
                              )}

                              {lead.statusBadge && lead.statusBadge.startsWith("Last reply") && (
                                <span className="text-[10px] text-brand tabular-nums flex items-center gap-1 ml-auto">
                                  <Check className="h-2.5 w-2.5" /> {lead.statusBadge}
                                </span>
                              )}
                            </div>

                          </div>
                        ))}

                        {/* Add Lead button at bottom of column */}
                        <button
                          onClick={() => handleOpenAddLead(stage.id)}
                          className="w-full py-2 rounded-xl border border-dashed border-border/40 hover:border-border/80 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add Lead
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

            {/* List View */}
            {viewMode === "List" && (
              <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 border-b border-border/40 text-muted-foreground tabular-nums ">
                      <tr>
                        <th className="p-3.5 font-semibold">Client / Company</th>
                        <th className="p-3.5 font-semibold">Project Summary</th>
                        <th className="p-3.5 font-semibold">Stage</th>
                        <th className="p-3.5 font-semibold">Value</th>
                        <th className="p-3.5 font-semibold">Category</th>
                        <th className="p-3.5 font-semibold">Status / Time</th>
                        <th className="p-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredLeads.map((lead) => {
                        const stageInfo = STAGES.find(s => s.id === lead.stage);
                        return (
                          <tr key={lead.id} className="hover:bg-muted/40 transition-colors">
                            <td className="p-3.5">
                              <div className="flex items-center gap-2 font-bold text-foreground">
                                {lead.avatarUrl ? (
                                  <img src={lead.avatarUrl} alt={lead.company} className="h-6 w-6 rounded-full object-cover" />
                                ) : (
                                  <div className={`h-6 w-6 rounded-full ${lead.avatarColor || "bg-brand"} text-white font-bold text-[10px] flex items-center justify-center`}>
                                    {lead.initials || lead.company.charAt(0)}
                                  </div>
                                )}
                                <span>{lead.company}</span>
                              </div>
                            </td>
                            <td className="p-3.5 text-muted-foreground max-w-xs truncate">
                              <Link to={`/l/${lead.id}`} className="hover:text-foreground transition-colors font-medium">
                                {lead.title}
                              </Link>
                            </td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${stageInfo?.badgeColor} bg-muted`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${stageInfo?.dotColor}`} />
                                {stageInfo?.label}
                              </span>
                            </td>
                            <td className="p-3.5 tabular-nums font-bold text-foreground">{lead.budget}</td>
                            <td className="p-3.5 tabular-nums text-muted-foreground">{lead.category}</td>
                            <td className="p-3.5 tabular-nums text-muted-foreground">{lead.statusBadge || lead.timeAgo}</td>
                            <td className="p-3.5 text-right">
                              <button 
                                onClick={() => handleDeleteLead(lead.id)}
                                className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Calendar View */}
            {viewMode === "Calendar" && (
              <div className="rounded-2xl border border-border/40 bg-card p-6 text-center space-y-4 shadow-sm">
                <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto opacity-80" />
                <h3 className="font-heading text-base font-bold text-foreground">Leads Calendar & Follow-up Milestones</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                  Upcoming follow-up dates, proposal expiry windows, and deal closing deadlines will be scheduled on your connected calendar.
                </p>
                <div className="grid grid-cols-7 gap-2 max-w-xl mx-auto pt-4 text-xs tabular-nums ">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="p-2 border border-border/30 rounded bg-muted/40 text-muted-foreground font-bold">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: 28 }).map((_, idx) => (
                    <div key={idx} className="h-12 border border-border/30 rounded p-1 text-[10px] text-muted-foreground/60 flex flex-col justify-between">
                      <span>{idx + 1}</span>
                      {idx === 14 && <span className="bg-muted text-foreground rounded px-1 truncate">Acme Proposal</span>}
                      {idx === 20 && <span className="bg-success/20 text-success rounded px-1 truncate">BrightKey Call</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Right Analytics Sidebar (3 or 4 cols) */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-5">
            
            {/* Card 1: Leads Overview */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-foreground">Leads Overview</h3>
              </div>

              <div>
                <div className="font-heading text-3xl font-bold text-foreground">{totalLeadsCount}</div>
                <div className="text-xs text-muted-foreground tabular-nums mt-0.5">total leads</div>
              </div>

              {/* Status Dot Breakdown */}
              <div className="space-y-2.5 pt-2 text-xs">
                {STAGES.map((s) => {
                  const count = leads.filter(l => l.stage === s.id).length;
                  return (
                    <div key={s.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${s.dotColor}`} />
                        <span className="text-foreground/90">{s.label}</span>
                      </div>
                      <span className="tabular-nums font-bold text-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Conversion Rate */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-heading text-sm font-bold text-foreground">Conversion Rate</h3>
              
              <div>
                <div className="font-heading text-3xl font-bold text-foreground">{conversionRate}%</div>
                <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  {wonCount} won / {totalLeadsCount} total
                </div>
              </div>
            </div>

            {/* Card 3: Top Sources */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3.5">
              <h3 className="font-heading text-sm font-bold text-foreground">Top Sources</h3>

              <div className="space-y-3 text-xs">
                {[
                  { label: "Borynx Spaces", count: sourceCounts["Borynx Spaces"], max: 8 },
                  { label: "Direct / Profile", count: sourceCounts["Direct / Profile"], max: 8 },
                  { label: "Referrals", count: sourceCounts["Referrals"], max: 8 },
                  { label: "Search", count: sourceCounts["Search"], max: 8 },
                  { label: "Other", count: sourceCounts["Other"], max: 8 },
                ].map((src) => {
                  const widthPct = Math.min(100, Math.max(12, (src.count / 8) * 100));
                  return (
                    <div key={src.label} className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-foreground/90">{src.label}</span>
                        <span className="tabular-nums text-muted-foreground">{src.count}</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand rounded-full transition-all duration-500" 
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 4: Recent Activity */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3.5">
              <h3 className="font-heading text-sm font-bold text-foreground">Recent Activity</h3>

              <div className="space-y-3 text-xs">
                {[
                  { icon: Plus, title: "Acme Corporation", action: "added as new lead", time: "2h ago", color: "text-info bg-info/10" },
                  { icon: Send, title: "You", action: "sent a proposal to TechStart Inc.", time: "1d ago", color: "text-warning bg-warning/10" },
                  { icon: MessageSquare, title: "BrightKey", action: "replied to your message", time: "1d ago", color: "text-foreground bg-muted" },
                  { icon: CheckCircle2, title: "You", action: "won FlowCraft project", time: "4d ago", color: "text-success bg-success/10" },
                  { icon: ArrowUpRight, title: "Inova Agency", action: "moved to Negotiation", time: "2d ago", color: "text-foreground bg-muted" },
                ].map((act, idx) => {
                  const IconComp = act.icon;
                  return (
                    <div key={idx} className="flex items-start gap-2.5">
                      <div className={`p-1.5 rounded-full shrink-0 ${act.color} mt-0.5`}>
                        <IconComp className="h-3 w-3" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground/90 leading-tight">
                          <span className="font-bold text-foreground">{act.title}</span> {act.action}
                        </p>
                        <span className="text-[10px] text-muted-foreground tabular-nums ">{act.time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 5: Automate your follow-ups */}
            <div className="rounded-2xl border border-brand/20 bg-brand/10 p-5 space-y-3 shadow-sm">
              <div className="h-8 w-8 rounded-lg bg-brand/20 border border-brand/30 flex items-center justify-center text-muted-foreground">
                <Wand2 className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-heading text-sm font-bold text-foreground">Automate your follow-ups</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Set up reminders and never miss a follow-up.
                </p>
              </div>
              <button 
                onClick={() => setRemindersModalOpen(true)}
                className="text-xs text-brand hover:text-brand font-medium tabular-nums hover:underline flex items-center gap-1"
              >
                Enable Reminders →
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Add Lead Dialog Modal */}
      <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
        <DialogContent className="sm:max-w-md border-border/60 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold">Add New Lead</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new client opportunity to track on your board.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateLeadSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Client / Company Name</Label>
              <Input 
                placeholder="e.g. Acme Corporation" 
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-background border-border/60 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Project Summary</Label>
              <Input 
                placeholder="e.g. Landing page design for SaaS product" 
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="bg-background border-border/60 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Budget Value</Label>
                <Input 
                  placeholder="$2,500 - $3,500" 
                  value={budgetVal}
                  onChange={(e) => setBudgetVal(e.target.value)}
                  className="bg-background border-border/60 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Initial Stage</Label>
                <select 
                  value={targetStageForNewLead} 
                  onChange={(e) => setTargetStageForNewLead(e.target.value as BoardStage)}
                  className="w-full h-9 rounded-md bg-background border border-border/60 text-xs px-2 text-foreground focus:outline-none"
                >
                  {STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <select 
                  value={categoryVal} 
                  onChange={(e) => setCategoryVal(e.target.value)}
                  className="w-full h-9 rounded-md bg-background border border-border/60 text-xs px-2 text-foreground focus:outline-none"
                >
                  {CATEGORIES.filter(c => c !== "All").map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Lead Source</Label>
                <select 
                  value={sourceVal} 
                  onChange={(e) => setSourceVal(e.target.value)}
                  className="w-full h-9 rounded-md bg-background border border-border/60 text-xs px-2 text-foreground focus:outline-none"
                >
                  {["Borynx Spaces", "Direct / Profile", "Referrals", "Search", "Other"].map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <button
                type="button"
                onClick={() => setAddLeadOpen(false)}
                className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs bg-primary hover:bg-primary text-primary-foreground font-medium"
              >
                Add Lead
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Info Modal */}
      <Dialog open={infoModalOpen} onOpenChange={setInfoModalOpen}>
        <DialogContent className="sm:max-w-md border-border/60 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold">About Leads Board</DialogTitle>
            <DialogDescription asChild>
              <div className="text-xs text-muted-foreground leading-relaxed pt-2 space-y-2">
                <p>The Leads Board is your complete freelancing CRM pipeline designed for modern developers and agency owners.</p>
                <p>Easily track incoming leads, send proposals, handle negotiations, and record closed deals seamlessly with real-time conversion insights.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button 
              onClick={() => setInfoModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs bg-primary text-primary-foreground font-medium"
            >
              Got it
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminders Modal */}
      <Dialog open={remindersModalOpen} onOpenChange={setRemindersModalOpen}>
        <DialogContent className="sm:max-w-md border-border/60 bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-muted-foreground" /> Follow-up Reminders Enabled
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-2">
              Borynx will automatically check your proposal status and trigger browser notifications when leads have not replied within 48 hours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button 
              onClick={() => {
                setRemindersModalOpen(false);
                toast.success("Follow-up notifications activated!");
              }}
              className="px-4 py-2 rounded-lg text-xs bg-primary hover:bg-primary text-primary-foreground font-medium"
            >
              Done
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
