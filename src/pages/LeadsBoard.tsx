import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { LeadCard } from "@/components/LeadCard";
import { useQuery } from "@tanstack/react-query";
import { fetchLeads, LeadType } from "@/lib/leads";
import { Search, Filter, Briefcase, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const categories: { label: string; value: LeadType | "All" }[] = [
  { label: "All Leads", value: "All" },
  { label: "Bounties", value: "Bounty" },
  { label: "Projects", value: "Project" },
  { label: "Retainers", value: "Retainer" },
  { label: "Full-time", value: "Full-time" },
];

const LeadsBoard = () => {
  const [activeCategory, setActiveCategory] = useState<LeadType | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: fetchLeads,
  });

  const filteredLeads = leads.filter(lead => {
    const matchesCategory = activeCategory === "All" || lead.type === activeCategory;
    const matchesSearch = lead.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          lead.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <PageHeader 
            title="Borynx Leads" 
            subtitle="Professional bounties and high-signal opportunities for top-tier talent."
          />
          <div className="flex items-center gap-3">
             <Button variant="outline" className="font-heading text-xs font-bold gap-2 rounded-xl">
               <Filter className="h-3.5 w-3.5" /> Filter
             </Button>
             <Link to="/l/post">
               <Button className="font-heading text-xs font-bold gap-2 rounded-xl glow-primary">
                 <Plus className="h-3.5 w-3.5" /> Post Opportunity
               </Button>
             </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search skills, titles..." 
                className="pl-9 rounded-xl bg-card border-border/50 focus-visible:ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card p-2">
              <p className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Category</p>
              <div className="space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setActiveCategory(cat.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeCategory === cat.value 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}
                  >
                    {cat.label}
                    {activeCategory === cat.value && <Sparkles className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-primary/20 bg-primary/5 p-5 text-center">
               <Briefcase className="h-8 w-8 text-primary/40 mx-auto mb-3" />
               <h4 className="font-heading text-sm font-bold text-foreground mb-1">Scale Your Team</h4>
               <p className="font-body text-xs text-muted-foreground leading-relaxed">
                 Post a high-signal bounty to attract Borynx verified talent.
               </p>
            </div>
          </div>

          {/* Main Feed */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-2xl border border-border bg-card animate-pulse" />
                ))}
              </div>
            ) : filteredLeads.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-border/50">
                 <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                   <Search className="h-8 w-8 text-muted-foreground/30" />
                 </div>
                 <h3 className="font-heading text-lg font-bold text-foreground">No matches found</h3>
                 <p className="font-body text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                   We couldn't find any leads matching your current filters. Try adjusting your search criteria.
                 </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LeadsBoard;
