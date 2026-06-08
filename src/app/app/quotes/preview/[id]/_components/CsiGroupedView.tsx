import { CaretDown, Stack } from "@phosphor-icons/react";
import { mapLinesToCsi } from "@/lib/takeoff/csi/map";
import { CSI_DIVISION_LABEL, unitSummary } from "@/lib/takeoff/csi/presentation";
import type { CsiLineItem, CsiProvenance } from "@/lib/takeoff/csi/contracts";
import type { QuoteLineItem } from "@/lib/quote-types";

/**
 * READ-ONLY CSI grouping lens over the live `quote_data.line_items`.
 *
 * A presentation layer only — it runs the frozen Stage-1 mapper
 * (`mapLinesToCsi`) over the items the editor already holds and renders them
 * grouped by MasterFormat division. It NEVER edits, recalculates, reprices,
 * or mutates anything; switching back to the standard view shows the same
 * editable data. Uncategorized lines stay fully visible with explicit
 * "needs review" copy — the view never implies completeness beyond the
 * mapper's current 5-division scope.
 *
 * Collapsed by default (native <details>) so the standard editable view stays
 * the conservative default on every viewport.
 */

const PROVENANCE_LABEL: Record<CsiProvenance, string> = {
  calculated: "calc",
  supplier: "supplier",
  user: "manual entry",
  ai_estimated: "AI estimate",
  blocked: "blocked",
  unknown: "unconfirmed",
};

const PILL =
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]";

function provenanceTone(p: CsiProvenance): string {
  if (p === "blocked") return "border-red-500/40 bg-red-500/10 text-red-300";
  if (p === "ai_estimated") return "border-hivis/40 bg-hivis/10 text-hivis";
  if (p === "unknown") return "border-ink-600 bg-ink-800 text-ink-400";
  return "border-ink-600 bg-ink-800 text-ink-300";
}

function LineRow({ line }: { line: CsiLineItem }) {
  const status = line.takeoff_status;
  const showStatus = status && status !== "ok";
  return (
    <li className="flex items-start justify-between gap-3 border-b border-ink-700/50 py-2 text-sm last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-white">{line.source_description}</p>
        <p className="mt-0.5 font-mono text-[11px] text-ink-400">
          {typeof line.quantity === "number" ? line.quantity : "—"}{" "}
          {line.unit ?? ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`${PILL} ${provenanceTone(line.provenance)}`}>
          {PROVENANCE_LABEL[line.provenance]}
        </span>
        {showStatus && status === "blocked" && (
          <span className={`${PILL} border-red-500/40 bg-red-500/10 text-red-300`}>
            needs info
          </span>
        )}
        {showStatus && status === "needs_review" && (
          <span className={`${PILL} border-hivis/40 bg-hivis/10 text-hivis`}>
            needs review
          </span>
        )}
        {showStatus && status === "assumed" && (
          <span className={`${PILL} border-ink-600 bg-ink-800 text-ink-300`}>
            assumed
          </span>
        )}
      </div>
    </li>
  );
}

export function CsiGroupedView({ items }: { items: QuoteLineItem[] }) {
  const grouped = mapLinesToCsi(items);
  const hasAnything =
    grouped.divisions.length > 0 || grouped.uncategorized.length > 0;

  if (!hasAnything) {
    return (
      <p className="text-sm text-ink-400">No line items to group yet.</p>
    );
  }

  return (
    <div data-testid="csi-grouped-view" className="space-y-4">
      <p className="rounded-lg border border-ink-700/60 bg-ink-900/40 px-3 py-2 text-xs text-ink-300">
        Organizational view only. This groups your existing lines into trade
        divisions — it doesn&rsquo;t recalculate, reprice, or change your quote.
        Anything not confidently mapped stays under &ldquo;Needs review&rdquo;.
      </p>

      {grouped.divisions.map((d) => {
        const summary = unitSummary(d.lines);
        return (
          <details
            key={d.division}
            open
            data-testid={`csi-section-${d.division}`}
            className="rounded-lg border border-ink-700/60 bg-ink-950/30"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
              <Stack size={16} weight="duotone" className="shrink-0 text-brand" />
              <span className="font-display text-sm uppercase tracking-tight text-white">
                {CSI_DIVISION_LABEL[d.division]}
              </span>
              <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-ink-400">
                <span>{d.lines.length} {d.lines.length === 1 ? "line" : "lines"}</span>
                {summary && <span className="hidden sm:inline">· {summary}</span>}
                <CaretDown size={12} weight="bold" className="shrink-0" />
              </span>
            </summary>
            <ul className="px-3 pb-2">
              {d.lines.map((l, i) => (
                <LineRow key={`${l.source_description}-${i}`} line={l} />
              ))}
            </ul>
          </details>
        );
      })}

      {grouped.uncategorized.length > 0 && (
        <details
          open
          data-testid="csi-section-uncategorized"
          className="rounded-lg border border-hivis/30 bg-ink-950/30"
        >
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-sm uppercase tracking-tight text-hivis">
              Uncategorized / needs review
            </span>
            <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-ink-400">
              <span>
                {grouped.uncategorized.length}{" "}
                {grouped.uncategorized.length === 1 ? "line" : "lines"}
              </span>
              <CaretDown size={12} weight="bold" className="shrink-0" />
            </span>
          </summary>
          <p className="px-3 text-xs text-ink-300">
            Needs review — not confidently mapped to a division. These lines are
            shown in full and excluded from the divisions above; nothing is
            guessed or hidden.
          </p>
          <ul className="px-3 pb-2 pt-1">
            {grouped.uncategorized.map((l, i) => (
              <LineRow key={`${l.source_description}-${i}`} line={l} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
