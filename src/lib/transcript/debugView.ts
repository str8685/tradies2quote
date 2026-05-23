// ─────────────────────────────────────────────────────────────────────────
// Transcript cleanup — owner debug view extractor (pure, NO I/O).
//
// Pulls the persisted transcript layer out of each quote's `quote_data`
// (written by /api/quotes/generate) into a flat, render-ready row:
//   { raw, cleaned, corrections[], clarifications[], confidence }
//
// `quote_data.transcript` is typed `unknown` (to avoid a circular import), so
// every field is narrowed defensively here — a malformed or legacy row never
// throws, it just yields empty fields and is filtered out if there's nothing
// to show.
// ─────────────────────────────────────────────────────────────────────────

import type { QuoteData } from "../quote-types";
import type { Correction, ClarificationItem } from "../transcriptCleanup";

export type TranscriptCleanupRow = {
  id: string;
  createdAt: string;
  raw: string;
  cleaned: string;
  /** 0..1 engine confidence in the cleaned transcript, or null if absent. */
  confidence: number | null;
  corrections: Correction[];
  clarifications: ClarificationItem[];
};

export type QuoteRowInput = {
  id: string;
  created_at: string;
  quote_data: QuoteData | null;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * Map quote rows → transcript cleanup rows. Quotes without a transcript layer
 * (drawing scans, supplier imports, legacy) are dropped. Newest-first order is
 * the caller's responsibility (it reads ordered).
 */
export function toTranscriptCleanupRows(
  rows: QuoteRowInput[],
): TranscriptCleanupRow[] {
  const out: TranscriptCleanupRow[] = [];
  for (const r of rows) {
    const t = (r.quote_data?.transcript ?? null) as Record<string, unknown> | null;
    if (!t || typeof t !== "object") continue;

    const raw = asString(t.raw);
    const cleaned = asString(t.cleaned);
    const corrections = Array.isArray(t.corrections)
      ? (t.corrections as Correction[])
      : [];
    const clarifications = Array.isArray(t.clarification_questions)
      ? (t.clarification_questions as ClarificationItem[])
      : [];

    // Nothing to show → skip (e.g. a quote that never had a voice transcript).
    if (!raw && !cleaned && corrections.length === 0 && clarifications.length === 0) {
      continue;
    }

    out.push({
      id: r.id,
      createdAt: r.created_at,
      raw,
      cleaned,
      confidence: typeof t.confidence === "number" ? t.confidence : null,
      corrections,
      clarifications,
    });
  }
  return out;
}

/** Aggregate counts for the summary panel. */
export function summariseTranscriptRows(rows: TranscriptCleanupRow[]): {
  quotes: number;
  corrections: number;
  clarifications: number;
} {
  return {
    quotes: rows.length,
    corrections: rows.reduce((n, r) => n + r.corrections.length, 0),
    clarifications: rows.reduce((n, r) => n + r.clarifications.length, 0),
  };
}
