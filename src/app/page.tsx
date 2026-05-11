import { Header } from "./_components/landing/Header";
import { Hero } from "./_components/landing/Hero";
import { Pain } from "./_components/landing/Pain";
import { QuoteWorkflow } from "./_components/landing/QuoteWorkflow";
import { HowItWorks } from "./_components/landing/HowItWorks";
import { Features } from "./_components/landing/Features";
import { FounderStory } from "./_components/landing/FounderStory";
import { Pricing } from "./_components/landing/Pricing";
import { Testimonials } from "./_components/landing/Testimonials";
import { FAQ } from "./_components/landing/FAQ";
import { FinalCta } from "./_components/landing/FinalCta";
import { Footer } from "./_components/landing/Footer";
import { ScrollProgress } from "./_components/landing/ScrollProgress";
import { CursorSpotlight } from "./_components/landing/CursorSpotlight";
import TapeDivider from "./_components/landing/TapeDivider";
import LoadingScreen from "./_components/landing/LoadingScreen";
import InstallNudge from "./_components/landing/InstallNudge";
import { softwareApplicationLd } from "./_components/landing/structured-data";

/**
 * Wave 10.5 — `<StatStrip />` and `<LiveTicker />` were removed from the
 * landing because they showed invented platform numbers (12,847 quotes,
 * $4.2M invoiced, 1,243 tradies, fake "Riki T. sent quote $3,420"
 * notifications). The components themselves are kept on disk (in
 * `./_components/landing/`) so the count-up animation logic can be
 * re-used later against real Supabase aggregates, but the landing no
 * longer mounts them. The page reads honestly: Hero → Pain → product
 * → pricing → FAQ → CTA, no fabricated social proof.
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
        <Testimonials />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />
      <LoadingScreen />
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
