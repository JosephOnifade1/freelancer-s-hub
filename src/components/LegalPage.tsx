import { AppLink as Link } from "@/components/AppLink";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

interface LegalPageProps {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

/** Shared layout for the public legal pages (/privacy, /terms). */
export function LegalPage({ title, updated, intro, sections }: LegalPageProps) {
  return (
    <div className="landing-theme min-h-screen w-full bg-background font-body text-foreground">
      <nav className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo-transparent.png" alt="" className="h-7 w-7 rounded-md object-cover" />
            <span className="font-display text-[17px] font-semibold tracking-tight">Borynx</span>
          </Link>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Last updated: {updated}
        </p>
        <p className="mt-6 leading-relaxed text-muted-foreground">{intro}</p>

        {sections.map((section, i) => (
          <section key={section.heading} className="mt-10">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              <span className="mr-2.5 font-mono text-sm font-normal text-brand">
                {String(i + 1).padStart(2, "0")}
              </span>
              {section.heading}
            </h2>
            {section.paragraphs.map((para) => (
              <p key={para.slice(0, 40)} className="mt-3 leading-relaxed text-muted-foreground">
                {para}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 list-disc space-y-1.5 pl-6 text-muted-foreground">
                {section.bullets.map((b) => (
                  <li key={b.slice(0, 40)} className="leading-relaxed">{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <div className="mt-14 border-t border-border/60 pt-6">
          <p className="text-sm text-muted-foreground">
            Questions about this document? Reach the team through the platform, or
            see our <Link href="/terms" className="text-brand hover:underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link>.
          </p>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} Borynx. All rights reserved.
          </p>
        </div>
      </main>
    </div>
  );
}
