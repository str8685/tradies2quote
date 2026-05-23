import Link from "next/link";
import type { QuoteTrace } from "@/lib/quoteTrace";

export type RecentTraceRow = {
  id: string;
  number: string;
  status: string;
  blocked: boolean;
  issueCount: number;
};

type Props = {
  recent: RecentTraceRow[];
  selectedId: string | null;
  trace: QuoteTrace | null;
  currency: string;
};

function money(n: number | null | undefined, currency: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${currency} ${n.toFixed(2)}`;
}

/**
 * Owner debug — quote traceability panel. Shows the deterministic value
 * flow (source → normalized → computed → validation) and the EXACT
 * mismatch / block reasons for a chosen quote. Read-only.
 */
export function QuoteTracePanel({ recent, selectedId, trace, currency }: Props) {
  return (
    <section
      aria-label="Quote trace"
      data-testid="debug-quote-trace"
      className="t2q-card-pro mb-8 p-5 sm:p-7"
    >
      <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
        Quote trace.
      </h2>
      <p className="mt-2 text-xs text-ink-300">
        Source → normalized → computed → validation, with the exact reason
        anything is flagged or blocked. Pick a recent quote.
      </p>

      {/* Recent quotes selector */}
      <ul className="mt-4 flex flex-wrap gap-2">
        {recent.map((r) => (
          <li key={r.id}>
            <Link
              href={`/app/debug?quote=${r.id}`}
              data-testid={`trace-pick-${r.id}`}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${
                r.id === selectedId
                  ? "border-brand bg-brand/10 text-brand"
                  : r.blocked
                    ? "border-red-500/40 bg-red-500/5 text-red-300"
                    : "border-ink-700 bg-ink-800 text-ink-200 hover:border-brand/50"
              }`}
            >
              {r.number}
              <span className="text-ink-500">·</span>
              {r.blocked ? "blocked" : r.issueCount > 0 ? `${r.issueCount} flag` : "ok"}
            </Link>
          </li>
        ))}
        {recent.length === 0 && (
          <li className="text-sm text-ink-400">No quotes yet.</li>
        )}
      </ul>

      {selectedId && !trace && (
        <p className="mt-4 text-sm text-red-300">
          Quote not found (or not yours).
        </p>
      )}

      {trace && (
        <div className="mt-5 space-y-5 border-t border-white/5 pt-5">
          {/* Verdict row */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={trace.send.can_send ? "ok" : "bad"}
              label={trace.send.can_send ? "sendable" : "blocked"}
            />
            {trace.is_supplier_import && (
              <Badge
                tone={
                  trace.reconciliation_status === "blocked"
                    ? "bad"
                    : trace.reconciliation_status === "needs_review"
                      ? "warn"
                      : "ok"
                }
                label={`supplier · ${trace.reconciliation_status ?? "—"}`}
              />
            )}
            {trace.extraction_status && (
              <Badge
                tone={
                  trace.extraction_status === "blocked"
                    ? "bad"
                    : trace.extraction_status === "needs_review"
                      ? "warn"
                      : "ok"
                }
                label={`extraction · ${trace.extraction_status}`}
              />
            )}
            {trace.dimension_confirmation?.required && (
              <Badge
                tone={
                  trace.dimension_confirmation.unconfirmed.length > 0
                    ? "bad"
                    : "ok"
                }
                label={
                  trace.dimension_confirmation.unconfirmed.length > 0
                    ? "dimensions · unconfirmed"
                    : "dimensions · confirmed"
                }
              />
            )}
            {trace.is_takeoff && <Badge tone="info" label="takeoff" />}
            <Badge
              tone={trace.totals_match ? "ok" : "bad"}
              label={trace.totals_match ? "totals tie out" : "totals drift"}
            />
          </div>

          {/* Block / warning reasons */}
          {trace.send.block_reasons.length > 0 && (
            <ReasonList
              title="Blocking reasons"
              tone="bad"
              reasons={trace.send.block_reasons}
            />
          )}
          {trace.send.warning_reasons.length > 0 && (
            <ReasonList
              title="Warnings"
              tone="warn"
              reasons={trace.send.warning_reasons}
            />
          )}
          {trace.reconciliation_reasons.length > 0 && (
            <ReasonList
              title="Reconciliation"
              tone="warn"
              reasons={trace.reconciliation_reasons}
            />
          )}
          {trace.extraction_reasons.length > 0 && (
            <ReasonList
              title="Extraction"
              tone="warn"
              reasons={trace.extraction_reasons}
            />
          )}
          {trace.dimension_confirmation?.required &&
            trace.dimension_confirmation.unconfirmed.length > 0 && (
              <ReasonList
                title="Confirm key dimensions"
                tone="bad"
                reasons={[
                  ...trace.dimension_confirmation.unconfirmed.map(
                    (l) => `${l} — read off the drawing, not yet confirmed`,
                  ),
                  ...trace.dimension_confirmation.reasons.map(
                    (r) => `flagged: ${r}`,
                  ),
                ]}
              />
            )}
          {trace.dimension_confirmation?.required &&
            trace.dimension_confirmation.unconfirmed.length === 0 && (
              <p className="font-mono text-[11px] text-brand">
                key dimensions confirmed
                {trace.dimension_confirmation.confirmed_by
                  ? ` · by ${trace.dimension_confirmation.confirmed_by}`
                  : ""}
                {trace.dimension_confirmation.confirmed_at
                  ? ` · ${trace.dimension_confirmation.confirmed_at
                      .replace("T", " ")
                      .slice(0, 16)} UTC`
                  : ""}
                {trace.dimension_confirmation.reasons.length > 0
                  ? ` · flagged: ${trace.dimension_confirmation.reasons.join(", ")}`
                  : ""}
              </p>
            )}

          {/* Totals: stored vs computed */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              Totals — stored vs recomputed
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
              <span className="text-ink-500">field</span>
              <span className="text-ink-500">stored</span>
              <span className="text-ink-500">computed</span>
              {(
                [
                  ["subtotal", "subtotal_before_tax"],
                  ["gst", "tax_amount"],
                  ["total", "total"],
                ] as const
              ).map(([label, key]) => {
                const stored = trace.stored_totals[key];
                const computed = trace.computed_totals[key];
                const bad = Math.abs(stored - computed) > 0.01;
                return (
                  <div key={key} className="contents">
                    <span className="text-ink-300">{label}</span>
                    <span className={bad ? "text-red-300" : "text-white"}>
                      {money(stored, currency)}
                    </span>
                    <span className="text-white">{money(computed, currency)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-line trace */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              Lines — source → normalized → computed
            </p>
            <ul className="mt-2 space-y-2">
              {trace.lines.map((l, i) => (
                <li
                  key={i}
                  data-testid={`trace-line-${i}`}
                  className={`rounded-sm border px-3 py-2 ${
                    l.issues.length > 0
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-ink-700/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {l.description || "—"}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink-400">
                      qty:{l.quantity_source ?? "—"}
                      {l.quantity_source === "ai"
                        ? l.quantity_confirmed
                          ? " (confirmed)"
                          : " (unconfirmed)"
                        : ""}
                      {l.takeoff_status ? ` · ${l.takeoff_status}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-0.5 font-mono text-[11px] text-ink-300 sm:grid-cols-3">
                    {l.source && (
                      <span>
                        source: {l.source.quantity ?? "—"} × {money(l.source.unit_price, currency)} = {money(l.source.line_total, currency)}
                      </span>
                    )}
                    <span>
                      app: {l.normalized.quantity} × {money(l.normalized.unit_price, currency)} = {money(l.normalized.line_total, currency)}
                    </span>
                    <span>computed: {money(l.computed_line_total, currency)}</span>
                  </div>
                  {l.issues.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[11px] text-red-300">
                      {l.issues.map((iss, j) => (
                        <li key={j}>· {iss}</li>
                      ))}
                    </ul>
                  )}
                  {l.flags.length > 0 && (
                    <p className="mt-1 text-[11px] text-hivis">
                      flags: {l.flags.join("; ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function Badge({
  tone,
  label,
}: {
  tone: "ok" | "bad" | "warn" | "info";
  label: string;
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
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${cls}`}
    >
      {label}
    </span>
  );
}

function ReasonList({
  title,
  tone,
  reasons,
}: {
  title: string;
  tone: "bad" | "warn";
  reasons: string[];
}) {
  return (
    <div
      className={`rounded-sm border px-3 py-2 ${
        tone === "bad"
          ? "border-red-500/30 bg-red-500/5"
          : "border-hivis/30 bg-hivis/5"
      }`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.2em] ${
          tone === "bad" ? "text-red-300" : "text-hivis"
        }`}
      >
        {title}
      </p>
      <ul className="mt-1 space-y-0.5 text-xs text-ink-200">
        {reasons.map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>
    </div>
  );
}
