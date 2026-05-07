import {
  Microphone,
  FileText,
  Receipt,
  CaretRight,
  Check,
} from "@phosphor-icons/react/dist/ssr";

const MATERIALS = [
  { d: "H3.2 90×45 framing — 24lm", v: "$312" },
  { d: "Plywood bracing 2400×1200", v: "$148" },
  { d: "GIB 13mm standard — 6 sheets", v: "$210" },
  { d: "Fixings + brackets", v: "$76" },
];

const LABOUR = [
  { d: "Site set-out + frame fix · 1 day", v: "$680" },
  { d: "Lining + stop · 1.5 days", v: "$890" },
  { d: "Site clean + cart-off", v: "$120" },
];

export function ProductPreview() {
  return (
    <section
      id="preview"
      data-testid="section-preview"
      className="relative border-b border-ink-600 bg-ink-900 py-24 md:py-32 overflow-hidden"
    >
      <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] rounded-full bg-brand/10 blur-3xl pointer-events-none animate-blob-slow" />
      <div className="absolute -bottom-32 right-1/4 w-[420px] h-[420px] rounded-full bg-hivis/10 blur-3xl pointer-events-none animate-blob-mid" />

      <div className="relative max-w-7xl mx-auto px-6 md:px-12">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 mb-14">
          <div className="lg:col-span-5">
            <div className="t2q-section-label mb-4">// what your client sees</div>
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl tracking-tighter uppercase leading-[0.95]">
              A quote that looks <br />
              <span className="text-brand">like you mean business.</span>
            </h2>
          </div>
          <div className="lg:col-span-7 lg:pt-4 text-lg text-ink-200 leading-relaxed">
            Materials and labour split out. GST handled. Terms locked in. One tap to convert
            it into an invoice when the job&apos;s done.
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          {/* Voice input panel */}
          <div
            data-testid="preview-voice"
            className="lg:col-span-4 bg-ink-800 border border-ink-600 rounded-sm p-6 md:p-8 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand">
                // step 1 · record
              </span>
            </div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 grid place-items-center bg-brand rounded-sm">
                <Microphone size={20} weight="bold" className="text-ink-900" />
              </div>
              <div>
                <div className="font-display text-lg uppercase tracking-tight">Recording</div>
                <div className="font-mono text-xs text-ink-400">00:47 · auto-saving</div>
              </div>
            </div>

            <div className="flex items-end gap-1 h-14 mb-6" aria-hidden>
              {[40, 65, 80, 50, 95, 75, 60, 85, 45, 70, 90, 55, 80, 60, 75, 50, 65, 85, 70, 55].map(
                (h, i) => (
                  <span
                    key={i}
                    className="t2q-wave-bar animate-wave"
                    style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
                  />
                )
              )}
            </div>

            <div className="font-mono text-[11px] leading-relaxed text-ink-300 bg-ink-900 border border-ink-700 rounded-sm p-4 flex-1">
              &ldquo;…framing for the back deck, 4-by-6 metres, H3.2 timber, ply bracing on the
              south side, GIB-line the existing wall, sweep up after — figure on a day and a
              half on site…&rdquo;
            </div>
          </div>

          {/* Quote preview panel */}
          <div
            data-testid="preview-quote"
            className="lg:col-span-8 bg-white text-ink-900 border-2 border-ink-600 rounded-sm overflow-hidden t2q-shadow-brutal"
          >
            <div className="px-6 md:px-8 pt-6 pb-4 bg-ink-50 border-b-2 border-ink-200 flex items-start justify-between gap-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand mb-1">
                  // quote · Q-202605-04
                </div>
                <div className="font-display text-2xl md:text-3xl uppercase tracking-tighter leading-tight">
                  Back deck framing &amp; line
                </div>
                <div className="mt-1 text-sm text-ink-500">
                  For Mark P · 8 Kauri Rd, Tauranga · valid 30 days
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                  Total (NZD)
                </div>
                <div className="font-display text-3xl md:text-4xl text-brand leading-none">
                  $2,801.55
                </div>
                <div className="mt-1 inline-block px-2 py-0.5 bg-hivis text-ink-900 font-display text-[10px] uppercase tracking-tight rounded-sm">
                  GST inc.
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-px bg-ink-200">
              <div className="bg-white p-6 md:p-7">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 mb-3">
                  // materials
                </div>
                <ul className="space-y-2">
                  {MATERIALS.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 py-1.5 border-b border-ink-100 last:border-b-0"
                    >
                      <span className="flex items-start gap-2 text-sm leading-snug">
                        <Check size={14} weight="bold" className="text-brand shrink-0 mt-0.5" />
                        {it.d}
                      </span>
                      <span className="font-mono text-sm shrink-0">{it.v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-6 md:p-7">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-500 mb-3">
                  // labour
                </div>
                <ul className="space-y-2">
                  {LABOUR.map((it, i) => (
                    <li
                      key={i}
                      className="flex items-start justify-between gap-3 py-1.5 border-b border-ink-100 last:border-b-0"
                    >
                      <span className="flex items-start gap-2 text-sm leading-snug">
                        <Check size={14} weight="bold" className="text-brand shrink-0 mt-0.5" />
                        {it.d}
                      </span>
                      <span className="font-mono text-sm shrink-0">{it.v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="px-6 md:px-8 py-5 bg-ink-50 border-t-2 border-ink-200">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    Subtotal
                  </div>
                  <div className="font-display text-lg">$2,436.00</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    GST (15%)
                  </div>
                  <div className="font-display text-lg">$365.55</div>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-500">
                    Terms
                  </div>
                  <div className="text-sm leading-snug">
                    30% deposit · balance on completion
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice conversion strip */}
          <div
            data-testid="preview-invoice"
            className="lg:col-span-12 mt-2 bg-ink-800 border border-ink-600 rounded-sm p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6"
          >
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-12 h-12 grid place-items-center bg-hivis rounded-sm">
                <FileText size={20} weight="bold" className="text-ink-900" />
              </div>
              <CaretRight size={20} weight="bold" className="text-ink-500" />
              <div className="w-12 h-12 grid place-items-center bg-brand rounded-sm">
                <Receipt size={20} weight="bold" className="text-ink-900" />
              </div>
            </div>
            <div className="flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brand mb-1">
                // step 4 · convert to invoice
              </div>
              <div className="font-display text-xl md:text-2xl uppercase tracking-tight">
                Job done? One tap turns the quote into an invoice.
              </div>
              <div className="mt-1 text-sm text-ink-300">
                Same line items, GST already calculated, payment terms baked in. Email it
                straight from the app.
              </div>
            </div>
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-300">
              <span className="px-3 py-1.5 bg-ink-700 border border-ink-600 rounded-sm">
                INV-202605-04
              </span>
              <span className="text-hivis">$2,801.55 · due in 7 days</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
