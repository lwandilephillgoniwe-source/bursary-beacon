import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, ShieldCheck, ExternalLink, Search, FileText } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative selection:bg-secondary/30">
      <div className="bg-noise" />
      
      {/* Navigation */}
      <nav className="border-b border-border/40 backdrop-blur-md bg-background/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
              <Search size={18} strokeWidth={3} />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-primary">Bursary Beacon</span>
          </div>
          <div className="hidden md:flex items-center gap-5 text-sm font-medium text-muted-foreground">
            <a href="/bursaries" className="hover:text-foreground transition-colors">Bursaries</a>
            <a href="/learnerships" className="hover:text-foreground transition-colors">Learnerships</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
          </div>
          <div className="md:hidden flex items-center gap-2 text-xs font-semibold">
            <a href="/bursaries" className="rounded-md bg-primary px-2.5 py-1.5 text-primary-foreground">Bursaries</a>
            <a href="/learnerships" className="rounded-md border border-primary/30 px-2.5 py-1.5 text-primary">Learnerships</a>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-6 overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background -z-10" />
          
          <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_0.9fr] gap-12 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/10">
                <ShieldCheck size={16} />
                <span>100% verified opportunities</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight mb-6 text-balance text-foreground">
                Real bursaries.<br />
                <span className="text-primary">Zero nonsense.</span>
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed text-balance max-w-xl">
                We read the fine print so you do not have to. Clear, accurate bursary and learnership pages that link straight to the official source. No spam, no dead links.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <a href="/bursaries" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-sm">
                  Browse bursaries
                  <ArrowRight size={20} />
                </a>
                <a href="/learnerships" className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-primary/30 px-6 py-4 rounded-xl text-primary font-semibold text-lg hover:bg-primary/5 transition-all">
                  Browse learnerships
                  <ArrowRight size={20} />
                </a>
              </div>
            </motion.div>

            {/* Featured Hero Card - Interactive Preview */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 bg-secondary/20 rounded-[2rem] blur-3xl -z-10 translate-y-8" />
              <div className="bg-card border border-border shadow-xl rounded-2xl p-6 md:p-8 transform rotate-1 hover:rotate-0 transition-transform duration-500 relative">
                <div className="absolute -top-4 -right-4 bg-secondary text-secondary-foreground font-bold px-4 py-2 rounded-lg shadow-sm rotate-6 flex items-center gap-2 border border-secondary-foreground/10">
                  <Clock size={16} />
                  <span>Closing Soon</span>
                </div>
                
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center mb-6">
                  <FileText className="text-primary" size={24} />
                </div>
                
                <h3 className="text-2xl font-display font-bold mb-3">Sasol Foundation Bursary Programme 2027</h3>
                <p className="text-muted-foreground mb-6 line-clamp-2">
                  All-inclusive undergraduate bursaries, mainly for STEM degrees, with academic and personal support. Applications close 23 August 2026.
                </p>
                
                <div className="space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 size={18} className="text-primary" />
                    <span>Last confirmed open: <strong>Today</strong></span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <CheckCircle2 size={18} className="text-primary" />
                    <span>Direct link to official Sasol portal</span>
                  </div>
                </div>
                
                {/* IMPORTANT: Root-relative plain anchor tag to the backend-served page */}
                <a 
                  href="/bursaries/sasol-foundation-bursary-2027" 
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition-colors"
                >
                  Read full details
                  <ExternalLink size={16} />
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* System Directory */}
        <section className="py-16 md:py-20 px-6 bg-background border-b border-border">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 text-secondary-foreground font-medium text-sm mb-4">
                <Search size={15} />
                <span>Everything in one place</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Explore Bursary Beacon</h2>
              <p className="text-muted-foreground text-lg">
                 Use these links to browse live opportunities and learn how Bursary Beacon checks official sources.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a href="/bursaries" className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all">
                <FileText className="text-primary mb-4" size={24} />
                <h3 className="font-display font-bold text-lg group-hover:text-primary">Bursaries</h3>
                <p className="text-sm text-muted-foreground mt-2">Browse current and recently closed bursary opportunities.</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-4">Browse bursaries <ArrowRight size={14} /></span>
              </a>
              <a href="/learnerships" className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all">
                <CheckCircle2 className="text-primary mb-4" size={24} />
                <h3 className="font-display font-bold text-lg group-hover:text-primary">Learnerships</h3>
                <p className="text-sm text-muted-foreground mt-2">See verified learnership listings as they are published.</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-4">Browse learnerships <ArrowRight size={14} /></span>
              </a>
              <a href="/about" className="group rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all">
                <ShieldCheck className="text-primary mb-4" size={24} />
                <h3 className="font-display font-bold text-lg group-hover:text-primary">How we verify</h3>
                <p className="text-sm text-muted-foreground mt-2">See how official sources, dates, links, and AI help are kept separate.</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary mt-4">Read our standards <ArrowRight size={14} /></span>
              </a>
            </div>
            <a href="/directory" className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-xl border-2 border-primary/20 bg-primary/5 px-5 py-4 text-primary font-bold hover:border-primary/50 hover:bg-primary/10 transition-all">
              Open the complete page directory — test every public, admin, draft, hub, and system page <ArrowRight size={18} />
            </a>
          </div>
        </section>

        {/* Value Props Section */}
        <section id="how-it-works" className="py-20 md:py-32 bg-white px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
              <h2 className="text-3xl md:text-5xl font-display font-bold mb-6">Why Bursary Beacon?</h2>
              <p className="text-lg text-muted-foreground text-balance">
                The internet is full of outdated listings and fake forms. We built this to be the guide you can actually trust.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center text-secondary-foreground mb-6">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="text-xl font-bold font-display">Verified Facts Only</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We do not scrape blindly. Every opportunity is manually reviewed, and the requirements are translated into plain English so you know exactly if you qualify.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <Clock size={24} />
                </div>
                <h3 className="text-xl font-bold font-display">Continuously Checked</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Every listing displays a "last confirmed open" date. If an opportunity closes early or the official link breaks, we pull it down. No more wasted effort.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-6">
                  <ExternalLink size={24} />
                </div>
                <h3 className="text-xl font-bold font-display">Direct to Source</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We never put a middleman between you and the application. Our "Apply" buttons always take you straight to the company's official portal.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Featured Opportunities Section */}
        <section id="featured" className="py-20 md:py-32 px-6 bg-card border-y border-border">
          <div className="max-w-4xl mx-auto">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
              <div>
                <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Latest Opportunities</h2>
                <p className="text-muted-foreground">Currently open and verified applications.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/bursaries" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                  All bursaries <ArrowRight size={15} />
                </a>
                <a href="/learnerships" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:border-primary hover:text-primary">
                  All learnerships <ArrowRight size={15} />
                </a>
              </div>
            </div>

            <div className="space-y-6">
              {/* Featured List Item */}
              <a 
                href="/bursaries/sasol-foundation-bursary-2027"
                className="group block bg-background border border-border hover:border-primary/50 hover:shadow-md transition-all rounded-2xl p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">STEM</span>
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">Undergraduate</span>
                    </div>
                    <h3 className="text-2xl font-bold font-display group-hover:text-primary transition-colors">
                      Sasol Foundation Bursary Programme 2027
                    </h3>
                    <p className="text-muted-foreground line-clamp-2 max-w-2xl">
                      All-inclusive bursaries from the Sasol Foundation for undergraduate studies starting in 2027 — mainly STEM, with limited places in fields like Accounting.
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
                    <div className="text-sm font-medium flex items-center gap-1.5 text-foreground bg-secondary/20 px-3 py-1.5 rounded-md">
                      <Clock size={14} className="text-secondary-foreground" />
                      Closes: 31 August
                    </div>
                    <div className="inline-flex items-center justify-center gap-2 text-primary font-semibold group-hover:translate-x-1 transition-transform">
                      View details
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </div>
              </a>
              
              {/* Additional Mock Items - purely visual for the landing page */}
              <div className="opacity-60 grayscale pointer-events-none border border-border border-dashed rounded-2xl p-6 sm:p-8 flex items-center justify-center bg-background">
                <p className="text-muted-foreground font-medium flex items-center gap-2">
                  <Search size={16} />
                  More opportunities being verified...
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="py-24 px-6 bg-primary text-primary-foreground text-center">
          <div className="max-w-3xl mx-auto space-y-8">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-balance">
              Stop wasting data on dead links.
            </h2>
            <p className="text-primary-foreground/80 text-lg md:text-xl max-w-2xl mx-auto">
              We check the links so you can focus on the application. Browse our clear, plain-English guides to South Africa's top bursaries.
            </p>
              <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
              <a 
                href="/bursaries"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-secondary text-secondary-foreground font-bold text-lg hover:bg-secondary/90 transition-all hover:-translate-y-0.5 active:translate-y-0 shadow-lg"
              >
                Browse bursaries
                <ArrowRight size={20} />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8 md:gap-12 items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                <Search size={14} strokeWidth={3} />
              </div>
              <span className="font-display font-bold text-lg tracking-tight">Bursary Beacon</span>
            </div>
            <p className="text-background/60 text-sm max-w-sm leading-relaxed">
              An independent guide to South African bursaries and learnerships. We are not affiliated with any government department or hiring company.
            </p>
          </div>
          
          <div className="md:text-right space-y-4">
            <p className="text-sm text-background/60">
              Built to respect your time and data.
            </p>
            <div className="flex flex-wrap items-center md:justify-end gap-x-4 gap-y-2 text-sm font-medium text-background/80">
              <a href="/bursaries" className="hover:text-white transition-colors">Bursaries</a>
              <a href="/learnerships" className="hover:text-white transition-colors">Learnerships</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/editorial-policy" className="hover:text-white transition-colors">Editorial policy</a>
              <a href="/contact" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-background/10 text-xs text-background/40 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Bursary Beacon. All rights reserved.</p>
          <p>Carefully checked for accuracy.</p>
        </div>
      </footer>
    </div>
  );
}
