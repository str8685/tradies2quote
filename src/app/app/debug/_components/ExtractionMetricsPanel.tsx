import Link from "next/link";
import type { ExtractionMetrics } from "@/lib/materials/extractionMetrics";

type Props = {
  metrics: ExtractionMetrics;
  /** When set, renders a compact summary + a link to the full queue. */
  href?: string;
  compact?: boolean;
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Owner-only extraction quality metrics. Pure counts (no external
 * services). Used full on the review-queue page and compact on the debug
 * page. Read-only.
 */
export function ExtractionMetricsPanel({ metrics, href, compact }: Props) {
  const { total, byStatus, bySupplier, retryRate, correctionRate, flaggedCount, correctedCount } =
    metrics;

  return (
    <section
      aria-label="Extraction metrics"
      data-testid="extraction-metrics"
      className="t2q-card-pro p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="t2q-section-label-pro">{"// extraction quality"}</p>
        {href && (
          <Link
            href={href}
            className="font-mono text-[10px] uppercase tracking-[0.15em] text-brand hover:text-white"
          >
            review queue →
          </Link>
        )}
      </div>

      {total === 0 ? (
        <p className="mt-3 text-sm text-ink-400">No supplier scans yet.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="scans" value={String(total)} />
            <Stat label="ok" value={String(byStatus.ok)} tone="ok" />
            <Stat label="review" value={String(byStatus.needs_review)} tone="warn" />
            <Stat label="blocked" value={String(byStatus.blocked)} tone="bad" />
            <Stat label="retry" value={pct(retryRate)} />
            <Stat
              label="fixed"
              value={`${correctedCount}/${flaggedCount}`}
              sub={pct(correctionRate)}
            />
          </div>

          {!compact && bySupplier.length > 0 && (
            <div className="mt-5 border-t border-white/5 pt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
                By supplier
              </p>
              <ul className="mt-2 space-y-1.5">
                {bySupplier.map((s) => (
                  <li
                    key={s.supplier}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink-200">
                      {s.supplier}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-300">
                      {s.total} total
                      {s.needs_review > 0 && (
                        <span className="ml-2 text-hivis">
                          {s.needs_review} review
                        </span>
                      )}
                      {s.blocked > 0 && (
                        <span className="ml-2 text-red-300">
                          {s.blocked} blocked
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok"
      ? "text-brand"
      : tone === "warn"
        ? "text-hivis"
        : tone === "bad"
          ? "text-red-300"
          : "text-white";
  return (
    <div className="rounded-sm border border-ink-700/60 bg-ink-900/40 px-2.5 py-2">
      <p className={`font-mono text-lg tabular-nums ${color}`}>{value}</p>
      <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-400">
        {label}
      </p>
      {sub && (
        <p className="font-mono text-[9px] tabular-nums text-ink-500">{sub}</p>
      )}
    </div>
  );
}
