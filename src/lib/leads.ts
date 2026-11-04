import { supabase } from "./supabase";

export type LeadType = "Bounty" | "Project" | "Retainer" | "Full-time";
export type LeadStatus = "open" | "in-progress" | "closed";
export type BoardStage = "new" | "conversation" | "proposal" | "negotiation" | "won";

export interface BoardLead {
  id: string;
  company: string;
  title: string;
  description?: string;
  budget: string;
  stage: BoardStage;
  category: string;
  initials?: string;
  avatarColor?: string;
  avatarUrl?: string;
  isVerified?: boolean;
  timeAgo: string;
  statusBadge?: string;
  source?: string;
  createdAt: number;
}

export interface Lead {
  id: string;
  title: string;
  description: string;
  budget: string;
  currency: string;
  location: string;
  type: LeadType;
  status: LeadStatus;
  skills: string[];
  isVerified?: boolean;
  postedBy: {
    uid: string;
    username?: string;
    name: string;
    avatar?: string;
    isVerified?: boolean;
  };
  postedAt: number;
  applicantsCount: number;
}

const DEFAULT_BOARD_LEADS: BoardLead[] = [
  // New Leads (6)
  {
    id: "lead-1",
    company: "Acme Corporation",
    title: "Landing page design for SaaS product",
    budget: "$2,500 - $3,000",
    stage: "new",
    category: "Web Design",
    initials: "AC",
    avatarColor: "bg-blue-600",
    timeAgo: "2h ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 2 * 3600000,
  },
  {
    id: "lead-2",
    company: "James Lee",
    title: "Need help with React component build",
    budget: "$800 - $1,200",
    stage: "new",
    category: "Development",
    initials: "JL",
    avatarColor: "bg-amber-500",
    timeAgo: "5h ago",
    source: "Direct / Profile",
    createdAt: Date.now() - 5 * 3600000,
  },
  {
    id: "lead-3",
    company: "InnovateHub",
    title: "Branding and website redesign",
    budget: "$3,000 - $5,800",
    stage: "new",
    category: "Design",
    initials: "IH",
    avatarColor: "bg-emerald-500",
    isVerified: true,
    timeAgo: "1d ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 24 * 3600000,
  },
  {
    id: "lead-4",
    company: "Sarah O.",
    title: "Looking for a Notion template expert",
    budget: "$150 - $300",
    stage: "new",
    category: "Productivity",
    initials: "SO",
    avatarColor: "bg-pink-500",
    isVerified: true,
    timeAgo: "1d ago",
    source: "Search",
    createdAt: Date.now() - 24 * 3600000,
  },
  {
    id: "lead-5",
    company: "PixelGrid Studio",
    title: "Framer website implementation",
    budget: "$1,500 - $2,500",
    stage: "new",
    category: "Development",
    initials: "PG",
    avatarColor: "bg-purple-600",
    timeAgo: "2d ago",
    source: "Referrals",
    createdAt: Date.now() - 48 * 3600000,
  },
  {
    id: "lead-6",
    company: "Michael Thompson",
    title: "Figma to Webflow conversion",
    budget: "$600 - $900",
    stage: "new",
    category: "No-Code",
    initials: "MT",
    avatarColor: "bg-orange-600",
    timeAgo: "2d ago",
    source: "Search",
    createdAt: Date.now() - 48 * 3600000,
  },

  // In Conversation (4)
  {
    id: "lead-7",
    company: "OpenView Labs",
    title: "Dashboard design and analytics",
    budget: "$4,000 - $6,000",
    stage: "conversation",
    category: "UI/UX",
    initials: "OV",
    avatarColor: "bg-indigo-600",
    timeAgo: "3h ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 3 * 3600000,
  },
  {
    id: "lead-8",
    company: "NeonByte",
    title: "Mobile app UI kit design",
    budget: "$2,000 - $3,500",
    stage: "conversation",
    category: "Mobile Design",
    initials: "NB",
    avatarColor: "bg-cyan-600",
    timeAgo: "8h ago",
    source: "Direct / Profile",
    createdAt: Date.now() - 8 * 3600000,
  },
  {
    id: "lead-9",
    company: "Clara Bennett",
    title: "Personal portfolio website",
    budget: "$1,000 - $1,800",
    stage: "conversation",
    category: "Web Design",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    timeAgo: "1d ago",
    source: "Referrals",
    createdAt: Date.now() - 24 * 3600000,
  },
  {
    id: "lead-10",
    company: "DataWorks",
    title: "Build internal tools app",
    budget: "$6,000 - $8,000",
    stage: "conversation",
    category: "Development",
    initials: "DW",
    avatarColor: "bg-orange-600",
    timeAgo: "2d ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 48 * 3600000,
  },

  // Proposal Sent (3)
  {
    id: "lead-11",
    company: "TechStart Inc.",
    title: "SaaS marketing website",
    budget: "$3,500 - $5,500",
    stage: "proposal",
    category: "Web Design",
    initials: "TS",
    avatarColor: "bg-sky-600",
    timeAgo: "1d ago",
    statusBadge: "Sent 1d ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 24 * 3600000,
  },
  {
    id: "lead-12",
    company: "LaunchFrame",
    title: "Framer website with animations",
    budget: "$2,200 - $2,800",
    stage: "proposal",
    category: "Development",
    initials: "LF",
    avatarColor: "bg-purple-600",
    timeAgo: "2d ago",
    statusBadge: "Sent 2d ago",
    source: "Direct / Profile",
    createdAt: Date.now() - 48 * 3600000,
  },
  {
    id: "lead-13",
    company: "Arise Marketing",
    title: "Rebranding + website redesign",
    budget: "$5,000 - $7,000",
    stage: "proposal",
    category: "Design",
    initials: "AR",
    avatarColor: "bg-emerald-600",
    timeAgo: "3d ago",
    statusBadge: "Sent 3d ago",
    source: "Referrals",
    createdAt: Date.now() - 72 * 3600000,
  },

  // Negotiation (2)
  {
    id: "lead-14",
    company: "BrightKey",
    title: "Web app UI/UX and prototyping",
    budget: "$7,000 - $9,000",
    stage: "negotiation",
    category: "UI/UX",
    initials: "BK",
    avatarColor: "bg-pink-600",
    timeAgo: "1d ago",
    statusBadge: "Last reply 2h ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 24 * 3600000,
  },
  {
    id: "lead-15",
    company: "Inova Agency",
    title: "Custom dashboard development",
    budget: "$4,500 - $6,000",
    stage: "negotiation",
    category: "Development",
    initials: "IA",
    avatarColor: "bg-indigo-600",
    timeAgo: "2d ago",
    statusBadge: "Last reply 5h ago",
    source: "Borynx Spaces",
    createdAt: Date.now() - 48 * 3600000,
  },

  // Closed Won (5)
  {
    id: "lead-16",
    company: "Waverly",
    title: "Marketing site redesign",
    budget: "$2,800",
    stage: "won",
    category: "Web Design",
    initials: "W",
    avatarColor: "bg-indigo-900",
    timeAgo: "Won 2d ago",
    statusBadge: "Paid",
    source: "Direct / Profile",
    createdAt: Date.now() - 48 * 3600000,
  },
  {
    id: "lead-17",
    company: "FlowCraft",
    title: "Webflow development and CMS",
    budget: "$3,200",
    stage: "won",
    category: "No-Code",
    initials: "FC",
    avatarColor: "bg-emerald-500",
    timeAgo: "Won 4d ago",
    statusBadge: "Paid",
    source: "Borynx Spaces",
    createdAt: Date.now() - 96 * 3600000,
  },
  {
    id: "lead-18",
    company: "Studio Paper",
    title: "Portfolio website for creative studio",
    budget: "$1,600",
    stage: "won",
    category: "Web Design",
    initials: "SP",
    avatarColor: "bg-pink-600",
    timeAgo: "Won 5d ago",
    statusBadge: "Paid",
    source: "Referrals",
    createdAt: Date.now() - 120 * 3600000,
  },
  {
    id: "lead-19",
    company: "GrowthRack",
    title: "Landing page optimization",
    budget: "$950",
    stage: "won",
    category: "Development",
    initials: "GR",
    avatarColor: "bg-blue-600",
    timeAgo: "Won 1w ago",
    statusBadge: "Paid",
    source: "Borynx Spaces",
    createdAt: Date.now() - 168 * 3600000,
  },
  {
    id: "lead-20",
    company: "Brandify Digital",
    title: "Brand identity package",
    budget: "$2,100",
    stage: "won",
    category: "Design",
    initials: "BD",
    avatarColor: "bg-amber-500",
    timeAgo: "Won 1w ago",
    statusBadge: "Paid",
    source: "Direct / Profile",
    createdAt: Date.now() - 168 * 3600000,
  },
];

