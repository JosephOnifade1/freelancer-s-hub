import { User } from "@supabase/supabase-js";

// Seed default data
export const seedMockData = () => {
  const seedProfiles = [
    {
      uid: "u1",
      username: "marcelo_dev",
      displayName: "Marcelo Dev",
      initial: "M",
      bio: "Fintech dashboards & React specialist. Helping solo devs raise their rates.",
      location: "Lisbon, Portugal",
      website: "marcelo.dev",
      joined: "2024",
      status: "Available",
      skills: ["React", "TypeScript", "UI Design", "Figma"],
      reputation: 2340,
      followers: 847,
      following: 124,
      avatarUrl: "",
      isVerifiedPro: true,
      hasSeenVeteranCelebration: true,
      createdAt: new Date(Date.now() - 100 * 24 * 3600000).toISOString()
    },
    {
      uid: "u2",
      username: "sarah_writes",
      displayName: "Sarah Writes",
      initial: "S",
      bio: "Copywriter & content strategist. Words that convert.",
      location: "London, UK",
      website: "sarahwrites.com",
      joined: "2024",
      status: "Available",
      skills: ["Copywriting", "SEO", "Content Strategy"],
      reputation: 890,
      followers: 320,
      following: 150,
      avatarUrl: "",
      isVerifiedPro: false,
      hasSeenVeteranCelebration: false,
      createdAt: new Date(Date.now() - 80 * 24 * 3600000).toISOString()
    },
    {
      uid: "u3",
      username: "designkara",
      displayName: "Design Kara",
      initial: "D",
      bio: "Product & brand designer. Crafting sleek digital experiences.",
      location: "New York, USA",
      website: "karadesign.co",
      joined: "2023",
      status: "Busy",
      skills: ["Figma", "UI Design", "Branding", "Webflow"],
      reputation: 4210,
      followers: 1240,
      following: 380,
      avatarUrl: "",
      isVerifiedPro: true,
      hasSeenVeteranCelebration: true,
      createdAt: new Date(Date.now() - 200 * 24 * 3600000).toISOString()
    },
    {
      uid: "u4",
      username: "borynx_team",
      displayName: "Borynx Team",
      initial: "B",
      bio: "Official team behind Borynx: The Freelancer Community.",
      location: "Global",
      website: "borynx.com",
      joined: "2023",
      status: "Available",
      skills: ["Community", "Support", "Events"],
      reputation: 9999,
      followers: 5000,
      following: 50,
      avatarUrl: "",
      isVerifiedPro: true,
      hasSeenVeteranCelebration: true,
      createdAt: new Date(Date.now() - 365 * 24 * 3600000).toISOString()
    },
    {
      uid: "u5",
      username: "freelance_mike",
      displayName: "Freelance Mike",
      initial: "F",
      bio: "Business coach for creative professionals. Stop hourly pricing.",
      location: "Austin, USA",
      website: "freelancemike.co",
      joined: "2024",
      status: "Available",
      skills: ["Coaching", "Sales", "Pricing Strategy"],
      reputation: 1560,
      followers: 670,
      following: 210,
      avatarUrl: "",
      isVerifiedPro: false,
      hasSeenVeteranCelebration: false,
      createdAt: new Date(Date.now() - 60 * 24 * 3600000).toISOString()
    },
    {
      uid: "u6",
      username: "nomad_anna",
      displayName: "Nomad Anna",
      initial: "N",
      bio: "Full-stack marketing consultant traveling the world.",
      location: "Nomadic",
      website: "nomadanna.me",
      joined: "2024",
      status: "Available",
      skills: ["SEO", "Paid Ads", "Google Analytics"],
      reputation: 670,
      followers: 240,
      following: 190,
      avatarUrl: "",
      isVerifiedPro: false,
      hasSeenVeteranCelebration: false,
      createdAt: new Date(Date.now() - 50 * 24 * 3600000).toISOString()
    }
  ];

  const seedCommunities = [
    { slug: "design", name: "Design", description: "UI/UX, branding, typography, illustrations.", memberCount: 120, ownerId: "system", createdAt: new Date().toISOString() },
    { slug: "dev", name: "Developer", description: "Frontend, backend, mobile, DevOps, stacks.", memberCount: 340, ownerId: "system", createdAt: new Date().toISOString() },
    { slug: "writing", name: "Writing", description: "Copywriting, content design, technical writing.", memberCount: 85, ownerId: "system", createdAt: new Date().toISOString() },
    { slug: "marketing", name: "Marketing", description: "SEO, growth hacking, paid acquisition, social.", memberCount: 95, ownerId: "system", createdAt: new Date().toISOString() },
    { slug: "video", name: "Video", description: "Motion design, video editing, cinematography.", memberCount: 50, ownerId: "system", createdAt: new Date().toISOString() },
    { slug: "consulting", name: "Consulting", description: "Client relations, pricing strategy, business growth.", memberCount: 150, ownerId: "system", createdAt: new Date().toISOString() }
  ];

  const seedPosts = [
    {
      id: "1",
      title: "I tripled my freelance rate in 6 months — here's exactly how",
      body: "Last year I was charging $40/hr for React development. After repositioning myself as a specialist in fintech dashboards, I'm now at $120/hr. The key wasn't learning new tech — it was learning to communicate value differently.",
      type: "discussion",
      authorUid: "u1",
      score: 187,
      ups: 187,
      downs: 0,
      views: 420,
      commentCount: 42,
      tags: ["pricing", "growth", "dev"],
      communitySlug: "dev",
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      isDeleted: false,
      isEdited: false
    },
    {
      id: "2",
      title: "How do you handle clients who ghost after the discovery call?",
      body: "Had 4 discovery calls this month. All went great, everyone seemed excited. Then... silence. No follow-up emails answered. Is this normal? What's your follow-up strategy?",
      type: "question",
      authorUid: "u2",
      score: 94,
      ups: 94,
      downs: 0,
      views: 240,
      commentCount: 31,
      tags: ["clients", "sales"],
      communitySlug: "consulting",
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      isDeleted: false,
      isEdited: false
    },
    {
      id: "3",
      title: "The proposal template that landed me 8 clients this quarter",
      body: "I've spent two years refining my proposal process. This Notion template includes sections for scope, timeline, pricing tiers, and a 'why me' section that actually converts. Free to use, link in comments.",
      type: "resource",
      authorUid: "u3",
      score: 312,
      ups: 312,
      downs: 0,
      views: 780,
      commentCount: 67,
      tags: ["proposals", "templates", "design"],
      communitySlug: "design",
      createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
      isDeleted: false,
      isEdited: false
    },
    {
      id: "4",
      title: "🏆 Weekly Thread: Share your biggest win this week",
      body: "Every Friday we celebrate. Big or small — landed a new client, shipped a project, finally sent that invoice, took a day off. Drop your win below. Let's hype each other up.",
      type: "weekly",
      authorUid: "u4",
      score: 156,
      ups: 156,
      downs: 0,
      views: 320,
      commentCount: 89,
      tags: ["wins", "community"],
      communitySlug: "dev",
      createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
      isDeleted: false,
      isEdited: false
    },
    {
      id: "5",
      title: "Stop undercharging: A framework for value-based pricing",
      body: "If you're still pricing by the hour, you're leaving money on the table. Here's a simple framework I use: identify the business outcome, estimate its value, charge 10-20% of that. Works for design, dev, and consulting.",
      type: "discussion",
      authorUid: "u5",
      score: 73,
      ups: 73,
      downs: 0,
      views: 180,
      commentCount: 19,
      tags: ["pricing", "strategy"],
      communitySlug: "consulting",
      createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
      isDeleted: false,
      isEdited: false
    },
    {
      id: "6",
      title: "Best invoicing tools for international freelancers?",
      body: "I work with clients in 4 different countries. Currency conversion, tax compliance, and payment tracking are a nightmare. What tools are you using? Looking for something that handles multi-currency well.",
      type: "question",
      authorUid: "u6",
      score: 45,
      ups: 45,
      downs: 0,
      views: 110,
      commentCount: 23,
      tags: ["tools", "finance", "international"],
      communitySlug: "marketing",
      createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
      isDeleted: false,
      isEdited: false
    }
  ];

  const seedComments = [
    {
      id: "c1",
      postId: "3",
      parentId: null,
      authorUid: "u1",
      body: "This is gold. The 'why me' section reframed how I think about positioning — stopped listing skills, started naming outcomes. Already adapted it for my next pitch.",
      score: 48,
      ups: 48,
      downs: 0,
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
    },
    {
      id: "c2",
      postId: "2",
      parentId: null,
      authorUid: "u2",
      body: "I send one follow-up after 3 days, another after a week, then move on. Ghosting usually means budget or internal politics — rarely about you. Don't take it personally.",
      score: 31,
      ups: 31,
      downs: 0,
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 4 * 3600000).toISOString()
    },
    {
      id: "c3",
      postId: "5",
      parentId: null,
      authorUid: "u1",
      body: "Value-based works best when you can quantify the outcome. For dashboards, I tie the price to the hours saved per week × the team's blended rate. Easy sell.",
      score: 27,
      ups: 27,
      downs: 0,
      isDeleted: false,
      isEdited: false,
      createdAt: new Date(Date.now() - 10 * 3600000).toISOString()
    }
  ];

  const seedLeads = [
    {
      id: "l1",
      title: "React Native Developer for Fitness App",
      description: "We need an experienced developer to help us ship the first version of our mobile fitness app. 3-month contract.",
      budget: "$5,000 - $8,000",
      currency: "USD",
      location: "Remote",
      type: "Project",
      status: "open",
      skills: ["React Native", "TypeScript", "Tailwind CSS"],
      isVerified: true,
      postedByUid: "u1",
      postedAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
      applicantsCount: 12
    },
    {
      id: "l2",
      title: "UI/UX Designer for Web3 Landing Page",
      description: "Looking for a modern visual designer to create a landing page for our new Web3 protocol. Fast turnaround needed.",
      budget: "$2,000",
      currency: "USD",
      location: "Remote",
      type: "Bounty",
      status: "open",
      skills: ["Figma", "UI Design", "3D assets"],
      isVerified: false,
      postedByUid: "u3",
      postedAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
      applicantsCount: 5
    }
  ];

  const seedUsernames: Record<string, string> = {};
  seedProfiles.forEach(p => {
    seedUsernames[p.username] = p.uid;
  });

  const checkAndSeed = (tableKey: string, seedData: any) => {
    const key = `mock_supabase_${tableKey}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify(seedData));
    }
  };

  checkAndSeed("profiles", seedProfiles);
  checkAndSeed("communities", seedCommunities);
  checkAndSeed("posts", seedPosts);
  checkAndSeed("comments", seedComments);
  checkAndSeed("leads", seedLeads);
  
  if (!localStorage.getItem("mock_supabase_usernames")) {
    localStorage.setItem("mock_supabase_usernames", JSON.stringify(seedUsernames));
  }
};

class MockQueryBuilder {
  private tableName: string;
  private selectFields: string = "*";
  private filters: { type: "eq" | "or"; column?: string; value?: any; orString?: string }[] = [];
  private orderField?: string;
  private orderAscending?: boolean;
  private limitCount?: number;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  private isCount: boolean = false;

  select(fields: string = "*", options?: { count?: string; head?: boolean }) {
    this.selectFields = fields;
    this.operation = "select";
    if (options?.count) {
      this.isCount = true;
    }
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: "eq", column, value });
    return this;
  }

  or(orString: string) {
    this.filters.push({ type: "or", orString });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderField = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    this.isMaybeSingle = false;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    this.isMaybeSingle = true;
    return this;
  }

  insert(data: any) {
    this.operation = "insert";
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.operation = "update";
    this.payload = data;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  upsert(data: any) {
    this.operation = "upsert";
    this.payload = data;
    return this;
  }

  async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    try {
      const res = await this.execute();
      if (onfulfilled) return onfulfilled(res);
      return res;
    } catch (err) {
      if (onrejected) return onrejected(err);
      throw err;
    }
  }

  private async execute() {
    const key = `mock_supabase_${this.tableName}`;
    let data: any[] = JSON.parse(localStorage.getItem(key) || "[]");

    if (this.operation === "select") {
      let filtered = [...data];
      for (const filter of this.filters) {
        if (filter.type === "eq") {
          filtered = filtered.filter(row => row[filter.column!] == filter.value);
        } else if (filter.type === "or") {
          const parts = filter.orString!.split(",");
          filtered = filtered.filter(row => {
            return parts.some(part => {
              const subparts = part.split(".");
              if (subparts.length >= 3) {
                const col = subparts[0];
                const operator = subparts[1];
                let matchVal = subparts.slice(2).join(".");
                if (operator === "ilike") {
                  matchVal = matchVal.replace(/%/g, "").toLowerCase();
                  return String(row[col] || "").toLowerCase().includes(matchVal);
                }
              }
              return false;
            });
          });
        }
      }

      if (this.orderField) {
        filtered.sort((a, b) => {
          let valA = a[this.orderField!];
          let valB = b[this.orderField!];

          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;

          if (typeof valA === "string" && typeof valB === "string") {
            const cmp = valA.localeCompare(valB);
            return this.orderAscending ? cmp : -cmp;
          }

          if (valA instanceof Date || (typeof valA === "string" && !isNaN(Date.parse(valA)))) {
            const timeA = new Date(valA).getTime();
            const timeB = new Date(valB).getTime();
            return this.orderAscending ? (timeA > timeB ? 1 : -1) : (timeA < timeB ? 1 : -1);
          }

          return this.orderAscending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
      }

      if (this.limitCount !== undefined) {
        filtered = filtered.slice(0, this.limitCount);
      }

      const mapped = filtered.map(row => {
        const newRow = { ...row };
        
        if (this.selectFields.includes("profiles")) {
          const profilesTable = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
          const authorUid = row.authorUid || row.postedByUid;
          const profile = profilesTable.find((p: any) => p.uid === authorUid);
          newRow.profiles = profile || null;
        }

        return newRow;
      });

      if (this.isCount) {
        return { data: null, count: filtered.length, error: null };
      }

      if (this.isSingle) {
        return {
          data: mapped[0] || null,
          error: mapped[0] ? null : (this.isMaybeSingle ? null : { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" })
        };
      }

      return { data: mapped, error: null };
    }

    if (this.operation === "insert") {
      const isArray = Array.isArray(this.payload);
      const inserted = isArray ? this.payload : [this.payload];
      
      const newRecords = inserted.map(item => {
        const record = { ...item };
        if (!record.id) {
          record.id = self.crypto.randomUUID();
        }
        if (!record.createdAt) {
          record.createdAt = new Date().toISOString();
        }
        if (!record.postedAt) {
          record.postedAt = new Date().toISOString();
        }
        return record;
      });

      data.push(...newRecords);
      localStorage.setItem(key, JSON.stringify(data));

      if (this.isSingle || !isArray) {
        return { data: newRecords[0], error: null };
      }
      return { data: newRecords, error: null };
    }

    if (this.operation === "update") {
      let updatedCount = 0;
      const updatedData = data.map(row => {
        const matches = this.filters.every(filter => {
          if (filter.type === "eq") {
            return row[filter.column!] == filter.value;
          }
          return false;
        });

        if (matches) {
          updatedCount++;
          return { ...row, ...this.payload, updatedAt: new Date().toISOString() };
        }
        return row;
      });

      localStorage.setItem(key, JSON.stringify(updatedData));
      return { data: updatedData.filter((_, idx) => data[idx] !== updatedData[idx]), error: null };
    }

    if (this.operation === "delete") {
      const filteredData = data.filter(row => {
        const matches = this.filters.every(filter => {
          if (filter.type === "eq") {
            return row[filter.column!] == filter.value;
          }
          return false;
        });
        return !matches;
      });

      localStorage.setItem(key, JSON.stringify(filteredData));
      return { data: null, error: null };
    }

    if (this.operation === "upsert") {
      const isArray = Array.isArray(this.payload);
      const items = isArray ? this.payload : [this.payload];

      items.forEach(item => {
        let matchIdx = -1;
        if (this.tableName === "votes") {
          matchIdx = data.findIndex(row => 
            row.userId === item.userId && 
            row.entityType === item.entityType && 
            row.entityId === item.entityId
          );
        } else {
          const matchKey = item.id ? "id" : (item.uid ? "uid" : "username");
          matchIdx = data.findIndex(row => row[matchKey] === item[matchKey]);
        }

        if (matchIdx >= 0) {
          data[matchIdx] = { ...data[matchIdx], ...item, updatedAt: new Date().toISOString() };
        } else {
          const newItem = { ...item };
          if (!newItem.id && this.tableName !== "votes" && this.tableName !== "community_members" && this.tableName !== "saved_posts" && this.tableName !== "follows") {
            newItem.id = self.crypto.randomUUID();
          }
          if (!newItem.createdAt) {
            newItem.createdAt = new Date().toISOString();
          }
          data.push(newItem);
        }
      });

      localStorage.setItem(key, JSON.stringify(data));
      return { data: isArray ? items : items[0], error: null };
    }

    return { data: null, error: null };
  }
}

class MockAuth {
  private listeners: ((event: string, session: any) => void)[] = [];

  private getSessionUser() {
    const session = localStorage.getItem("mock_supabase_session");
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }

  private setSessionUser(session: any) {
    if (session) {
      localStorage.setItem("mock_supabase_session", JSON.stringify(session));
      this.triggerListeners("SIGNED_IN", session);
    } else {
      localStorage.removeItem("mock_supabase_session");
      this.triggerListeners("SIGNED_OUT", null);
    }
  }

  private triggerListeners(event: string, session: any) {
    this.listeners.forEach(cb => cb(event, session));
  }

  async signUp({ email, password, options }: any) {
    const users = JSON.parse(localStorage.getItem("mock_supabase_users") || "[]");
    if (users.find((u: any) => u.email === email)) {
      return { data: null, error: { message: "User already exists." } };
    }

    const uid = self.crypto.randomUUID();
    const newUser = { uid, email, password };
    users.push(newUser);
    localStorage.setItem("mock_supabase_users", JSON.stringify(users));

    const displayName = options?.data?.display_name || email.split("@")[0];
    const username = displayName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    
    const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
    const newProfile = {
      uid,
      username,
      displayName,
      initial: displayName.charAt(0).toUpperCase(),
      bio: "New to Borynx!",
      location: "Earth",
      website: "",
      joined: new Date().getFullYear().toString(),
      status: "Available",
      skills: [],
      reputation: 10,
      followers: 0,
      following: 0,
      avatarUrl: "",
      isVerifiedPro: false,
      hasSeenVeteranCelebration: false,
      createdAt: new Date().toISOString()
    };
    profiles.push(newProfile);
    localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));

    const usernames = JSON.parse(localStorage.getItem("mock_supabase_usernames") || "{}");
    usernames[username] = uid;
    localStorage.setItem("mock_supabase_usernames", JSON.stringify(usernames));

    const session = {
      user: {
        id: uid,
        email,
        user_metadata: { display_name: displayName }
      },
      access_token: "mock-token",
      refresh_token: "mock-refresh-token"
    };
    this.setSessionUser(session);

    return { data: session, error: null };
  }

  async signInWithPassword({ email, password }: any) {
    const users = JSON.parse(localStorage.getItem("mock_supabase_users") || "[]");
    const user = users.find((u: any) => u.email === email && u.password === password);
    if (!user) {
      return { data: null, error: { message: "Invalid email or password." } };
    }

    const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
    const profile = profiles.find((p: any) => p.uid === user.uid);
    const displayName = profile?.displayName || user.email.split("@")[0];

    const session = {
      user: {
        id: user.uid,
        email: user.email,
        user_metadata: { display_name: displayName }
      },
      access_token: "mock-token",
      refresh_token: "mock-refresh-token"
    };
    this.setSessionUser(session);

    return { data: session, error: null };
  }

  async signInWithOAuth({ provider, options }: any) {
    const email = "google_user@example.com";
    const displayName = "Google User";
    
    const users = JSON.parse(localStorage.getItem("mock_supabase_users") || "[]");
    let user = users.find((u: any) => u.email === email);
    if (!user) {
      const uid = self.crypto.randomUUID();
      user = { uid, email, password: "oauth_dummy_password" };
      users.push(user);
      localStorage.setItem("mock_supabase_users", JSON.stringify(users));

      const username = "google_user";
      const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
      const newProfile = {
        uid,
        username,
        displayName,
        initial: "G",
        bio: "Logged in via Google",
        location: "Earth",
        website: "",
        joined: new Date().getFullYear().toString(),
        status: "Available",
        skills: [],
        reputation: 10,
        followers: 0,
        following: 0,
        avatarUrl: "",
        isVerifiedPro: false,
        hasSeenVeteranCelebration: false,
        createdAt: new Date().toISOString()
      };
      profiles.push(newProfile);
      localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));

      const usernames = JSON.parse(localStorage.getItem("mock_supabase_usernames") || "{}");
      usernames[username] = uid;
      localStorage.setItem("mock_supabase_usernames", JSON.stringify(usernames));
    }

    const session = {
      user: {
        id: user.uid,
        email: user.email,
        user_metadata: { display_name: displayName }
      },
      access_token: "mock-token",
      refresh_token: "mock-refresh-token"
    };
    this.setSessionUser(session);

    if (options?.redirectTo) {
      setTimeout(() => {
        window.location.href = options.redirectTo;
      }, 500);
    }

    return { data: session, error: null };
  }

  async signOut() {
    this.setSessionUser(null);
    return { error: null };
  }

  async getSession() {
    const session = this.getSessionUser();
    return { data: { session }, error: null };
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    this.listeners.push(callback);
    const session = this.getSessionUser();
    callback("INITIAL_SESSION", session);

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
          }
        }
      }
    };
  }
}

export class MockSupabaseClient {
  auth = new MockAuth();

  from(tableName: string) {
    return new MockQueryBuilder(tableName);
  }

  async rpc(fnName: string, args: any) {
    if (fnName === "increment_post_views") {
      const posts = JSON.parse(localStorage.getItem("mock_supabase_posts") || "[]");
      const postIdx = posts.findIndex((p: any) => p.id === args.post_id);
      if (postIdx >= 0) {
        posts[postIdx].views = (posts[postIdx].views || 0) + 1;
        localStorage.setItem("mock_supabase_posts", JSON.stringify(posts));
      }
      return { data: null, error: null };
    }

    if (fnName === "increment_comment_count") {
      const posts = JSON.parse(localStorage.getItem("mock_supabase_posts") || "[]");
      const postIdx = posts.findIndex((p: any) => p.id === args.post_id);
      if (postIdx >= 0) {
        posts[postIdx].commentCount = (posts[postIdx].commentCount || 0) + 1;
        localStorage.setItem("mock_supabase_posts", JSON.stringify(posts));
      }
      return { data: null, error: null };
    }

    if (fnName === "increment_followers") {
      const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
      const idx = profiles.findIndex((p: any) => p.uid === args.target_uid);
      if (idx >= 0) {
        profiles[idx].followers = (profiles[idx].followers || 0) + 1;
        localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));
      }
      return { data: null, error: null };
    }

    if (fnName === "decrement_followers") {
      const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
      const idx = profiles.findIndex((p: any) => p.uid === args.target_uid);
      if (idx >= 0) {
        profiles[idx].followers = Math.max(0, (profiles[idx].followers || 0) - 1);
        localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));
      }
      return { data: null, error: null };
    }

    if (fnName === "increment_following") {
      const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
      const idx = profiles.findIndex((p: any) => p.uid === args.target_uid);
      if (idx >= 0) {
        profiles[idx].following = (profiles[idx].following || 0) + 1;
        localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));
      }
      return { data: null, error: null };
    }

    if (fnName === "decrement_following") {
      const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
      const idx = profiles.findIndex((p: any) => p.uid === args.target_uid);
      if (idx >= 0) {
        profiles[idx].following = Math.max(0, (profiles[idx].following || 0) - 1);
        localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));
      }
      return { data: null, error: null };
    }

    if (fnName === "increment_community_members") {
      const communities = JSON.parse(localStorage.getItem("mock_supabase_communities") || "[]");
      const idx = communities.findIndex((c: any) => c.slug === args.community_slug);
      if (idx >= 0) {
        communities[idx].memberCount = (communities[idx].memberCount || 0) + 1;
        localStorage.setItem("mock_supabase_communities", JSON.stringify(communities));
      }
      return { data: null, error: null };
    }

    if (fnName === "decrement_community_members") {
      const communities = JSON.parse(localStorage.getItem("mock_supabase_communities") || "[]");
      const idx = communities.findIndex((c: any) => c.slug === args.community_slug);
      if (idx >= 0) {
        communities[idx].memberCount = Math.max(0, (communities[idx].memberCount || 0) - 1);
        localStorage.setItem("mock_supabase_communities", JSON.stringify(communities));
      }
      return { data: null, error: null };
    }

    if (fnName === "apply_vote_aggregate") {
      const tableKey = args.entity_type === "comment" ? "mock_supabase_comments" : "mock_supabase_posts";
      const records = JSON.parse(localStorage.getItem(tableKey) || "[]");
      const recordIdx = records.findIndex((item: any) => item.id === args.entity_id);
      if (recordIdx >= 0) {
        records[recordIdx].score = (records[recordIdx].score || 0) + args.score_delta;
        records[recordIdx].ups = (records[recordIdx].ups || 0) + args.ups_delta;
        records[recordIdx].downs = (records[recordIdx].downs || 0) + args.downs_delta;
        localStorage.setItem(tableKey, JSON.stringify(records));
      }

      if (args.author_uid && args.author_uid !== args.voter_uid) {
        const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
        const profileIdx = profiles.findIndex((p: any) => p.uid === args.author_uid);
        if (profileIdx >= 0) {
          profiles[profileIdx].reputation = (profiles[profileIdx].reputation || 0) + args.score_delta;
          localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));
        }
      }

      return { data: null, error: null };
    }

    if (fnName === "jsonb_set_community") {
      const profiles = JSON.parse(localStorage.getItem("mock_supabase_profiles") || "[]");
      const idx = profiles.findIndex((p: any) => p.uid === args.uid);
      if (idx >= 0) {
        if (!profiles[idx].communitiesList) {
          profiles[idx].communitiesList = {};
        }
        profiles[idx].communitiesList[args.slug] = args.value;
        localStorage.setItem("mock_supabase_profiles", JSON.stringify(profiles));
        return profiles[idx].communitiesList;
      }
      return null;
    }

    console.warn(`RPC ${fnName} is not fully mocked, returning null success.`);
    return { data: null, error: null };
  }
}
