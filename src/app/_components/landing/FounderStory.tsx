import Image from "next/image";
import {
  MapPin,
  ShieldCheck,
  PencilSimple,
  HandPalm,
} from "@phosphor-icons/react/dist/ssr";

const FOUNDER_PORTRAIT =
  "https://images.unsplash.com/photo-1616179283726-e96f7aa16a56?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDR8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjB3b3JrZXIlMjB3b3Jrc2l0ZSUyMHBvcnRyYWl0fGVufDB8fHx8MTc3ODExMDM5MXww&ixlib=rb-4.1.0&q=85";

const PILLARS = [
  {
    slug: "nz-first",
    icon: MapPin,
    title: "Built for NZ tradies",
    body: "NZ first. NZBN, NZD, GST 15% — all baked in. Australia, UK and the rest come next.",
  },
  {
    slug: "gst-ready",
    icon: ShieldCheck,
    title: "GST-ready out of the box",
    body: "Inc-GST, ex-GST, both shown on the PDF. Set your tax once and every quote calculates it for you.",
  },
  {
    slug: "edit-before-send",
    icon: PencilSimple,
    title: "Editable before sending",
    body: "The first draft is a starting point, not a contract. Tweak any line, any price, any note before it goes out.",
  },
  {
    slug: "no-auto-send",
    icon: HandPalm,
    title: "Nothing sends without your tap",
    body: "No auto-send. No surprise emails to your client. Quotes only leave when you tap send. Your name, your call.",
  },
];

export function FounderStory() {
  return (
    <section
      id="trust"
      data-testid="section-trust"
      className="relative border-b border-ink-600 bg-ink-800 py-24 md:py-32 overflow-hidden"
    >
      <div className="absolute inset-0 t2q-noise opacity-40 pointer-events-none" />
      <div className="absolute -top-32 -left-20 w-[500px] h-[500px] rounded-full bg-brand/10 blur-3xl pointer-events-none animate-blob" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-14">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">// why you can trust this</div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
              Built by a builder. <br />
              <span className="text-brand">For builders.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-4 flex items-start gap-5">
            <div className="relative shrink-0 w-20 h-20 md:w-24 md:h-24 border-2 border-ink-600 overflow-hidden rounded-sm">
              <Image
                src={FOUNDER_PORTRAIT}
                alt="Challis Samu, founder of tradies2Quote"
                fill
                sizes="96px"
                className="object-cover grayscale"
              />
            </div>
            <p className="text-lg text-ink-200 leading-relaxed">
              I&apos;m Challis Samu — qualified builder, running STR8 Builders out of NZ. I built
              this for myself first because I was sick of losing Sundays to quoting. Now it&apos;s
              in beta with a small crew of mates and I&apos;m opening it up.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-ink-600 border border-ink-600">
          {PILLARS.map(({ slug, icon: Icon, title, body }) => (
            <div
              key={slug}
              data-testid={`trust-pillar-${slug}`}
              className="bg-ink-900 p-8 md:p-10"
            >
              <Icon size={28} weight="bold" className="text-brand mb-6" />
              <h3 className="font-display text-lg md:text-xl uppercase tracking-tight mb-2">
                {title}
              </h3>
              <p className="text-ink-300 text-sm leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 border border-ink-600 bg-ink-900 rounded-sm">
          <span className="w-2 h-2 rounded-full bg-hivis animate-pulse" />
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-200">
            Beta · NZ tradies only · onboarding new crews each week
          </span>
        </div>
      </div>
    </section>
  );
}