const BOARD_LEADS_STORAGE_KEY = "borynx_board_leads_v2";

export const getBoardLeads = (): BoardLead[] => {
  const stored = localStorage.getItem(BOARD_LEADS_STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(BOARD_LEADS_STORAGE_KEY, JSON.stringify(DEFAULT_BOARD_LEADS));
    return DEFAULT_BOARD_LEADS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_BOARD_LEADS;
  }
};

export const saveBoardLead = (lead: Partial<BoardLead> & { company: string; title: string; budget: string; stage: BoardStage; category: string }) => {
  const current = getBoardLeads();
  const initials = lead.company.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "LD";
  const colors = ["bg-blue-600", "bg-purple-600", "bg-emerald-600", "bg-amber-500", "bg-pink-600", "bg-indigo-600"];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const newLead: BoardLead = {
    id: lead.id || `lead-${Date.now()}`,
    company: lead.company,
    title: lead.title,
    description: lead.description || "",
    budget: lead.budget,
    stage: lead.stage,
    category: lead.category,
    initials: lead.initials || initials,
    avatarColor: lead.avatarColor || randomColor,
    avatarUrl: lead.avatarUrl,
    isVerified: lead.isVerified ?? false,
    timeAgo: "Just now",
    statusBadge: lead.statusBadge,
    source: lead.source || "Direct / Profile",
    createdAt: Date.now(),
  };

  const existingIdx = current.findIndex(l => l.id === newLead.id);
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...newLead };
  } else {
    current.unshift(newLead);
  }

  localStorage.setItem(BOARD_LEADS_STORAGE_KEY, JSON.stringify(current));
  return newLead;
};

