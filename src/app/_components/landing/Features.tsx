import Image from "next/image";
import {
  Hammer,
  Wrench,
  PaintRoller,
  Plug,
  Tree,
  HardHat,
  SealCheck,
  Money,
  DeviceMobile,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";

const FEATURES = [
  {
    slug: "voice-first",
    title: "Voice-first, thumb-friendly",
    body: "Big buttons designed for muddy fingers and bright sunlight. Tap, talk, done.",
    icon: DeviceMobile,
    span: "md:col-span-2",
  },
  {
    slug: "branded-pdf",
    title: "Branded quote PDFs",
    body: "Your logo, ABN/NZBN, terms — auto-stamped on every quote.",
    icon: SealCheck,
  },
  {
    slug: "tax-built-in",
    title: "GST/Tax built in",
    body: "NZ 15%, AU 10%, UK 20%. Set once, applied everywhere.",
    icon: Receipt,
  },
  {
    slug: "materials-labour",
    title: "Materials + Labour breakdown",
    body: "Materials and labour split out clearly — the way clients actually want to read them.",
    icon: Money,
    span: "md:col-span-2",
  },
];

const TRADES = [
  { label: "Builders", icon: Hammer },
  { label: "Plumbers", icon: Wrench },
  { label: "Sparkies", icon: Plug },
  { label: "Painters", icon: PaintRoller },
  { label: "Landscapers", icon: Tree },
  { label: "Roofers", icon: HardHat },
];

const FEATURE_BAND_IMG =
  "https://images.unsplash.com/photo-1758574697284-8e84046a45ae?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB0b29sJTIwaGFyZCUyMGhhdCUyMGJsdWVwcmludHxlbnwwfHx8fDE3NzgxMTA0MzR8MA&ixlib=rb-4.1.0&q=85";
const TRADES_BG_IMG =
  "https://images.unsplash.com/photo-1564483335100-3413b45dbd37?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzB8MHwxfHNlYXJjaHw0fHxjb25zdHJ1Y3Rpb24lMjB0b29sJTIwaGFyZCUyMGhhdCUyMGJsdWVwcmludHxlbnwwfHx8fDE3NzgxMTA0MzR8MA&ixlib=rb-4.1.0&q=85";

export function Features() {
  return (
    <section
      id="features"
      data-testid="section-features"
      className="relative border-b border-ink-600 bg-ink-800 py-24 md:py-32"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-14">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">// what&apos;s in the toolbox</div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
              Less app.
              <br />
              <span className="text-hivis">More tool.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-4">
            <p className="text-lg text-ink-300 leading-relaxed">
              Tradify, Fergus, simPRO — they&apos;re full job-management beasts that take a weekend
              to set up and a finance degree to use. tradies2Quote does{" "}
              <span className="text-white font-semibold">one thing</span>: quotes done fast by
              voice. That&apos;s the whole pitch.
            </p>
          </div>
        </div>

        {/* Visual band — "stop losing your weekends to quotes" */}
        <div
          data-testid="features-visual-band"
          className="relative mb-10 overflow-hidden border border-ink-600 rounded-sm h-48 md:h-64"
        >
          <Image
            src={FEATURE_BAND_IMG}
            alt="Tradie measuring a surface on site"
            fill
            sizes="(min-width: 768px) 1280px, 100vw"
            className="object-cover"
            priority={false}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-transparent" />
          <div className="absolute inset-0 flex items-center px-8 md:px-12">
            <div className="max-w-md">
              <div className="t2q-section-label mb-2">// reality check</div>
              <p className="font-display text-2xl md:text-3xl uppercase tracking-tighter leading-[0.95] text-white">
                Stop losing your weekends to quotes.
              </p>
            </div>
          </div>
        </div>

        {/* Bento */}
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map(({ slug, title, body, icon: Icon, span }) => (
            <div
              key={title}
              data-testid={`feature-card-${slug}`}
              className={`${span ?? ""} bg-ink-900 border border-ink-600 rounded-sm p-8 md:p-10 group hover:bg-ink-800 transition-colors`}
            >
              <Icon
                size={28}
                weight="bold"
                className="text-brand mb-6 group-hover:text-hivis transition-colors"
              />
              <h3 className="font-display text-xl md:text-2xl uppercase tracking-tight mb-2">
                {title}
              </h3>
              <p className="text-ink-200">{body}</p>
            </div>
          ))}
        </div>

        {/* Trades marquee */}
        <div className="relative mt-16 border-y-2 border-ink-600 -mx-6 md:-mx-12 group overflow-hidden">
          <Image
            src={TRADES_BG_IMG}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-20 pointer-events-none"
          />
          <div className="absolute inset-0 bg-ink-950/80 pointer-events-none" />
          <div className="relative t2q-stripes h-2" />
          <div className="relative overflow-hidden no-scrollbar">
            <div className="flex animate-marquee whitespace-nowrap py-6 group-hover:[animation-play-state:paused]">
              {[...TRADES, ...TRADES, ...TRADES].map(({ label, icon: Icon }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-10 text-ink-300 hover:text-white transition-colors"
                >
                  <Icon size={24} weight="bold" className="text-brand" />
                  <span className="font-display text-2xl uppercase tracking-tight">{label}</span>
                  <span className="w-2 h-2 bg-ink-600 ml-6" />
                </div>
              ))}
            </div>
          </div>
          <div className="relative t2q-stripes h-2" />
        </div>
      </div>
    </section>
  );
}
