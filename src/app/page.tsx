import { Header } from "./_components/landing/Header";
import { Hero } from "./_components/landing/Hero";
import { Pain } from "./_components/landing/Pain";
import { QuoteWorkflow } from "./_components/landing/QuoteWorkflow";
import { HowItWorks } from "./_components/landing/HowItWorks";
import { Features } from "./_components/landing/Features";
import { FounderStory } from "./_components/landing/FounderStory";
import { Pricing } from "./_components/landing/Pricing";
import { FAQ } from "./_components/landing/FAQ";
import { FinalCta } from "./_components/landing/FinalCta";
import { Footer } from "./_components/landing/Footer";
import { ScrollProgress } from "./_components/landing/ScrollProgress";
import { CursorSpotlight } from "./_components/landing/CursorSpotlight";
import TapeDivider from "./_components/landing/TapeDivider";
import InstallNudge from "./_components/landing/InstallNudge";
import { softwareApplicationLd } from "./_components/landing/structured-data";

/**
 * Wave 10.5 — `<StatStrip />` and `<LiveTicker />` were removed from the
 * landing because they showed invented platform numbers (12,847 quotes,
 * $4.2M invoiced, 1,243 tradies, fake "Riki T. sent quote $3,420"
 * notifications).
 *
 * Wave 19.2 — `<Testimonials />` removed for the same reason: the three
 * quotes ("Riki T. · Builder · Auckland", "Macca · Plumber · Brisbane",
 * "James W. · Sparkie · Manchester") were placeholder copy attributed
 * to non-existent customers. The component is kept on disk so it can
 * be re-mounted once real beta-tradie quotes (with consent) are ready
 * to swap in. The page reads honestly: Hero → Pain → product → pricing
 * → FAQ → CTA, no fabricated social proof.
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink-900 text-white relative">
      <CursorSpotlight />
      <ScrollProgress />
      <Header />
      <main className="relative z-[2]">
        <Hero />
        <Pain />
        <QuoteWorkflow />
        <HowItWorks />
        <TapeDivider label="ONE TOOL · DOES ONE THING · BLOODY WELL" />
        <Features />
        <FounderStory />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
      {/* Wave 19.4 — <LoadingScreen /> removed from the marketing
          landing. The Hero phone mockup is the LCP and shouldn't be
          covered by a 1.7s splash overlay on cold loads. The in-app
          splash stays mounted at src/app/app/layout.tsx for the
          authenticated surface where it makes more sense. */}
      <InstallNudge />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationLd),
        }}
      />
    </div>
  );
}
