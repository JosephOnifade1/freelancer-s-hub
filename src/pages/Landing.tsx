import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Briefcase,
  Check,
  Code2,
  Megaphone,
  MessageSquare,
  Palette,
  PenTool,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";
import { fetchAllCommunities, type CommunityData } from "@/lib/communities";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ══════════════════════════════════════════════════════════════════════════
   Design notes (premium pass, daily.dev-inspired discipline):
   - Flat surfaces only. No glow blobs, glassmorphism, gradient text, or
     floating badge clusters — the product UI carries the page.
   - One radius (rounded-lg/xl), hairline borders, generous whitespace.
   - --brand (purple) is spent only on interactive accents: active tab,
     links, vote arrows. Primary buttons are plain primary (white on dark).
   - Type system: Space Grotesk (font-display) for headlines, Inter for
     body, JetBrains Mono (font-mono) for labels, budgets and counts.
   ══════════════════════════════════════════════════════════════════════════ */

/* Fallback mirrors the seed in supabase_schema.sql. Live data replaces it
   (communities are public-read); member counts render only from live data. */
const FALLBACK_SPACES: CommunityData[] = [
  { slug: "design", name: "Design", description: "UI, UX, branding, illustration.", category: "Design", topics: ["ui", "ux", "branding"], memberCount: 0, ownerId: "system", createdAt: "" },
  { slug: "dev", name: "Freelance Dev", description: "Web, mobile, full-stack devs going solo.", category: "Development", topics: ["web", "mobile", "backend"], memberCount: 0, ownerId: "system", createdAt: "" },
  { slug: "writing", name: "Writing", description: "Copywriters, content writers, ghostwriters.", category: "Other", topics: ["copy", "content", "ghostwriting"], memberCount: 0, ownerId: "system", createdAt: "" },
  { slug: "marketing", name: "Marketing", description: "Growth, SEO, paid ads, email.", category: "Marketing", topics: ["seo", "growth", "ads"], memberCount: 0, ownerId: "system", createdAt: "" },
  { slug: "video", name: "Video & Motion", description: "Editors, motion designers, animators.", category: "Other", topics: ["video", "motion", "animation"], memberCount: 0, ownerId: "system", createdAt: "" },
  { slug: "consulting", name: "Consulting", description: "Strategy, ops, advisory work.", category: "Business", topics: ["strategy", "ops", "advisory"], memberCount: 0, ownerId: "system", createdAt: "" },
];

const SPACE_ICONS: Record<string, LucideIcon> = {
  design: Palette,
  dev: Code2,
  writing: PenTool,
  marketing: Megaphone,
  video: Video,
  consulting: Briefcase,
};

/* Illustrative preview content in the shape of the real PostCard/LeadCard. */
const PREVIEW_POSTS = [
  {
    space: "dev",
    author: "Maya",
    verified: true,
    title: "I tripled my freelance rate in 6 months — here's exactly how",
    excerpt: "I stopped pitching hours and started pitching outcomes. The repositioning — not new tech — moved me from $40/hr to $120/hr.",
    score: 128,
    comments: 42,
    tags: ["pricing", "growth"],
  },
  {
    space: "consulting",
    author: "Sam",
    verified: false,
    title: "How do you handle clients who ghost after the discovery call?",
    excerpt: "Four great calls this month, then silence. What's your follow-up cadence for high-ticket clients?",
    score: 86,
    comments: 37,
    tags: ["clients"],
  },
  {
    space: "design",
    author: "Ada",
    verified: true,
    title: "The portfolio teardown that doubled my inbound leads",
    excerpt: "I cut 14 projects down to 4 case studies with numbers attached. Everything changed after that.",
    score: 64,
    comments: 21,
    tags: ["portfolio", "clients"],
  },
];

const EXAMPLE_LEADS = [
  { title: "React Native Developer for Fitness App", budget: "$5,000 – $8,000", meta: "Remote · Project", skills: ["React Native", "TypeScript"] },
  { title: "UI/UX Designer for Web3 Landing Page", budget: "$2,000", meta: "Remote · Bounty", skills: ["Figma", "UI Design"] },
  { title: "SEO Consultant for SaaS Blog Audit", budget: "$1,500", meta: "Remote · Retainer", skills: ["SEO", "Content"] },
];

