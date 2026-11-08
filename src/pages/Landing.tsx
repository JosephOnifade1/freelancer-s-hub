import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowBigDown,
  ArrowBigUp,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Check,
  Code2,
  Flame,
  Lock,
  Megaphone,
  MessageSquare,
  Palette,
  PenTool,
  ShieldCheck,
  Star,
  Trophy,
  Users,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { fetchAllCommunities, type CommunityData } from "@/lib/communities";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ─── Fallback B-Spaces ──────────────────────────────────────────────────────
   Mirrors the seed data in supabase_schema.sql / mockSupabase.ts. Used only
   until the live fetch resolves (communities have a public-read RLS policy),
   or if Supabase is unreachable — the page never renders empty.
   Member counts are intentionally omitted here: they are only shown when
   they come back from the live query, never hardcoded. */
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

/* ─── Illustrative preview content ───────────────────────────────────────────
   Product-preview mock, in the shape of the real PostCard / LeadCard UI.
   Discussion topics mirror the kind of posts Borynx is built for. */
const PREVIEW_POSTS = [
  {
    space: "dev",
    author: "Maya",
    title: "I tripled my freelance rate in 6 months — here's exactly how",
    excerpt:
      "I stopped pitching hours and started pitching outcomes. The repositioning — not new tech — is what moved me from $40/hr to $120/hr…",
    score: 128,
    comments: 42,
    tags: ["pricing", "growth"],
    verified: true,
  },
  {
    space: "consulting",
    author: "Sam",
    title: "How do you handle clients who ghost after the discovery call?",
    excerpt:
      "Four great calls this month, then silence. What's your follow-up cadence for high-ticket clients?",
    score: 86,
    comments: 37,
    tags: ["clients"],
    verified: false,
  },
];

const EXAMPLE_LEADS = [
  {
    title: "React Native Developer for Fitness App",
    budget: "$5,000 – $8,000",
    meta: "Remote · Project · 3 months",
    skills: ["React Native", "TypeScript"],
  },
  {
    title: "UI/UX Designer for Web3 Landing Page",
    budget: "$2,000",
    meta: "Remote · Bounty · Fast turnaround",
    skills: ["Figma", "UI Design"],
  },
];

const JOIN_CTA = "Join Borynx free";