export const updateBoardLeadStage = (leadId: string, newStage: BoardStage) => {
  const current = getBoardLeads();
  const updated = current.map(l => {
    if (l.id === leadId) {
      let badge = l.statusBadge;
      if (newStage === "proposal") badge = "Sent just now";
      if (newStage === "negotiation") badge = "Last reply just now";
      if (newStage === "won") badge = "Paid";
      return { ...l, stage: newStage, statusBadge: badge, timeAgo: newStage === "won" ? "Won just now" : "Just now" };
    }
    return l;
  });
  localStorage.setItem(BOARD_LEADS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteBoardLead = (leadId: string) => {
  const current = getBoardLeads();
  const updated = current.filter(l => l.id !== leadId);
  localStorage.setItem(BOARD_LEADS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const fetchLeads = async (): Promise<Lead[]> => {
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, title, description, budget, currency, location, type, status,
      skills, isVerified, postedAt, applicantsCount, postedByUid,
      profiles!leads_postedByUid_fkey (username, displayName, avatarUrl, isVerifiedPro)
    `)
    .order("postedAt", { ascending: false });

  if (error || !data) {
    console.warn("Could not fetch leads from Supabase backend:", error?.message || error);
    return [];
  }

  return (data || []).map((l: any) => ({
    id: l.id,
    title: l.title,
    description: l.description,
    budget: l.budget,
    currency: l.currency,
    location: l.location,
    type: l.type,
    status: l.status,
    skills: l.skills || [],
    isVerified: l.isVerified,
    postedAt: new Date(l.postedAt).getTime(),
    applicantsCount: l.applicantsCount,
    postedBy: {
      uid: l.postedByUid,
      username: l.profiles?.username,
      name: l.profiles?.displayName || l.profiles?.username || "Unknown",
      avatar: l.profiles?.avatarUrl,
      isVerified: l.profiles?.isVerifiedPro || false,
    },
  }));
};

export const syncSupabaseLeadsToBoard = (remoteLeads: Lead[]): BoardLead[] => {
  const current = getBoardLeads();
  const currentIds = new Set(current.map(l => l.id));
  let added = false;

  remoteLeads.forEach(sl => {
    if (!currentIds.has(sl.id)) {
      current.unshift({
        id: sl.id,
        company: sl.postedBy?.name || "Client Opportunity",
        title: sl.title,
        description: sl.description,
        budget: `${sl.budget} ${sl.currency || "USD"}`,
        stage: "new",
        category: sl.type === "Bounty" ? "Bounty" : "Development",
        avatarUrl: sl.postedBy?.avatar,
        isVerified: sl.isVerified,
        timeAgo: "Recently",
        source: "Borynx Spaces",
        createdAt: sl.postedAt || Date.now(),
      });
      added = true;
    }
  });

  if (added) {
    localStorage.setItem(BOARD_LEADS_STORAGE_KEY, JSON.stringify(current));
  }
  return current;
};

export const fetchLeadById = async (id: string): Promise<Lead | null> => {
  try {
    const { data } = await supabase
      .from("leads")
      .select(`
        id, title, description, budget, currency, location, type, status,
        skills, isVerified, postedAt, applicantsCount, postedByUid,
        profiles!leads_postedByUid_fkey (username, displayName, avatarUrl, isVerifiedPro)
      `)
      .eq("id", id)
      .maybeSingle();

    if (data) {
      return {
        id: data.id,
        title: data.title,
        description: data.description,
        budget: data.budget,
        currency: data.currency,
        location: data.location,
        type: data.type,
        status: data.status,
        skills: data.skills || [],
        isVerified: data.isVerified,
        postedAt: new Date(data.postedAt).getTime(),
        applicantsCount: data.applicantsCount,
        postedBy: {
          uid: data.postedByUid,
          name: (data as any).profiles?.displayName || (data as any).profiles?.username || "Unknown",
          avatar: (data as any).profiles?.avatarUrl,
          username: (data as any).profiles?.username,
          isVerified: (data as any).profiles?.isVerifiedPro || false,
        },
      };
    }
  } catch (err) {
    console.warn("fetchLeadById Supabase error, falling back to board leads:", err);
  }

  // Fallback to local board leads so demo/mock opportunities don't 404
  const boardLeads = getBoardLeads();
  const boardMatch = boardLeads.find(l => l.id === id);
  if (boardMatch) {
    return {
      id: boardMatch.id,
      title: boardMatch.title,
      description: boardMatch.description || `Opportunity from ${boardMatch.company} in category ${boardMatch.category}. Looking for experienced freelancers.`,
      budget: boardMatch.budget,
      currency: "USD",
      location: "Remote",
      type: "Project",
      status: "open",
      skills: [boardMatch.category, "Design", "Development"],
      isVerified: boardMatch.isVerified,
      postedAt: boardMatch.createdAt || Date.now() - 3600000,
      applicantsCount: 3,
      postedBy: {
        uid: "client-lead",
        name: boardMatch.company,
        avatar: boardMatch.avatarUrl,
        username: boardMatch.company.toLowerCase().replace(/[^a-z0-9]/g, ""),
        isVerified: boardMatch.isVerified,
      },
    };
  }

  return null;
};

export const createLead = async (
  leadData: Omit<Lead, "id" | "postedAt" | "applicantsCount" | "status">
) => {
  const { data, error } = await supabase
    .from("leads")
    .insert({
      title: leadData.title,
      description: leadData.description,
      budget: leadData.budget,
      currency: leadData.currency,
      location: leadData.location,
      type: leadData.type,
      skills: leadData.skills || [],
      isVerified: false,
      status: "open",
      applicantsCount: 0,
      postedByUid: leadData.postedBy.uid,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const createdId = (data?.id as string) || `lead-${Date.now()}`;

  // Mirror into the Board Leads so the Kanban board displays it immediately
  saveBoardLead({
    id: createdId,
    company: leadData.postedBy?.name || "Client Opportunity",
    title: leadData.title,
    description: leadData.description,
    budget: `${leadData.budget} ${leadData.currency || "USD"}`,
    stage: "new",
    category: leadData.type === "Bounty" ? "Bounty" : "Development",
    avatarUrl: leadData.postedBy?.avatar,
    isVerified: leadData.postedBy?.isVerified,
    source: "Borynx Spaces",
  });

  return createdId;
};