const MILESTONES = [
  { name: "Rising Voice", rep: "100", note: "Your answers start getting noticed." },
  { name: "Trusted Voice", rep: "1,000", note: "A profile clients can trust at a glance." },
  { name: "Veteran Freelancer", rep: "5,000", note: "The top tier of community standing." },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z" />
    </svg>
  );
}

/* ─── Feed row (one post, hairline-separated — no card-in-card) ──────────── */
function PostRow({ post, last = false }: { post: (typeof PREVIEW_POSTS)[number]; last?: boolean }) {
  return (
    <article className={`flex gap-3 px-4 py-4 sm:px-5 ${last ? "" : "border-b border-border/60"}`}>
      <div className="flex w-8 shrink-0 flex-col items-center gap-0.5 pt-0.5" aria-hidden="true">
        <ArrowBigUp className="h-5 w-5 text-muted-foreground" />
        <span className="font-mono text-xs font-semibold text-foreground">{post.score}</span>
        <ArrowBigDown className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 font-body text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">b/{post.space}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            f/{post.author}
            {post.verified && <BadgeCheck size={12} className="text-brand" aria-label="Verified Pro" />}
          </span>
        </p>
        <h3 className="mt-1 font-body text-[15px] font-semibold leading-snug text-foreground">{post.title}</h3>
        <p className="mt-0.5 line-clamp-2 font-body text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" /> {post.comments}
          </span>
          {post.tags.map((tag) => (
            <span key={tag} className="font-mono text-[11px] text-muted-foreground">#{tag}</span>
          ))}
        </p>
      </div>
    </article>
  );
}

