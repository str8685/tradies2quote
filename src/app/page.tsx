import { Header } from "./_components/landing/Header";
import { Hero } from "./_components/landing/Hero";
import { Pain } from "./_components/landing/Pain";
import { HowItWorks } from "./_components/landing/HowItWorks";
import { ProductPreview } from "./_components/landing/ProductPreview";
import { Features } from "./_components/landing/Features";
import { FounderStory } from "./_components/landing/FounderStory";
import { Pricing } from "./_components/landing/Pricing";
import { FAQ } from "./_components/landing/FAQ";
import { FinalCta } from "./_components/landing/FinalCta";
import { Footer } from "./_components/landing/Footer";
import { ScrollProgress } from "./_components/landing/ScrollProgress";
import { CursorSpotlight } from "./_components/landing/CursorSpotlight";
import { softwareApplicationLd } from "./_components/landing/structured-data";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-ink-900 text-white">
      <CursorSpotlight />
      <ScrollProgress />
      <Header />
      <main>
        <Hero />
        <Pain />
        <HowItWorks />
        <ProductPreview />
        <Features />
        <FounderStory />
        <Pricing />
        <FAQ />
        <FinalCta />
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationLd),
        }}
      />
    </div>
  );
}
