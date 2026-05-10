import { Header } from "./_components/landing/Header";
import { Hero } from "./_components/landing/Hero";
import { StatStrip } from "./_components/landing/StatStrip";
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
import { LiveTicker } from "./_components/landing/LiveTicker";
import TapeDivider from "./_components/landing/TapeDivider";
import LoadingScreen from "./_components/landing/LoadingScreen";
import InstallNudge from "./_components/landing/InstallNudge";
import { softwareApplicationLd } from "./_components/landing/structured-data";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink-900 text-white relative">
      <CursorSpotlight />
      <ScrollProgress />
      <Header />
      <main className="relative z-[2]">
        <Hero />
        <StatStrip />
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
      <LiveTicker />
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