function LeadRow({ lead, last = false }: { lead: (typeof EXAMPLE_LEADS)[number]; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 px-4 py-4 sm:px-5 ${last ? "" : "border-b border-border/60"}`}>
      <div className="min-w-0">
        <h3 className="font-body text-[15px] font-semibold leading-snug text-foreground">{lead.title}</h3>
        <p className="mt-0.5 font-body text-xs text-muted-foreground">
          {lead.meta} · {lead.skills.join(" · ")}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold text-success">{lead.budget}</p>
        <Link to="/signup" className="mt-0.5 inline-block font-body text-xs font-semibold text-brand hover:underline">
          Apply
        </Link>
      </div>
    </div>
  );
}

/* ─── Hero product frame: the app itself, flat and full-bleed ───────────── */
function AppPreview({ spaces }: { spaces: CommunityData[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-left">
      {/* window chrome */}
      <div className="flex h-11 items-center gap-3 border-b border-border px-4">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </span>
        <span className="mx-auto hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex">
          borynx<span className="text-muted-foreground/50">/ feed</span>
        </span>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 sm:ml-0">Preview</span>
      </div>

      <div className="grid md:grid-cols-[200px_1fr] lg:grid-cols-[200px_1fr_272px]">
        {/* sidebar */}
        <aside className="hidden border-r border-border px-3 py-4 md:block">
          <p className="px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Feed</p>
          <ul className="mt-2 space-y-0.5 font-body text-[13px]">
            <li className="rounded-md bg-muted px-2 py-1.5 font-medium text-foreground">Hot</li>
            <li className="rounded-md px-2 py-1.5 text-muted-foreground">Best</li>
            <li className="rounded-md px-2 py-1.5 text-muted-foreground">New</li>
            <li className="rounded-md px-2 py-1.5 text-muted-foreground">Following</li>
          </ul>
          <p className="mt-5 px-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">B-Spaces</p>
          <ul className="mt-2 space-y-0.5 font-body text-[13px] text-muted-foreground">
            {spaces.slice(0, 5).map((s) => (
              <li key={s.slug} className="rounded-md px-2 py-1.5">b/{s.slug}</li>
            ))}
          </ul>
        </aside>

        {/* feed */}
        <div>
          <div className="flex items-center gap-4 border-b border-border px-4 py-3 sm:px-5">
            <span className="font-body text-[13px] font-semibold text-foreground">Hot</span>
            <span className="font-body text-[13px] text-muted-foreground">Best</span>
            <span className="font-body text-[13px] text-muted-foreground">New</span>
            <span className="ml-auto rounded-md bg-primary px-3 py-1.5 font-body text-xs font-semibold text-primary-foreground">New post</span>
          </div>
          {PREVIEW_POSTS.map((post, i) => (
            <PostRow key={post.title} post={post} last={i === PREVIEW_POSTS.length - 1} />
          ))}
        </div>

        {/* right rail */}
        <aside className="hidden border-l border-border lg:block">
          <p className="border-b border-border px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Latest leads
          </p>
          {EXAMPLE_LEADS.slice(0, 2).map((lead) => (
            <div key={lead.title} className="border-b border-border/60 px-4 py-3.5">
              <p className="font-body text-[13px] font-semibold leading-snug text-foreground">{lead.title}</p>
              <p className="mt-1 font-mono text-xs text-success">{lead.budget}</p>
              <p className="mt-0.5 font-body text-[11px] text-muted-foreground">{lead.meta}</p>
            </div>
          ))}
          <div className="px-4 py-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Your reputation</p>
            <p className="mt-2 flex items-center gap-1.5 font-body text-[13px] font-semibold text-foreground">
              Trusted Voice <BadgeCheck size={13} className="text-brand" />
            </p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full w-2/3 bg-brand" />
            </div>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">640 / 1,000 rep</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ─── Showcase tabs ─────────────────────────────────────────────────────── */
type TabId = "feed" | "spaces" | "leads" | "reputation";

const TABS: { id: TabId; label: string; heading: string; body: string; bullets: string[] }[] = [
  {
    id: "feed",
    label: "Feed",
    heading: "A feed ranked by freelancers, for freelancers.",
    body: "Pricing, clients, tools, taxes — the conversations that actually move a solo business, sorted Hot, Best, or New. No algorithmic rage-bait.",
    bullets: ["Discussions, questions, resources & polls", "Follow people, filter by tag", "Upvotes surface what works"],
  },
  {
    id: "spaces",
    label: "B-Spaces",
    heading: "Small rooms. Higher signal.",
    body: "B-Spaces are niche communities for your craft. Ask the question you'd never post in public, and get answers from people doing the same work.",
    bullets: ["A space for every discipline", "Member-only posts when it matters", "Create a space for your niche"],
  },
  {
    id: "leads",
    label: "Leads",
    heading: "Work, without the bidding war.",
    body: "Clients and freelancers post projects, bounties, and retainers with budgets up front. Apply with your profile — never with paid credits.",
    bullets: ["Budgets shown on every lead", "Apply with your Borynx profile", "Track applications on one board"],
  },
  {
    id: "reputation",
    label: "Reputation",
    heading: "Proof of expertise, not claims of it.",
    body: "Helpful posts earn upvotes, reputation, and badges on your public profile — a link you can send the next time a client asks why you.",
    bullets: ["Milestones at 100 / 1,000 / 5,000 rep", "Badges live on your profile & posts", "Verified Pro for standout contributors"],
  },
];

function TabPanel({ tab, spaces, spacesLive }: { tab: TabId; spaces: CommunityData[]; spacesLive: boolean }) {
  if (tab === "feed") {
    return (
      <div>
        {PREVIEW_POSTS.map((post, i) => (
          <PostRow key={post.title} post={post} last={i === PREVIEW_POSTS.length - 1} />
        ))}
      </div>
    );
  }
  if (tab === "spaces") {
    return (
      <div className="grid sm:grid-cols-2">
        {spaces.map((space, i) => {
          const Icon = SPACE_ICONS[space.slug] ?? Users;
          return (
            <div
              key={space.slug}
              className={`flex gap-3 px-4 py-4 sm:px-5 ${i % 2 === 0 ? "sm:border-r" : ""} ${i < spaces.length - (spaces.length % 2 === 0 ? 2 : 1) ? "border-b" : ""} border-border/60`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="font-body text-sm font-semibold text-foreground">
                  {space.name} <span className="ml-1 font-mono text-[11px] font-normal text-muted-foreground">b/{space.slug}</span>
                </p>
                <p className="mt-0.5 line-clamp-2 font-body text-[13px] leading-relaxed text-muted-foreground">{space.description}</p>
                {spacesLive && space.memberCount > 0 && (
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{space.memberCount.toLocaleString()} members</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  if (tab === "leads") {
    return (
      <div>
        {EXAMPLE_LEADS.map((lead, i) => (
          <LeadRow key={lead.title} lead={lead} last={i === EXAMPLE_LEADS.length - 1} />
        ))}
        <p className="border-t border-border/60 px-4 py-3 font-body text-xs text-muted-foreground sm:px-5">
          Example leads. Full details are visible to members.
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-display text-sm font-semibold text-foreground">M</span>
        <div>
          <p className="flex items-center gap-1.5 font-body text-sm font-semibold text-foreground">
            Maya R. <BadgeCheck size={14} className="text-brand" />
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">f/Maya · React Native & fintech dashboards</p>
        </div>
        <span className="ml-auto text-right">
          <span className="block font-mono text-sm font-semibold text-foreground">640</span>
          <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">reputation</span>
        </span>
      </div>
      {MILESTONES.map((m, i) => (
        <div key={m.name} className={`flex items-center gap-3 px-4 py-3.5 sm:px-5 ${i < MILESTONES.length - 1 ? "border-b border-border/60" : ""}`}>
          {i === 0 ? (
            <Check className="h-4 w-4 shrink-0 text-success" aria-label="Unlocked" />
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-full border border-border" aria-hidden="true" />
          )}
          <p className="font-body text-sm font-medium text-foreground">{m.name}</p>
          <p className="hidden font-body text-[13px] text-muted-foreground sm:block">{m.note}</p>
          <p className="ml-auto font-mono text-xs text-muted-foreground">{m.rep} rep</p>
        </div>
      ))}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
const Landing = () => {
  const reduceMotion = useReducedMotion();
  const [spaces, setSpaces] = useState<CommunityData[]>(FALLBACK_SPACES);
  const [spacesLive, setSpacesLive] = useState(false);
  const [tab, setTab] = useState<TabId>("feed");
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  useEffect(() => {
    let cancelled = false;
    fetchAllCommunities()
      .then((live) => {
        if (!cancelled && live.length > 0) {
          setSpaces(live);
          setSpacesLive(true);
        }
      })
      .catch(() => {
        /* fallback stays */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rise = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
  });

  return (
    <div className="landing-theme min-h-screen w-full bg-background font-body text-foreground antialiased">
      {/* ── Nav ──────────────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <img src="/logo-transparent.png" alt="" className="h-7 w-7 rounded-md object-cover" />
            <span className="font-display text-[17px] font-600 font-semibold tracking-tight">Borynx</span>
          </a>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#product" className="transition-colors hover:text-foreground">Product</a>
            <a href="#spaces" className="transition-colors hover:text-foreground">B-Spaces</a>
            <a href="#leads" className="transition-colors hover:text-foreground">Leads</a>
            <a href="#faq" className="transition-colors hover:text-foreground">FAQ</a>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              Log in
            </Link>
            <Link to="/signup" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Join free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header id="top" className="px-6 pb-20 pt-36 sm:pt-40">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <motion.p {...rise(0)} className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              For designers · developers · writers · marketers
            </motion.p>
            <motion.h1
              {...rise(0.08)}
              className="mt-5 font-display text-[42px] font-semibold leading-[1.04] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-[68px]"
            >
              Where freelancers talk business — and find their next client.
            </motion.h1>
            <motion.p {...rise(0.16)} className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Swap pricing and client playbooks in niche B-Spaces, build reputation that
              proves your expertise, and apply to real leads. No race-to-the-bottom bidding.
            </motion.p>

            <motion.div {...rise(0.24)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
              >
                <GoogleMark /> Continue with Google
              </Link>
              <Link
                to="/signup"
                className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border px-6 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted sm:w-auto"
              >
                Join with email
              </Link>
            </motion.div>
            <motion.p {...rise(0.3)} className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/80">
              Free to join · No bidding credits, ever
            </motion.p>
          </div>

          <motion.div {...rise(0.35)} className="mx-auto mt-16 max-w-5xl">
            <AppPreview spaces={spaces} />
          </motion.div>

          <motion.p
            {...rise(0.4)}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center font-mono text-xs text-muted-foreground"
          >
            <span className="text-muted-foreground/70">{spaces.length} B-Spaces:</span>
            {spaces.map((s, i) => (
              <span key={s.slug}>
                <a href="#spaces" className="transition-colors hover:text-brand">b/{s.slug}</a>
                {i < spaces.length - 1 && <span className="ml-3 text-muted-foreground/40">/</span>}
              </span>
            ))}
          </motion.p>
        </div>
      </header>

      {/* ── Three pillars, as text — not icon cards ──────────────────── */}
      <section className="border-y border-border/60 px-6">
        <div className="mx-auto grid max-w-6xl sm:grid-cols-3">
          {[
            { title: "Discuss", body: "Ask what you can't ask in public. Get answers from people doing the same work." },
            { title: "Belong", body: "Join a B-Space for your craft — or start one. Small rooms, higher signal." },
            { title: "Earn", body: "Apply to leads with the profile and reputation you've already built." },
          ].map((pillar, i) => (
            <div key={pillar.title} className={`py-10 sm:px-8 ${i === 0 ? "sm:pl-0" : ""} ${i > 0 ? "border-t border-border/60 sm:border-l sm:border-t-0" : ""}`}>
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                <span className="mr-2.5 font-mono text-xs font-normal text-brand">0{i + 1}</span>
                {pillar.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Product showcase (tabs) ──────────────────────────────────── */}
      <section id="product" className="scroll-mt-24 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">The product</p>
          <h2 className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-[-0.02em] text-foreground sm:text-[40px] sm:leading-[1.1]">
            Everything a freelancer needs. In one place.
          </h2>

          <div className="mt-10 flex gap-7 overflow-x-auto border-b border-border" role="tablist" aria-label="Product areas">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`-mb-px whitespace-nowrap border-b-2 pb-3 font-body text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "border-brand text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[320px_1fr]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`copy-${tab}`}
                initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                transition={{ duration: 0.25 }}
              >
                <h3 className="font-display text-[22px] font-semibold leading-snug tracking-tight text-foreground">{activeTab.heading}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{activeTab.body}</p>
                <ul className="mt-5 space-y-2.5">
                  {activeTab.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2.5 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {bullet}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                  Join Borynx free <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={`panel-${tab}`}
                role="tabpanel"
                initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <TabPanel tab={tab} spaces={spaces} spacesLive={spacesLive} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* plain-language band under the showcase */}
          <div id="leads" className="mt-16 grid scroll-mt-24 gap-8 border-t border-border/60 pt-10 sm:grid-cols-3">
            {[
              { k: "0 credits", v: "to apply to any lead. Budgets are shown up front, always." },
              { k: "100 → 5,000", v: "reputation range, from Rising Voice to Veteran Freelancer." },
              { k: `${spaces.length} spaces`, v: "live in the directory — design, dev, writing, marketing, video, consulting." },
            ].map((stat) => (
              <div key={stat.k}>
                <p className="font-display text-2xl font-semibold tracking-tight text-foreground">{stat.k}</p>
                <p className="mt-1.5 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">{stat.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── B-Spaces directory ───────────────────────────────────────── */}
      <section id="spaces" className="scroll-mt-24 border-t border-border/60 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Communities</p>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.02em] text-foreground">Find your B-Space.</h2>
            </div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${spacesLive ? "bg-success" : "bg-warning"}`} aria-hidden="true" />
              {spacesLive ? "Live directory" : "Starter spaces"}
            </p>
          </div>

          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => {
              const Icon = SPACE_ICONS[space.slug] ?? Users;
              return (
                <Link
                  key={space.slug}
                  to="/signup"
                  className="group bg-card p-6 transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="mt-4 font-display text-[17px] font-semibold tracking-tight text-foreground">
                    {space.name}
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">b/{space.slug}</span>
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{space.description}</p>
                  <p className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {spacesLive && space.memberCount > 0
                        ? `${space.memberCount.toLocaleString()} members`
                        : space.topics.slice(0, 3).map((t) => `#${t}`).join("  ")}
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-brand" />
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-24 border-t border-border/60 px-6 py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[320px_1fr]">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">FAQ</p>
            <h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.02em] text-foreground">Questions, answered.</h2>
          </div>
          <Accordion type="single" collapsible>
            {[
              {
                q: "Is Borynx free?",
                a: "Yes — joining, posting, joining B-Spaces, and browsing leads is free. Create an account with email or Google and you're in.",
              },
              {
                q: "Who can join? I'm just starting out.",
                a: "Any freelancer — designers, developers, writers, marketers, video editors, consultants, and more. B-Spaces are exactly where beginners ask the questions that get them to the next level.",
              },
              {
                q: "How do leads work?",
                a: "Anyone with an account can post a lead — a project, bounty, or retainer — with the budget shown up front. Freelancers apply with their Borynx profile, and there are no credits or fees to apply.",
              },
              {
                q: "Can I hire through Borynx?",
                a: "Yes. Post a lead describing the project, budget, and skills you need, and freelancers with public profiles and reputation history can apply.",
              },
              {
                q: "What is reputation, and what is Verified Pro?",
                a: "Upvotes on your posts and comments earn reputation. Milestones unlock badges — Rising Voice at 100, Trusted Voice at 1,000, Veteran Freelancer at 5,000. Verified Pro marks vetted, high-quality contributors on their profile and posts.",
              },
              {
                q: "Can I create a community for my niche?",
                a: "Yes — members can create new B-Spaces. If your craft or city doesn't have a space yet, start it and invite others in.",
              },
            ].map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="py-5 text-left font-body text-[15px] font-semibold text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="border-t border-border/60 px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] text-foreground sm:text-5xl">
            Your next client is one post away.
          </h2>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted-foreground">
            Join the freelancers building their businesses in the open on Borynx.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/signup"
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-primary px-6 text-[15px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
            >
              <GoogleMark /> Continue with Google
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-12 w-full items-center justify-center gap-1.5 rounded-lg border border-border px-6 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              Join Borynx free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground/80">
            Free to join · No bidding credits
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border/60 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-8 sm:flex-row sm:items-start">
          <div>
            <a href="#top" className="flex items-center gap-2.5">
              <img src="/logo-transparent.png" alt="" className="h-7 w-7 rounded-md object-cover" />
              <span className="font-display text-[17px] font-semibold tracking-tight">Borynx</span>
            </a>
            <p className="mt-3 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
              Where freelancers talk business — and find their next client.
            </p>
          </div>
          <nav className="flex gap-16 text-sm" aria-label="Footer">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Product</p>
              <ul className="mt-3.5 space-y-2.5 text-muted-foreground">
                <li><a href="#product" className="transition-colors hover:text-foreground">Overview</a></li>
                <li><a href="#spaces" className="transition-colors hover:text-foreground">B-Spaces</a></li>
                <li><a href="#leads" className="transition-colors hover:text-foreground">Leads</a></li>
                <li><a href="#faq" className="transition-colors hover:text-foreground">FAQ</a></li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/70">Account</p>
              <ul className="mt-3.5 space-y-2.5 text-muted-foreground">
                <li><Link to="/signup" className="transition-colors hover:text-foreground">Join free</Link></li>
                <li><Link to="/login" className="transition-colors hover:text-foreground">Log in</Link></li>
                <li><Link to="/privacy" className="transition-colors hover:text-foreground">Privacy</Link></li>
                <li><Link to="/terms" className="transition-colors hover:text-foreground">Terms</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mx-auto mt-10 flex max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
          <p className="text-[13px] text-muted-foreground">© {new Date().getFullYear()} Borynx. All rights reserved.</p>
          <p className="font-mono text-[11px] text-muted-foreground/70">Built for freelancers, by freelancers.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