function JoinButton({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/signup"
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-brand px-7 py-3.5 font-heading text-sm font-bold text-brand-foreground shadow-lg shadow-brand/25 transition-all hover:bg-brand/90 hover:shadow-brand/40 active:scale-95 ${className}`}
    >
      {JOIN_CTA} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

/* Presentational stand-in for PostCard: same vote-pill / b-space / tag layout,
   but non-interactive so anonymous visitors don't hit login toasts. */
function PreviewPost({ post }: { post: (typeof PREVIEW_POSTS)[number] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-muted-foreground/40">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-heading text-[9px] font-bold text-foreground">
            {post.space.charAt(0).toUpperCase()}
          </span>
          <span className="font-body text-xs font-bold text-foreground">b/{post.space}</span>
        </span>
        <span className="text-[11px] text-muted-foreground">·</span>
        <span className="flex items-center gap-1 font-body text-[11px] text-muted-foreground">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand/20 font-heading text-[9px] font-bold text-brand">
            {post.author.charAt(0)}
          </span>
          f/{post.author}
          {post.verified && <BadgeCheck size={12} className="text-brand" aria-label="Verified Pro" />}
        </span>
      </div>

      <h3 className="font-heading text-[15px] font-semibold leading-snug text-foreground">{post.title}</h3>
      <p className="mt-1 line-clamp-2 font-body text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {post.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-muted px-2.5 py-0.5 font-body text-[11px] font-medium text-muted-foreground">
            #{tag}
          </span>
        ))}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <span className="flex items-center gap-0.5 rounded-full border border-border bg-muted/40 px-1 py-0.5" aria-hidden="true">
          <span className="p-1 text-muted-foreground"><ArrowBigUp className="h-4 w-4" /></span>
          <span className="px-1 font-heading text-xs font-bold text-foreground">{post.score}</span>
          <span className="p-1 text-muted-foreground"><ArrowBigDown className="h-4 w-4" /></span>
        </span>
        <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-body text-xs font-medium text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> {post.comments}
        </span>
      </div>
    </div>
  );
}

function LeadPreviewCard({ lead, locked = false }: { lead?: (typeof EXAMPLE_LEADS)[number]; locked?: boolean }) {
  if (locked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4" aria-hidden="true">
        <div className="space-y-2 blur-[6px]">
          <div className="h-4 w-3/4 rounded bg-muted" />
          <div className="h-3 w-1/2 rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center gap-2 font-body text-xs font-semibold text-foreground">
          <Lock className="h-4 w-4 text-brand" /> Members-only lead
        </div>
      </div>
    );
  }
  if (!lead) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-brand/50">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-[15px] font-semibold leading-snug text-foreground">{lead.title}</h3>
        <span className="shrink-0 rounded-full bg-success/15 px-2.5 py-1 font-heading text-xs font-bold text-success">{lead.budget}</span>
      </div>
      <p className="mt-1 font-body text-xs text-muted-foreground">{lead.meta}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lead.skills.map((skill) => (
          <span key={skill} className="rounded-full bg-muted px-2.5 py-0.5 font-body text-[11px] font-medium text-muted-foreground">
            {skill}
          </span>
        ))}
        <Link to="/signup" className="ml-auto font-heading text-xs font-bold text-brand hover:underline">
          Apply →
        </Link>
      </div>
    </div>
  );
}

const Landing = () => {
  const [spaces, setSpaces] = useState<CommunityData[]>(FALLBACK_SPACES);
  const [spacesLive, setSpacesLive] = useState(false);

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
        /* offline / mock fallback stays in place */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="landing-theme min-h-screen w-full bg-background font-body text-foreground">
      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="group flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded">
              <img src="/logo-transparent.png" alt="Borynx" className="h-full w-full scale-[1.3] object-cover transition-transform group-hover:scale-[1.4]" />
            </span>
            <span className="font-heading text-xl font-bold tracking-tight text-foreground">Borynx</span>
          </a>

          <div className="hidden items-center gap-8 font-body text-sm font-medium md:flex">
            <a href="#spaces" className="text-muted-foreground transition-colors hover:text-foreground">B-Spaces</a>
            <a href="#leads" className="text-muted-foreground transition-colors hover:text-foreground">Leads</a>
            <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a>
            <a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</a>
          </div>

          <div className="flex items-center gap-4 font-body text-sm font-medium">
            <Link to="/login" className="text-foreground transition-opacity hover:opacity-70">Log in</Link>
            <Link
              to="/signup"
              className="hidden rounded-full bg-brand px-5 py-2.5 font-heading font-bold text-brand-foreground shadow-md shadow-brand/25 transition-all hover:bg-brand/90 sm:block"
            >
              {JOIN_CTA}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header id="top" className="relative overflow-hidden px-6 pb-16 pt-32 md:pt-36">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] max-w-none -translate-x-1/2 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div className="animate-fade-in text-center lg:text-left">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3.5 py-1.5 font-body text-xs font-semibold text-brand">
              <Users className="h-3.5 w-3.5" />
              For designers, developers, writers, marketers &amp; consultants
            </p>
            <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Where freelancers talk business —{" "}
              <span className="text-brand">and find their next client.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0">
              Borynx is a high-signal community for freelancers. Swap pricing and client
              playbooks in niche B-Spaces, build a reputation that proves your expertise,
              and apply to real project leads — no race-to-the-bottom bidding.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
              <JoinButton className="w-full sm:w-auto" />
              <a
                href="#how-it-works"
                className="inline-flex w-full items-center justify-center rounded-full border border-border px-7 py-3.5 font-heading text-sm font-bold text-foreground transition-colors hover:bg-muted sm:w-auto"
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-body text-xs text-muted-foreground lg:justify-start">
              <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> Free to join</span>
              <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> Sign up with Google</span>
              <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success" /> No bidding credits, ever</span>
            </p>
          </div>

          {/* Product preview: feed + overlapping lead card */}
          <div className="relative animate-fade-in">
            <div className="rounded-3xl border border-border bg-background/60 p-3 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="mb-3 flex items-center gap-2 px-1 pt-1">
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-body text-xs font-semibold text-foreground">
                  <Flame className="h-3.5 w-3.5 text-warning" /> Hot
                </span>
                <span className="rounded-full px-3 py-1.5 font-body text-xs font-medium text-muted-foreground">Best</span>
                <span className="rounded-full px-3 py-1.5 font-body text-xs font-medium text-muted-foreground">New</span>
                <span className="ml-auto font-body text-[11px] text-muted-foreground">Preview</span>
              </div>
              <div className="space-y-3">
                {PREVIEW_POSTS.map((post) => (
                  <PreviewPost key={post.title} post={post} />
                ))}
              </div>
            </div>

            <div className="relative z-10 mx-3 -mt-4 sm:mx-6">
              <LeadPreviewCard lead={EXAMPLE_LEADS[0]} />
            </div>

            <div className="absolute -right-2 -top-4 hidden items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 shadow-xl sm:flex">
              <BadgeCheck className="h-4 w-4 text-brand" />
              <span className="font-body text-xs font-semibold text-foreground">
                Verified Pro <span className="font-normal text-muted-foreground">· reputation you can show clients</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── B-Spaces strip ─────────────────────────────────────────────── */}
      <section className="border-y border-border/50 bg-muted/20 px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="font-heading text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {spaces.length} niche B-Spaces
          </span>
          {spaces.map((space) => (
            <a key={space.slug} href="#spaces" className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-brand">
              b/{space.slug}
            </a>
          ))}
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Freelancing is solo. Growing doesn&rsquo;t have to be.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Right now your business advice is scattered across four apps — and none of
              them were built for people who sell their skills.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { where: "Reddit", pain: "Great threads, buried under noise — and nothing to do with your craft half the time." },
              { where: "X / Twitter", pain: "Hot takes in public, real numbers kept private. Hard to ask an honest pricing question." },
              { where: "Discord", pain: "Good people, disappearing conversations. Nothing is searchable a week later." },
              { where: "Upwork & marketplaces", pain: "Pay for credits, race to the bottom on price, and the client owns the relationship." },
            ].map((item) => (
              <div key={item.where} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-heading text-sm font-bold text-foreground">{item.where}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.pain}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center font-heading text-lg font-semibold text-foreground">
            Borynx puts the discussion, the community, and the work{" "}
            <span className="text-brand">in one place — built only for freelancers.</span>
          </p>
        </div>
      </section>

      {/* ── How it works: three pillars ────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-24 border-t border-border/50 bg-muted/20 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">Talk business. Find your people. Get hired.</h2>
            <p className="mt-4 text-muted-foreground">Three things, one account.</p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">1 · Discuss</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ask the questions you can&rsquo;t ask in public — pricing, ghosting clients,
                scope creep, taxes — and get answers from people doing the same work.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {["Hot, Best & New feeds", "Polls, resources & rich posts", "Follow freelancers you learn from"].map((li) => (
                  <li key={li} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{li}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">2 · Belong</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Join B-Spaces for your craft — or start your own. Smaller rooms, higher
                signal, people who actually understand your day.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {["Spaces for design, dev, writing & more", "Create a space for your niche", "Member-only posts when you need privacy"].map((li) => (
                  <li key={li} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{li}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-brand/40 bg-card p-6 shadow-lg shadow-brand/5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-foreground">
                <Briefcase className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-bold text-foreground">3 · Earn</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Browse the Leads Board and apply with the profile and reputation you&rsquo;ve
                already built. Clients can post leads too — no credits, no bidding war.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {["Project, bounty & retainer leads", "Apply with your Borynx profile", "Track everything on one board"].map((li) => (
                  <li key={li} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />{li}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── B-Spaces (live from Supabase) ──────────────────────────────── */}
      <section id="spaces" className="scroll-mt-24 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">Find your B-Space</h2>
              <p className="mt-3 text-muted-foreground">
                Niche communities for every craft. Join the ones that match your work —
                your feed gets better with every space you add.
              </p>
            </div>
            <span className="flex items-center gap-2 font-body text-xs text-muted-foreground">
              <span className={`h-2 w-2 rounded-full ${spacesLive ? "bg-success" : "bg-warning"}`} />
              {spacesLive ? "Live from the community directory" : "Showing starter spaces"}
            </span>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {spaces.map((space) => {
              const Icon = SPACE_ICONS[space.slug] ?? Users;
              return (
                <div key={space.slug} className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand/50">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-heading text-base font-bold leading-tight text-foreground">{space.name}</h3>
                      <p className="font-body text-xs text-muted-foreground">b/{space.slug}</p>
                    </div>
                    {spacesLive && space.memberCount > 0 && (
                      <span className="ml-auto font-body text-xs tabular-nums text-muted-foreground">
                        {space.memberCount.toLocaleString()} {space.memberCount === 1 ? "member" : "members"}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{space.description}</p>
                  {space.topics?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {space.topics.slice(0, 3).map((topic) => (
                        <span key={topic} className="rounded-full bg-muted px-2 py-0.5 font-body text-[11px] font-medium text-muted-foreground">
                          #{topic}
                        </span>
                      ))}
                    </div>
                  )}
                  <Link to="/signup" className="mt-4 font-heading text-sm font-bold text-brand hover:underline">
                    Join b/{space.slug} →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Leads spotlight ────────────────────────────────────────────── */}
      <section id="leads" className="scroll-mt-24 border-t border-border/50 bg-card px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-widest text-brand">Leads Board</p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Work that comes to you — without the bidding war.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Clients and fellow freelancers post projects, bounties, and retainers on the
              Leads Board. You apply with your Borynx profile — your posts, badges, and
              reputation do the pitching.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              {[
                "No credits or connect fees to apply",
                "Budgets shown up front on every lead",
                "Post your own lead when you need a hand",
                "Kanban and list views to track applications",
              ].map((li) => (
                <li key={li} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {li}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <JoinButton />
            </div>
          </div>

          <div className="space-y-3">
            <p className="font-body text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Example leads</p>
            {EXAMPLE_LEADS.map((lead) => (
              <LeadPreviewCard key={lead.title} lead={lead} />
            ))}
            <LeadPreviewCard locked />
            <p className="text-center font-body text-xs text-muted-foreground">
              Full lead details are visible to members.{" "}
              <Link to="/signup" className="font-semibold text-brand hover:underline">Join free to browse →</Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── Reputation ─────────────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="flex items-center justify-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-brand">
              <ShieldCheck className="h-4 w-4" /> Reputation
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
              Your expertise, visible — not just claimed.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Anyone can write &ldquo;expert&rdquo; in a bio. On Borynx, helpful posts and
              answers earn upvotes, reputation, and badges that sit on your public profile —
              ready to link the next time a client asks why they should hire you.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-3xl">
            <div className="relative">
              <div className="absolute left-0 right-0 top-5 hidden h-px bg-border md:block" aria-hidden="true" />
              <div className="relative grid gap-8 md:grid-cols-3">
                {[
                  { icon: Zap, title: "Rising Voice", detail: "100 reputation — your answers start getting noticed." },
                  { icon: Star, title: "Trusted Voice", detail: "1,000 reputation — a profile clients can trust at a glance." },
                  { icon: Trophy, title: "Veteran Freelancer", detail: "5,000 reputation — the top tier of community standing." },
                ].map((step) => (
                  <div key={step.title} className="text-center">
                    <span className="relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-brand/40 bg-background text-brand">
                      <step.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-3 font-heading text-sm font-bold text-foreground">{step.title}</h3>
                    <p className="mx-auto mt-1 max-w-[16rem] text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-10 flex items-center justify-center gap-2 text-center font-body text-sm text-muted-foreground">
              <BadgeCheck className="h-4 w-4 shrink-0 text-brand" />
              Standout contributors also carry the <span className="font-semibold text-foreground">Verified Pro</span> badge on their profile and posts.
            </p>
          </div>
        </div>
      </section>

      {/* ── Comparison ─────────────────────────────────────────────────── */}
      <section className="border-t border-border/50 bg-muted/20 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Why not just use what you already have?
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[560px] text-left font-body text-sm">
              <thead>
                <tr className="border-b border-border text-foreground">
                  <th className="px-5 py-4 font-heading font-bold"> </th>
                  <th className="px-5 py-4 font-heading font-bold text-brand">Borynx</th>
                  <th className="px-5 py-4 font-heading font-bold">Reddit</th>
                  <th className="px-5 py-4 font-heading font-bold">Upwork</th>
                  <th className="px-5 py-4 font-heading font-bold">Discord</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                {[
                  ["Freelancers only", true, false, true, false],
                  ["Niche spaces by craft", true, true, false, true],
                  ["Job leads built in", true, false, true, false],
                  ["No bidding credits", true, true, false, true],
                  ["Reputation on your profile", true, false, true, false],
                  ["Searchable, lasting discussions", true, true, false, false],
                ].map(([label, ...cells]) => (
                  <tr key={label as string} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3.5 font-medium text-foreground">{label}</td>
                    {(cells as boolean[]).map((cell, i) => (
                      <td key={i} className="px-5 py-3.5">
                        {cell ? (
                          <Check className="h-4 w-4 text-success" aria-label="Yes" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/50" aria-label="No" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="scroll-mt-24 px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Questions, answered
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            {[
              {
                q: "Is Borynx free?",
                a: "Yes — joining, posting, joining B-Spaces, and browsing leads is free. Create an account with email or Google and you're in.",
              },
              {
                q: "Who can join? I'm just starting out.",
                a: "Any freelancer — designers, developers, writers, marketers, video editors, consultants, and more. You don't need years of experience; B-Spaces are exactly where beginners ask the questions that get them to their next level.",
              },
              {
                q: "How do leads work?",
                a: "Anyone with an account can post a lead — a project, bounty, or retainer — with the budget shown up front. Freelancers apply with their Borynx profile, and you can track everything from the Leads Board. There are no credits or fees to apply.",
              },
              {
                q: "Can I post work if I'm hiring?",
                a: "Yes. Post a lead describing the project, budget, and skills you need, and freelancers with public profiles and reputation history can apply.",
              },
              {
                q: "What is reputation, and what is Verified Pro?",
                a: "When other members upvote your posts and comments, you earn reputation. Milestones unlock badges — Rising Voice at 100, Trusted Voice at 1,000, and Veteran Freelancer at 5,000. Verified Pro is a badge shown on the profiles and posts of vetted, high-quality contributors.",
              },
              {
                q: "Can I create a community for my niche?",
                a: "Yes — members can create new B-Spaces. If your craft or city doesn't have a space yet, you can start it and invite others in.",
              },
            ].map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left font-heading text-base font-semibold text-foreground">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border/50 bg-card px-6 py-24">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-[36rem] max-w-none -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-3xl" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-3xl space-y-7 text-center">
          <h2 className="font-heading text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Your next client, peer, or playbook is one post away.
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Join the freelancers building their businesses in the open on Borynx.
          </p>
          <div className="flex justify-center">
            <JoinButton />
          </div>
          <p className="font-body text-xs text-muted-foreground">Free to join · No bidding credits · Unsubscribe from boredom anytime</p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-card pb-8 pt-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 flex flex-col justify-between gap-10 md:flex-row">
            <div className="space-y-4 md:w-1/3">
              <a href="#top" className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded">
                  <img src="/logo-transparent.png" alt="Borynx" className="h-full w-full scale-[1.3] object-cover" />
                </span>
                <span className="font-heading text-xl font-bold tracking-tight text-foreground">Borynx</span>
              </a>
              <p className="text-sm text-muted-foreground">
                Where freelancers talk business — and find their next client.
              </p>
              <p className="text-sm font-medium text-muted-foreground">Built for freelancers, by freelancers.</p>
            </div>

            <nav className="md:w-1/3" aria-label="Product">
              <h3 className="mb-5 font-heading font-bold text-foreground">Product</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#spaces" className="text-muted-foreground transition-colors hover:text-foreground">B-Spaces</a></li>
                <li><a href="#leads" className="text-muted-foreground transition-colors hover:text-foreground">Leads Board</a></li>
                <li><a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How it works</a></li>
                <li><a href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</a></li>
              </ul>
            </nav>

            <nav className="md:w-1/3" aria-label="Account and legal">
              <h3 className="mb-5 font-heading font-bold text-foreground">Get started</h3>
              <ul className="space-y-3 text-sm">
                <li><Link to="/signup" className="text-muted-foreground transition-colors hover:text-foreground">{JOIN_CTA}</Link></li>
                <li><Link to="/login" className="text-muted-foreground transition-colors hover:text-foreground">Log in</Link></li>
                <li><Link to="/privacy" className="text-muted-foreground transition-colors hover:text-foreground">Privacy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground transition-colors hover:text-foreground">Terms</Link></li>
              </ul>
            </nav>
          </div>

          <div className="border-t border-border/50 pt-8 text-center">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Borynx. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
