// ─────────────────────────────────────────────────────────────────────────
// Plan-reader — title-block parsing (Phase 2, pure + deterministic).
//
// A title block is the boxed metadata panel (usually bottom-right) on a plan
// sheet: project name, sheet number/title, scale, date, drawer. We parse the
// OCR'd text of that block into structured fields. Missing fields stay absent
// — we never fabricate a sheet number or project name.
// ─────────────────────────────────────────────────────────────────────────

import { parseScale, type ParsedScale } from "./scale";
import type { LengthUnit } from "./schema";

export type ParsedTitleBlock = {
  fields: Record<string, string>;
  /** e.g. "A-101", "S2.01" — the drawing's own sheet id, if present. */
  sheet_label: string | null;
  scale: ParsedScale;
  units: LengthUnit | null;
};

/** Label → canonical field-key patterns we look for, line by line. */
const FIELD_PATTERNS: Array<{ key: string; re: RegExp }> = [
  { key: "project", re: /\b(project|job)\s*(?:name)?\s*[:#-]\s*(.+)/i },
  { key: "client", re: /\bclient\s*[:#-]\s*(.+)/i },
  { key: "sheet_title", re: /\b(?:drawing|sheet)\s*title\s*[:#-]\s*(.+)/i },
  { key: "sheet_number", re: /\b(?:sheet|drawing|dwg)\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z]{0,3}[-.]?\d{1,3}(?:\.\d+)?)/i },
  { key: "scale", re: /\bscale\s*[:#-]\s*(.+)/i },
  { key: "date", re: /\bdate\s*[:#-]\s*(.+)/i },
  { key: "drawn_by", re: /\b(?:drawn|drafted)\s*(?:by)?\s*[:#-]\s*(.+)/i },
  { key: "revision", re: /\b(?:rev|revision)\s*[:#-]?\s*([A-Z0-9]{1,4})/i },
];

/** Standalone sheet-id tokens like "A-101", "S2.01", "A101". */
const SHEET_ID_RE = /\b([A-Z]{1,3})[-.]?(\d{1,3}(?:\.\d+)?)\b/;

function detectUnits(text: string): LengthUnit | null {
  if (/\bmm\b|millimet/i.test(text)) return "mm";
  if (/\bmetres?\b|\bmeters?\b|\bm\b(?!m)/i.test(text)) return "m";
  if (/['′]|feet|foot|\bft\b/i.test(text)) return "ft";
  if (/["″]|inch|\bin\b/i.test(text)) return "in";
  return null;
}

export function parseTitleBlock(raw: string | null | undefined): ParsedTitleBlock {
  const fields: Record<string, string> = {};
  const text = (raw ?? "").trim();
  if (!text) {
    return { fields, sheet_label: null, scale: parseScale(null), units: null };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    for (const { key, re } of FIELD_PATTERNS) {
      if (fields[key]) continue;
      const m = line.match(re);
      if (m) {
        const captured = (m[2] ?? m[1] ?? "").trim();
        if (captured) fields[key] = captured.slice(0, 200);
      }
    }
  }

  // sheet_label: prefer an explicit "sheet number" field, else sniff a token.
  let sheet_label: string | null = fields.sheet_number ?? null;
  if (!sheet_label) {
    const m = text.match(SHEET_ID_RE);
    if (m) sheet_label = `${m[1]}-${m[2]}`;
  }

  // Scale: prefer the labelled "scale:" field; else scan the whole block.
  const scale = parseScale(fields.scale ?? text);

  return {
    fields,
    sheet_label,
    scale,
    units: detectUnits(text),
  };
}
