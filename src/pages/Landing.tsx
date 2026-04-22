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
      <section className="pt-32 pb-16 px-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[400px] bg-primary/5 blur-3xl rounded-full pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 border border-border/50 bg-secondary/50 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-[#D1FF4A]"></span> Invite-Only Access Open
          </div>
          <h1 className="font-heading text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-foreground">
            The Home for <br className="hidden md:block"/> Serious Freelancers.
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto font-light">
            A high-signal community to share insights, track trends, and grow your solo business. No race-to-the-bottom bidding, just elite peers.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/signup" className="w-full sm:w-auto bg-primary text-primary-foreground px-8 py-4 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              Join the Community <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Glassmorphism Dashboard Mockup */}
      <section className="px-6 pb-32">
        <div className="max-w-5xl mx-auto">
          {/* Mockup Container */}
          <div className="relative rounded-2xl border border-black/5 bg-white/40 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden">
            {/* MacOS Window Controls */}
            <div className="h-12 bg-white/60 border-b border-black/5 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            
            {/* App Layout */}
            <div className="flex min-h-[500px]">
              {/* Sidebar Mockup */}
              <div className="w-64 border-r border-black/5 p-4 hidden md:block bg-white/30">
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground/60 uppercase mb-3">Feed</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 p-2.5 bg-white rounded-lg text-sm font-semibold shadow-sm border border-black/5 text-primary">
                        <Flame className="w-4 h-4"/> Hot Feed
                      </div>
                      <div className="flex items-center gap-3 p-2.5 text-muted-foreground text-sm font-medium hover:bg-white/50 rounded-lg">
                        <Users className="w-4 h-4"/> Following
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground/60 uppercase mb-3">Discover</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-3 p-2.5 text-muted-foreground text-sm font-medium hover:bg-white/50 rounded-lg">
                        <Hash className="w-4 h-4"/> Trending
                      </div>
                      <div className="flex items-center gap-3 p-2.5 text-muted-foreground text-sm font-medium hover:bg-white/50 rounded-lg">
                        <Layout className="w-4 h-4"/> Communities
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Feed Mockup */}
              <div className="flex-1 p-6 space-y-4 bg-white/10">
                {/* Mock Post 1 */}
                <div className="bg-white p-5 rounded-xl border border-black/5 shadow-sm">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded flex-shrink-0 bg-primary/10 flex items-center justify-center text-primary font-bold">M</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">I tripled my freelance rate in 6 months — here's exactly how</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">Last year I was charging $40/hr for React development. After repositioning myself as a specialist in fintech dashboards, I'm now at $120/hr...</p>
                      <div className="flex gap-2 mt-3">
                        <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">pricing</span>
                        <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">growth</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mock Post 2 */}
                <div className="bg-white p-5 rounded-xl border border-black/5 shadow-sm opacity-60 pointer-events-none">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded flex-shrink-0 bg-[#D1FF4A]/30 flex items-center justify-center text-[#1A1A1A] font-bold">S</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">How do you handle clients who ghost after the discovery call?</h3>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">Had 4 discovery calls this month. All went great, everyone seemed excited. Then... silence. Is this normal?</p>
                      <div className="flex gap-2 mt-3">
                        <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">clients</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar Mockup */}
              <div className="w-64 border-l border-black/5 p-6 hidden lg:block bg-white/30">
                <div className="bg-white rounded-xl border border-black/5 p-4 shadow-sm">
                  <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary"/> Trending Tags</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">#pricing</span>
                      <span className="text-xs text-muted-foreground">1.2k</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">#clients</span>
                      <span className="text-xs text-muted-foreground">850</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">#tools</span>
                      <span className="text-xs text-muted-foreground">420</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-card border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Flame className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-xl font-bold">Hot Feed</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">Curated discussions that matter to your bottom line. Skip the fluff and dive straight into actionable freelance strategies.</p>
            </div>
            
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-[#D1FF4A]/30 flex items-center justify-center text-[#1A1A1A]">
                <Hash className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-xl font-bold">Trending Tags</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">Real-time insights into #pricing, #clients, and #tools. See what the top earners are discussing right now.</p>
            </div>
            
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-foreground border border-black/5">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-xl font-bold">Top Contributors</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">Learn directly from the community's elite earners. See who's sharing the best resources and follow their playbook.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 bg-background text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-6 w-6 rounded flex items-center justify-center overflow-hidden">
            <img src="/logo-transparent.png" alt="Soloboard" className="h-full w-full object-cover transform scale-[1.3]" />
          </div>
          <span className="font-heading font-bold tracking-tight text-foreground">Soloboard</span>
        </div>
        <p className="text-sm text-muted-foreground">© 2026 Soloboard. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Landing;
