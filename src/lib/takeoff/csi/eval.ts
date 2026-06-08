// ─────────────────────────────────────────────────────────────────────────
// CSI mapper — fixture evaluation harness (DEV/TEST ONLY).
//
// Pure + deterministic. Runs the real `mapLinesToCsi` over labelled fixture
// line items and MEASURES how the Stage-1 taxonomy performs — it never
// guesses and never mutates. Used by src/eval/csi-mapper-eval.test.ts.
//
// "Accuracy" here = the mapper put each labelled line in the division we
// expected (where "uncategorized" is a legitimate expected label for
// genuinely-ambiguous or non-material lines — a correctly-uncategorized line
// is a MATCH, not a miss). `mismatches` are genuine wrong mappings and should
// stay empty; `manualReview` and `futureCandidates` surface lines a human /
// future taxonomy pass should look at, WITHOUT pretending they are solved.
// ─────────────────────────────────────────────────────────────────────────

import { mapLinesToCsi } from "./map";
import type { CsiDivision, CsiProvenance, CsiSourceLine } from "./contracts";

/** An expected division label — the 5 real divisions or "uncategorized". */
export type CsiExpectation = CsiDivision;

export interface CsiEvalCase {
  description: string;
  /** Extra line fields (type, takeoff_status, quantity_source, …). */
  line?: Omit<Partial<CsiSourceLine>, "description">;
  /** The division we expect Stage-1 to produce for this line. */
  expected: CsiExpectation;
  /**
   * Uncategorized-by-design TODAY, but a real material that may warrant a
   * future taxonomy rule. Reported separately; never counted as a miss.
   */
  futureCandidate?: boolean;
  /** Display grouping for the report (concrete / framing / deck / …). */
  group?: string;
}

type MappedDivision = Exclude<CsiDivision, "uncategorized">;

export interface CsiEvalSummary {
  total: number;
  /** Count of correctly+actually mapped lines per real division. */
  byDivision: Record<MappedDivision, number>;
  mapped: number;
  /** All lines whose actual division is "uncategorized". */
  uncategorized: number;
  /** Non-material (labour/other) lines — excluded from CSI by design. */
  nonMaterial: number;
  /** Ambiguous MATERIAL lines needing a human/taxonomy decision
   *  (= uncategorized − nonMaterial). */
  manualReview: number;
  /** Lines carrying takeoff_status "blocked" (state preserved through map). */
  blocked: number;
  provenance: Record<CsiProvenance, number>;
  /** matched / total, where matched = actual division === expected. */
  accuracy: number;
  /** Genuine wrong mappings — should be empty. */
  mismatches: Array<{
    description: string;
    expected: CsiExpectation;
    actual: CsiDivision;
  }>;
  /** Uncategorized lines explicitly flagged as future-taxonomy candidates. */
  futureCandidates: string[];
}

const EMPTY_DIVISIONS: Record<MappedDivision, number> = {
  "03_concrete": 0,
  "05_metals": 0,
  "06_wood_plastics": 0,
  "07_thermal_moisture": 0,
  "09_finishes": 0,
};

const EMPTY_PROVENANCE: Record<CsiProvenance, number> = {
  calculated: 0,
  supplier: 0,
  user: 0,
  ai_estimated: 0,
  blocked: 0,
  unknown: 0,
};

/**
 * Run the real mapper over each labelled case and aggregate a measured
 * summary. Mapping is per-line independent, so mapping each case as a
 * single-line quote is faithful to the production path.
 */
