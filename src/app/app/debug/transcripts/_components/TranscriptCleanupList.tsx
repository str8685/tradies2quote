import Link from "next/link";
import {
  ArrowRight,
  ArrowSquareOut,
  Microphone,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import type { CorrectionSource } from "@/lib/transcriptCleanup";
import type { TranscriptCleanupRow } from "@/lib/transcript/debugView";

type Props = {
  rows: Array<TranscriptCleanupRow & { number: string }>;
};

function pct(n: number | null | undefined): string {
  return typeof n === "number" ? `${Math.round(n * 100)}%` : "—";
}

function sourceTone(s: CorrectionSource | undefined): string {
  switch (s) {
    case "user_history":
    case "materials_library":
      return "border-brand/40 bg-brand/10 text-brand";
    case "supplier":
    case "global":
      return "border-hivis/40 bg-hivis/10 text-hivis";
    default:
      return "border-ink-600 bg-ink-800 text-ink-300";
  }
}

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString() : "—";
}

/**
 * Presentational owner view of recent transcript cleanups: raw vs cleaned,
 * the corrections applied (before → after, type, source, confidence, reason),
 * and any flagged clarifications. No data fetching — renderable via
 * renderToStaticMarkup.
 */
export function TranscriptCleanupList({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div
        data-testid="transcript-cleanup-empty"
        className="t2q-card-pro p-6 text-center sm:p-8"
      >
        <Microphone size={28} weight="duotone" className="mx-auto mb-3 text-ink-400" />
        <p className="font-display text-base uppercase tracking-tight text-white">
          No transcripts yet.
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-300">
          Voice or typed quotes will show their raw vs cleaned transcript here,
          with every spelling / domain-term correction the cleanup applied. The
          raw transcript is always preserved untouched.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="transcript-cleanup-list" className="space-y-6">
      {rows.map((row) => (
        <section
          key={row.id}
          data-testid="transcript-cleanup-row"
          className="t2q-card-pro p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base uppercase tracking-tight text-white sm:text-lg">
              {row.number}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              conf {pct(row.confidence)} · {fmtDate(row.createdAt)}
            </span>
          </div>

          {/* Raw vs cleaned */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="t2q-section-label-pro mb-1.5 text-ink-400">{"// raw"}</p>
              <p className="whitespace-pre-wrap rounded-sm border border-ink-700/60 bg-ink-950/40 p-3 font-mono text-xs text-ink-200">
                {row.raw || "—"}
              </p>
            </div>
            <div>
              <p className="t2q-section-label-pro mb-1.5 text-brand">{"// cleaned"}</p>
              <p className="whitespace-pre-wrap rounded-sm border border-brand/25 bg-ink-950/40 p-3 font-mono text-xs text-white">
                {row.cleaned || "—"}
              </p>
            </div>
          </div>

          {/* Corrections */}
          {row.corrections.length > 0 ? (
            <div className="mt-4">
              <p className="t2q-section-label-pro mb-2 text-ink-400">
                {`// corrections (${row.corrections.length})`}
              </p>
              <ul className="space-y-2">
                {row.corrections.map((c, i) => (
                  <li
                    key={i}
                    data-testid="transcript-correction"
                    className="border-b border-ink-700/60 pb-2 last:border-b-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-ink-300 line-through">{c.before}</span>
                      <ArrowRight size={12} weight="bold" className="text-ink-500" />
                      <span className="font-mono text-white">{c.after}</span>
                      <span
                        className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${sourceTone(c.source)}`}
                      >
                        {(c.source ?? "regex").replace(/_/g, " ")} · {pct(c.confidence)}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-500">
                        {c.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    {c.reason && (
                      <p className="mt-0.5 text-[11px] text-ink-400">{c.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              clean — no corrections
            </p>
          )}

          {/* Flagged clarifications */}
          {row.clarifications.length > 0 && (
            <div className="mt-4">
              <p className="t2q-section-label-pro mb-2 text-hivis">
                {`// flagged — needs confirming (${row.clarifications.length})`}
              </p>
              <ul className="space-y-2">
                {row.clarifications.map((q) => (
                  <li
                    key={q.id}
                    data-testid="transcript-clarification"
                    className="flex items-start gap-2 text-[12px] text-ink-200"
                  >
                    <Warning size={13} weight="fill" className="mt-0.5 shrink-0 text-hivis" />
                    <span>
                      {q.question}
                      <span className="ml-1 text-ink-500">— {q.why}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`/app/quotes/preview/${row.id}`}
            className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300 hover:text-brand"
          >
            <ArrowSquareOut size={11} weight="bold" />
            open quote
          </Link>
        </section>
      ))}
    </div>
  );
}
