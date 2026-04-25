import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, set, serverTimestamp } from "firebase/database";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const posts = [
  // Persona 1: Marcelo (Senior Dev)
  {
    title: "Architecture Patterns for Multi-Tenant SaaS: RLS vs Database-per-Tenant",
    body: "Deep dive into the trade-offs of performance vs isolation. For high-ticket clients, I always recommend schema-level isolation to prevent data leaks. RLS is great for mid-market, but when you're charging $10k+, clients want dedicated compute.",
    type: "resource",
    tags: ["SaaS", "Architecture", "Engineering"],
    author: { name: "Marcelo", reputation: 2500, uid: "marcelo_dev" },
    score: 42,
    commentCount: 12,
    views: 450
  },
  {
    title: "504 timeouts on Vercel Edge Functions with Supabase? Help needed.",
    body: "I've optimized my queries and added connection pooling, but still getting intermittent timeouts during peak hours. Is it a Vercel region issue or should I switch to a dedicated cluster? My client's dashboard is taking the hit.",
    type: "question",
    tags: ["Vercel", "Supabase", "Infrastructure"],
    author: { name: "Marcelo", reputation: 2500, uid: "marcelo_dev" },
    score: 15,
    commentCount: 8,
    views: 210
  },
  {
    title: "Zero-Downtime Database Migrations with Drizzle and Bun",
    body: "Sharing the Github Action config I use for my $5k/mo retainer clients. It handles rollback safety and schema synchronization without any manual intervention. Reliability is the best selling point for a senior freelancer.",
    type: "resource",
    tags: ["DevOps", "Bun", "Automation"],
    author: { name: "Marcelo", reputation: 2500, uid: "marcelo_dev" },
    score: 38,
    commentCount: 5,
    views: 320
  },
  {
    title: "How to 'Sell' Refactoring to Your Non-Tech CEO",
    body: "Use business metrics, not technical jargon. I map every refactor to a 15% reduction in bug-related support tickets. Here's my template for the 'Efficiency Audit' that usually gets the green light.",
    type: "resource",
    tags: ["Management", "Career", "Leadership"],
    author: { name: "Marcelo", reputation: 2500, uid: "marcelo_dev" },
    score: 56,
    commentCount: 18,
    views: 890
  },
  {
    title: "Best practices for implementing 2FA with WebAuthn for Fintech clients?",
    body: "Starting a project for a wealth management firm. They need biometric passkeys. Any gotchas with browser compatibility or cross-platform sync? Security is non-negotiable here.",
    type: "question",
    tags: ["Security", "WebAuthn", "Fintech"],
    author: { name: "Marcelo", reputation: 2500, uid: "marcelo_dev" },
    score: 12,
    commentCount: 4,
    views: 150
  },

  // Persona 2: Kara (Brand Designer)
  {
    title: "Stop charging hourly. Switch to a flat-fee value model.",
    body: "Clients pay for the impact, not the hours. When I stopped counting minutes, I started focusing on results. Let's discuss how to frame this to legacy clients who are used to the 'time-tracking' trap.",
    type: "discussion",
    tags: ["Pricing", "Strategy", "Business"],
    author: { name: "Kara", reputation: 1800, uid: "kara_design" },
    score: 89,
    commentCount: 45,
    views: 1200
  },
  {
    title: "Brand Identity is 20% Visuals and 80% Verbal Strategy.",
    body: "Most designers sell logos. I sell a system that reduces customer acquisition costs. If you aren't doing the verbal strategy, you're leaving 50% of the budget on the table. How do you pitch the 'thinking' phase?",
    type: "discussion",
    tags: ["Design", "Branding", "Value"],
    author: { name: "Kara", reputation: 1800, uid: "kara_design" },
    score: 64,
    commentCount: 22,
    views: 750
  },
  {
    title: "Handling 'Creative Fatigue' with 5 premium clients simultaneously.",
    body: "Burnout is real in the high-end space. I've moved to a 'sprint' model where I only take one major project every 3 weeks. Does anyone else use a similar buffer or 'Deep Work' window?",
    type: "discussion",
    tags: ["Wellness", "Productivity", "Workflow"],
    author: { name: "Kara", reputation: 1800, uid: "kara_design" },
    score: 34,
    commentCount: 15,
    views: 420
  },
  {
    title: "The 'Expert' Frame: How to stop being a pair of hands.",
    body: "If the client is telling you what to do, you've already lost the value-based battle. Here's the discovery script I use to position myself as the authority from day one. Stop taking orders, start giving advice.",
    type: "discussion",
    tags: ["Clients", "Consulting", "Mindset"],
    author: { name: "Kara", reputation: 1800, uid: "kara_design" },
    score: 112,
    commentCount: 38,
    views: 1500
  },
  {
    title: "Design Retainers: Are they actually worth it for boutique studios?",
    body: "I'm seeing a trend away from retainers towards high-impact 'one-offs' with high ticket prices. Is the recurring revenue worth the constant 'small task' drag? Let's weigh the pros and cons.",
    type: "discussion",
    tags: ["Retainers", "Agencies", "Profit"],
    author: { name: "Kara", reputation: 1800, uid: "kara_design" },
    score: 28,
    commentCount: 14,
    views: 310
  },

  // Persona 3: Mike (Growth Marketer)
  {
    title: "The 3-step follow-up sequence that revived 4 'dead' leads this month.",
    body: "Most freelancers give up after one email. My sequence uses a mix of value-add, 'the break up', and a direct ask. 40% open rate guaranteed. I'll drop the templates in the comments if anyone is interested.",
    type: "resource",
    tags: ["LeadGen", "Marketing", "Sales"],
    author: { name: "Mike", reputation: 1200, uid: "mike_growth" },
    score: 75,
    commentCount: 32,
    views: 980
  },
  {
    title: "How are you dealing with 'Ghosting' after a discovery call?",
    body: "The call went great, they loved the proposal, then... silence. I usually wait 3 days. Should I add a LinkedIn touchpoint or is that crossing a line? Looking for a balance between persistent and annoying.",
    type: "question",
    tags: ["Ghosting", "FreelanceLife", "Networking"],
    author: { name: "Mike", reputation: 1200, uid: "mike_growth" },
    score: 41,
    commentCount: 28,
    views: 650
  },
  {
    title: "Cold Outreach: Landing a $12k retainer with a 60s Loom video.",
    body: "Stop sending generic emails. 60 seconds of video showing you actually audited their site works wonders. Here's the script I use for the video intro that hooks them in the first 5 seconds.",
    type: "resource",
    tags: ["Outreach", "Growth", "Video"],
    author: { name: "Mike", reputation: 1200, uid: "mike_growth" },
    score: 92,
    commentCount: 19,
    views: 1100
  },
  {
    title: "Using paid ads (FB/IG) for high-ticket freelance clients?",
    body: "Considering a $500/mo budget to target CEOs of mid-market SaaS companies. Any specific targeting layers that actually work for professional services? Or should I stick to LinkedIn?",
    type: "question",
    tags: ["Ads", "PaidSocial", "CustomerAcquisition"],
    author: { name: "Mike", reputation: 1200, uid: "mike_growth" },
    score: 22,
    commentCount: 11,
    views: 340
  },
  {
    title: "My 'Client Filter' Checklist: 5 red flags to watch for.",
    body: "'We need this yesterday' is the biggest one. Here are the other 4 that have saved me hundreds of hours of unbilled frustration this year. Vet your clients before they vet you.",
    type: "resource",
    tags: ["RedFlags", "Vetting", "Efficiency"],
    author: { name: "Mike", reputation: 1200, uid: "mike_growth" },
    score: 68,
    commentCount: 24,
    views: 820
  }
];

async function seed() {
  console.log("Starting seeding process...");
  const postsRef = ref(db, 'posts');
  
  for (const post of posts) {
    const newPostRef = push(postsRef);
    await set(newPostRef, {
      ...post,
      createdAt: Date.now()
    });
    console.log(`Added post: ${post.title}`);
  }
  
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
