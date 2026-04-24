import { Link } from "react-router-dom";
import { ArrowRight, Flame, Hash, Users, Zap, TrendingUp, DollarSign, Layout } from "lucide-react";

const Landing = () => {
  return (
    <div className="landing-theme min-h-screen bg-background text-foreground font-body">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-background/80 backdrop-blur-md border-b border-border/50">
        <Link to="/" className="flex items-center gap-2 group">
          {/* Logo */}
          <div className="flex h-8 w-8 items-center justify-center rounded overflow-hidden">
            <img src="/logo-transparent.png" alt="Soloboard" className="h-full w-full object-cover transform scale-[1.3] transition-transform group-hover:scale-[1.4]" />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight text-foreground">Soloboard</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 font-medium text-sm">
          <Link to="/" className="text-foreground transition-colors hover:opacity-70">Feed</Link>
          <Link to="/communities" className="text-muted-foreground hover:text-foreground transition-colors">Communities</Link>
          <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-4 font-medium text-sm">
          <Link to="/login" className="text-foreground hover:opacity-70 transition-opacity">Log In</Link>
          <Link to="/signup" className="bg-primary text-primary-foreground px-5 py-2.5 rounded-full hover:bg-primary/90 transition-all shadow-sm hidden sm:block">Join Now</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-8 px-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-primary/5 blur-3xl rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-5">
          <h1 className="font-heading text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-foreground mt-4">
            The Home for <br className="hidden md:block"/> Serious Freelancers.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-light">
            A high-signal community to share insights, track trends, and grow your solo business. No race-to-the-bottom bidding, just elite peers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/signup" className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              Join the Community <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Live Feed Preview */}
      <section className="px-6 pb-24 relative">
        <div className="max-w-[800px] mx-auto relative">
          
          {/* Sticky Badge */}
          <div className="sticky top-24 z-40 flex justify-center mb-8 pointer-events-none">
            <div className="inline-flex items-center gap-2 border border-border/50 bg-background/80 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider text-muted-foreground shadow-sm pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-[#D1FF4A]"></span> Invite-Only Access Open
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {/* Mock Post 1 */}
            <div className="bg-white p-5 rounded-xl border border-black/5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded flex-shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold">M</div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-lg">I tripled my freelance rate in 6 months — here's exactly how</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">Last year I was charging $40/hr for React development. After repositioning myself as a specialist in fintech dashboards, I'm now at $120/hr. The key was changing how I pitched to clients...</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-secondary/50 px-2 py-1 rounded text-secondary-foreground font-medium">pricing</span>
                    <span className="text-xs bg-secondary/50 px-2 py-1 rounded text-secondary-foreground font-medium">growth</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Post 2 */}
            <div className="bg-white p-5 rounded-xl border border-black/5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded flex-shrink-0 bg-[#D1FF4A]/30 flex items-center justify-center text-[#1A1A1A] font-bold">S</div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-lg">How do you handle clients who ghost after the discovery call?</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">Had 4 discovery calls this month. All went great, everyone seemed excited. Then... silence. Is this normal? What's your follow-up cadence for high-ticket clients?</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-secondary/50 px-2 py-1 rounded text-secondary-foreground font-medium">clients</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mock Post 3 */}
            <div className="bg-white p-5 rounded-xl border border-black/5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all hover:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)]">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded flex-shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold">A</div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-lg">The 3 tools that actually save me time (not just look pretty)</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">I've tried every project management tool out there. Here's my minimalist stack that actually keeps me organized without creating more work for me or my clients.</p>
                  <div className="flex gap-2 mt-3">
                    <span className="text-xs bg-secondary/50 px-2 py-1 rounded text-secondary-foreground font-medium">tools</span>
                    <span className="text-xs bg-secondary/50 px-2 py-1 rounded text-secondary-foreground font-medium">productivity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conversion Wall (Fade-to-Join) */}
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background via-background/80 to-transparent flex items-end justify-center pb-8 z-20">
            <Link to="/signup" className="bg-foreground text-background px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-foreground/90 transition-all shadow-xl hover:scale-105 active:scale-95">
              Sign up to unlock the full Board <Zap className="w-4 h-4 text-[#D1FF4A]" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-[#FAFAFA] border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Flame className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground">Hot Feed</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">Curated discussions that matter to your bottom line. Skip the fluff and dive straight into actionable freelance strategies.</p>
            </div>
            
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-[#D1FF4A]/30 flex items-center justify-center text-[#1A1A1A]">
                <Hash className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground">Trending Tags</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">Real-time insights into #pricing, #clients, and #tools. See what the top earners are discussing right now.</p>
            </div>
            
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center text-foreground border border-black/5">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-lg font-bold text-foreground">Top Contributors</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">Learn directly from the community's elite earners. See who's sharing the best resources and follow their playbook.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-[#1E1B4B]">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-white">
            Join the top 1% of solo professionals.
          </h2>
          <div className="flex justify-center">
            <Link to="/signup" className="bg-[#D1FF4A] text-[#1A1A1A] px-8 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#D1FF4A]/90 transition-all shadow-lg hover:scale-105 active:scale-95">
              Get Early Access <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Technical Footer */}
      <footer className="bg-white border-t border-border/50 pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between gap-12 mb-16">
            {/* Column 1 (Identity) */}
            <div className="space-y-4 md:w-1/3">
              <Link to="/" className="flex items-center gap-2 group inline-flex">
                <div className="flex h-8 w-8 items-center justify-center rounded overflow-hidden">
                  <img src="/logo-transparent.png" alt="Soloboard" className="h-full w-full object-cover transform scale-[1.3] transition-transform group-hover:scale-[1.4]" />
                </div>
                <span className="font-heading font-bold text-xl tracking-tight text-foreground">Soloboard</span>
              </Link>
              <p className="text-muted-foreground text-sm font-medium">Built for freelancers, by freelancers.</p>
            </div>

            {/* Column 2 (Navigation & Status) */}
            <div className="space-y-4 md:w-1/3 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-foreground mb-6">Product</h4>
                <ul className="space-y-3">
                  <li><Link to="/" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Feed</Link></li>
                  <li><Link to="/communities" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Communities</Link></li>
                  <li><Link to="/pricing" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Pricing</Link></li>
                </ul>
              </div>
              
              <div className="pt-8">
                <Link to="/status" className="inline-flex items-center gap-2 group">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D1FF4A] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D1FF4A]"></span>
                  </span>
                  <span className="text-[12px] text-muted-foreground group-hover:text-foreground transition-colors">All systems operational</span>
                </Link>
              </div>
            </div>

            {/* Column 3 (Technical/Social) */}
            <div className="space-y-4 md:w-1/3">
              <h4 className="font-bold text-foreground mb-6">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Twitter</a></li>
                <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-muted-foreground hover:text-foreground text-sm transition-colors">Terms</Link></li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="pt-8 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">© 2026 Soloboard. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