export function evaluateCsiMapping(
  cases: readonly CsiEvalCase[],
): CsiEvalSummary {
  const byDivision = { ...EMPTY_DIVISIONS };
  const provenance = { ...EMPTY_PROVENANCE };
  const mismatches: CsiEvalSummary["mismatches"] = [];
  const futureCandidates: string[] = [];
  let uncategorized = 0;
  let nonMaterial = 0;
  let blocked = 0;
  let matched = 0;

  for (const c of cases) {
    const src: CsiSourceLine = { description: c.description, ...(c.line ?? {}) };
    const grouped = mapLinesToCsi([src]);
    const mappedLine =
      grouped.divisions[0]?.lines[0] ?? grouped.uncategorized[0];
    const actual = mappedLine.division;

    if (actual === "uncategorized") {
      uncategorized += 1;
      const isNonMaterial =
        mappedLine.mapping_basis[0]?.startsWith("non-material:") ?? false;
      if (isNonMaterial) nonMaterial += 1;
      if (c.futureCandidate) futureCandidates.push(c.description);
    } else {
      byDivision[actual] += 1;
    }

    provenance[mappedLine.provenance] += 1;
    if (mappedLine.takeoff_status === "blocked") blocked += 1;

    if (actual === c.expected) matched += 1;
    else mismatches.push({ description: c.description, expected: c.expected, actual });
  }

  const total = cases.length;
  return {
    total,
    byDivision,
    mapped: total - uncategorized,
    uncategorized,
    nonMaterial,
    manualReview: uncategorized - nonMaterial,
    blocked,
    provenance,
    accuracy: total === 0 ? 1 : matched / total,
    mismatches,
    futureCandidates,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Label-FREE summary — for REAL quote line items, which carry no expected
// label. Measures the same distribution + surfaces the actual uncategorized
// strings so a human can spot repeated patterns worth a future rule. Pure +
// non-mutating; used by the owner-scoped debug path and the real-quote runner.
// ─────────────────────────────────────────────────────────────────────────

export interface CsiLineSummary {
  total: number;
  byDivision: Record<MappedDivision, number>;
  mapped: number;
  uncategorized: number;
  nonMaterial: number;
  manualReview: number;
  blocked: number;
  provenance: Record<CsiProvenance, number>;
  /** Most-common uncategorized MATERIAL descriptions (non-material excluded). */
  topUncategorized: Array<{ description: string; count: number }>;
}

export function summariseCsiLines(
  lines: readonly CsiSourceLine[],
  opts: { topN?: number } = {},
): CsiLineSummary {
  const topN = opts.topN ?? 20;
  const byDivision = { ...EMPTY_DIVISIONS };
  const provenance = { ...EMPTY_PROVENANCE };
  const uncatCounts = new Map<string, number>();
  let uncategorized = 0;
  let nonMaterial = 0;
  let blocked = 0;

  for (const line of lines) {
    const grouped = mapLinesToCsi([line]);
    const mapped = grouped.divisions[0]?.lines[0] ?? grouped.uncategorized[0];

    if (mapped.division === "uncategorized") {
      uncategorized += 1;
      const isNonMaterial =
        mapped.mapping_basis[0]?.startsWith("non-material:") ?? false;
      if (isNonMaterial) {
        nonMaterial += 1;
      } else {
        // Aggregate ambiguous MATERIAL strings (trimmed, case-folded key).
        const key = (line.description ?? "").trim();
        if (key) uncatCounts.set(key, (uncatCounts.get(key) ?? 0) + 1);
      }
    } else {
      byDivision[mapped.division] += 1;
    }

    provenance[mapped.provenance] += 1;
    if (mapped.takeoff_status === "blocked") blocked += 1;
  }

  const topUncategorized = [...uncatCounts.entries()]
    .map(([description, count]) => ({ description, count }))
    .sort((a, b) => b.count - a.count || a.description.localeCompare(b.description))
    .slice(0, topN);

  const total = lines.length;
  return {
    total,
    byDivision,
    mapped: total - uncategorized,
    uncategorized,
    nonMaterial,
    manualReview: uncategorized - nonMaterial,
    blocked,
    provenance,
    topUncategorized,
  };
}

export function formatCsiLineReport(summary: CsiLineSummary): string {
  const lines: string[] = [
    "── CSI mapper — real quote lines ───────────────────────────",
    `total lines        ${summary.total}`,
    `mapped             ${summary.mapped}`,
    `  03 concrete      ${summary.byDivision["03_concrete"]}`,
    `  05 metals        ${summary.byDivision["05_metals"]}`,
    `  06 wood/plastics ${summary.byDivision["06_wood_plastics"]}`,
    `  07 thermal/moist ${summary.byDivision["07_thermal_moisture"]}`,
    `  09 finishes      ${summary.byDivision["09_finishes"]}`,
    `uncategorized      ${summary.uncategorized}`,
    `  non-material     ${summary.nonMaterial}`,
    `  manual-review    ${summary.manualReview}`,
    `blocked (preserved)${summary.blocked}`,
    "provenance:",
  ];
  for (const [k, v] of Object.entries(summary.provenance)) {
    if (v > 0) lines.push(`  ${k.padEnd(13)} ${v}`);
  }
  lines.push("top uncategorized material strings (description × count):");
  for (const u of summary.topUncategorized) {
    lines.push(`  ${String(u.count).padStart(3)} × "${u.description}"`);
  }
  lines.push("────────────────────────────────────────────────────────────");
  return lines.join("\n");
}

/** Human-readable report for the gated verbose runner. */
export function formatCsiEvalReport(summary: CsiEvalSummary): string {
  const pct = (summary.accuracy * 100).toFixed(1);
  const lines: string[] = [
    "── CSI mapper eval ─────────────────────────────────────────",
    `total lines        ${summary.total}`,
    `mapped             ${summary.mapped}`,
    `  03 concrete      ${summary.byDivision["03_concrete"]}`,
    `  05 metals        ${summary.byDivision["05_metals"]}`,
    `  06 wood/plastics ${summary.byDivision["06_wood_plastics"]}`,
    `  07 thermal/moist ${summary.byDivision["07_thermal_moisture"]}`,
    `  09 finishes      ${summary.byDivision["09_finishes"]}`,
    `uncategorized      ${summary.uncategorized}`,
    `  non-material     ${summary.nonMaterial}`,
    `  manual-review    ${summary.manualReview}`,
    `blocked (preserved)${summary.blocked}`,
    `accuracy           ${pct}%  (${summary.total - summary.mismatches.length}/${summary.total} as labelled)`,
  ];
  if (summary.mismatches.length) {
    lines.push("MISMATCHES (wrong division — should be none):");
    for (const m of summary.mismatches) {
      lines.push(`  ✗ "${m.description}"  expected ${m.expected} → got ${m.actual}`);
    }
  }
  if (summary.futureCandidates.length) {
    lines.push("future taxonomy candidates (uncategorized today, by design):");
    for (const d of summary.futureCandidates) lines.push(`  • "${d}"`);
  }
  lines.push("provenance:");
  for (const [k, v] of Object.entries(summary.provenance)) {
    if (v > 0) lines.push(`  ${k.padEnd(13)} ${v}`);
  }
  lines.push("────────────────────────────────────────────────────────────");
  return lines.join("\n");
}
