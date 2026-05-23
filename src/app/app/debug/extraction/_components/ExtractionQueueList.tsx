import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowSquareOut, Warning } from "@phosphor-icons/react/dist/ssr";
import { formatCurrency } from "@/lib/quote-defaults";
import type { ExtractionQueueRow } from "@/lib/materials/extractionQueue";

type StatusView = "open" | "needs_review" | "blocked" | "handled";

type Props = {
  rows: ExtractionQueueRow[];
  status: StatusView;
  /**
   * Renders the per-row action control (the client "mark handled" button).
   * Passed in by the page so this list stays a pure presentational server
   * component with no server-action import — which also makes it renderable
   * via renderToStaticMarkup in tests.
   */
  renderAction?: (quoteId: string) => ReactNode;
};

/**
 * Presentational extraction-review queue. Renders a clear empty state (with
 * a next action) or a scannable card per flagged scan. No data fetching,
 * no server-only imports.
 */
export function ExtractionQueueList({ rows, status, renderAction }: Props) {
  if (rows.length === 0) {
    return (
      <div
        data-testid="extraction-empty"
        className="t2q-card-pro p-6 text-center sm:p-8"
      >
        <p className="font-display text-base uppercase tracking-tight text-white">
          {status === "handled" ? "Nothing handled yet." : "No scans need review."}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-300">
          {status === "handled"
            ? "Flagged scans you mark handled will show up here."
            : "Only supplier scans the AI flagged as needs_review or blocked appear in this queue. Clean reads go straight through — nothing to do here."}
        </p>
        {status !== "handled" && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app/materials/import-quote"
              data-testid="extraction-empty-cta"
              className="t2q-btn-primary justify-center"
            >
              Scan a supplier quote
            </Link>
            <Link
              href="/app/materials"
              className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-400 hover:text-brand"
            >
              open materials
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <QueueCard
          key={row.quoteId}
          row={row}
          action={renderAction && !row.reviewedAt ? renderAction(row.quoteId) : null}
        />
      ))}
    </ul>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "bad" | "info";
}) {
  const cls =
    tone === "ok"
      ? "border-brand/40 bg-brand/10 text-brand"
      : tone === "bad"
        ? "border-red-500/40 bg-red-500/10 text-red-300"
        : tone === "warn"
          ? "border-hivis/40 bg-hivis/10 text-hivis"
          : "border-ink-600 bg-ink-800 text-ink-300";
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${cls}`}
    >
      {label}
    </span>
  );
}

function money(n: number | null): string {
  return n == null ? "—" : formatCurrency(n, "NZD");
}

function QueueCard({
  row,
  action,
}: {
  row: ExtractionQueueRow;
  action: ReactNode;
}) {
  const statusTone = row.status === "blocked" ? "bad" : "warn";
  return (
    <li
      data-testid={`extraction-row-${row.quoteId}`}
      data-status={row.status ?? "unknown"}
      className={`t2q-card-pro p-5 ${
        row.status === "blocked"
          ? "border border-red-500/30"
          : "border border-hivis/25"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm uppercase tracking-tight text-white">
            {row.supplier || "Unknown supplier"}
          </span>
          <span className="font-mono text-[11px] text-ink-400">
            {row.quoteNumber}
          </span>
          <span className="font-mono text-[10px] text-ink-500">
            {new Date(row.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge label={`extraction · ${row.status ?? "—"}`} tone={statusTone} />
          {row.reconciliationStatus && (
            <StatusBadge
              label={`recon · ${row.reconciliationStatus}`}
              tone={
                row.reconciliationStatus === "blocked"
                  ? "bad"
                  : row.reconciliationStatus === "needs_review"
                    ? "warn"
                    : "ok"
              }
            />
          )}
          {row.attempts > 1 && (
            <StatusBadge label={`${row.attempts} attempts`} tone="info" />
          )}
          {row.corrected && <StatusBadge label="corrected" tone="ok" />}
          {row.reviewedAt && <StatusBadge label="handled" tone="ok" />}
        </div>
      </div>

      {/* Why it's flagged */}
      {row.reasons.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-xs text-ink-200">
          {row.reasons.slice(0, 5).map((r, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden="true" className="text-ink-500">·</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Rejected rows (raw_text provenance) */}
      {row.rowFailures.length > 0 && (
        <div className="mt-3 rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-red-300">
            <Warning size={11} weight="fill" /> rejected rows
          </p>
          <ul className="mt-1.5 space-y-1">
            {row.rowFailures.map((f, i) => (
              <li key={i} className="text-[11px] text-ink-200">
                <span className="font-mono text-ink-400">#{f.index}</span> {f.reason}
                {f.raw_text && (
                  <span className="ml-1.5 font-mono text-ink-500">
                    raw: “{f.raw_text}”
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Items + source totals */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ink-300">
        <span>
          {row.itemCount} item{row.itemCount === 1 ? "" : "s"}
        </span>
        <span>sub {money(row.source.subtotal)}</span>
        <span>gst {money(row.source.gst)}</span>
        <span>total {money(row.source.total)}</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/5 pt-3">
        <Link
          href={`/app/quotes/preview/${row.quoteId}`}
          data-testid="extraction-open-review"
          className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.15em] text-brand hover:text-white"
        >
          <ArrowSquareOut size={11} weight="bold" /> open in quote review
        </Link>
        {action}
      </div>
    </li>
  );
}
