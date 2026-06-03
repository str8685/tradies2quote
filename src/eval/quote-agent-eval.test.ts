/**
 * Quote-generation AGENT eval — RUNS A REAL CLAUDE CALL per case.
 *
 * Proves the refactored agent (structured tool output via runStructuredAgent)
 * returns quotes that are STRUCTURALLY VALID and RECONCILE — i.e. the numbers
 * add up — across a spread of transcripts. This is the "did it improve"
 * measure for Phase 1: the old JSON-parse path could return malformed or
 * non-reconciling quotes; the tool-output path should not.
 *
 * Gated behind RUN_QUOTE_AGENT_EVAL so it never runs in `npm test`/CI.
 * Run it deliberately:
 *
 *   npm run eval:quote-agent
 *
 * Needs ANTHROPIC_API_KEY (shell env or .env.local).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  runQuoteGenerationAgent,
  type GeneratedQuote,
} from "@/lib/agents/quote-generation";

const ENABLED = process.env.RUN_QUOTE_AGENT_EVAL === "1";

/** Ensure ANTHROPIC_API_KEY is in process.env (the agent reads it directly). */
function ensureApiKey(): boolean {
  if (process.env.ANTHROPIC_API_KEY) return true;
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const m = line.match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) {
        process.env.ANTHROPIC_API_KEY = m[1].replace(/^["']|["']$/g, "");
        return true;
      }
    }
  } catch {
    // no .env.local
  }
  return false;
}

type AgentCase = {
  id: string;
  transcript: string;
  /** Lowercase substrings — at least one line description must contain each. */
  mustMention: string[];
  /** Require a labour line. */
  needsLabour?: boolean;
};

const CASES: AgentCase[] = [
  {
    id: "deck",
    transcript:
      "Building a 6 by 4 metre treated pine deck, H3.2 framing, 140 by 19 decking, joist hangers, stainless screws, about a day and a half labour for me and a hand.",
    mustMention: ["deck", "joist"],
    needsLabour: true,
  },
  {
    id: "gib-reline",
    transcript:
      "Re-line a bathroom, strip the old gib, put up Aqualine 13mm, stopping and one coat, roughly 18 square metres of wall and ceiling, half a day labour.",
    mustMention: ["gib"],
    needsLabour: true,
  },
  {
    id: "fence",
    transcript:
      "24 metres of 1.8 metre high paling fence, H4 posts at 2.4 centres, rails and palings, two gates, concrete the posts in.",
    mustMention: ["post", "paling"],
  },
];

const ALLOWED_CATEGORIES = new Set([
  "materials",
  "labour",
  "subcontractor",
  "sundries",
]);

type CaseResult = { id: string; reconciles: boolean; checks: boolean; note: string };
const results: CaseResult[] = [];

const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol;

function reconciles(q: GeneratedQuote): { ok: boolean; why: string } {
  if (q.lineItems.length === 0) return { ok: false, why: "no line items" };
  const sumLines = q.lineItems.reduce((s, l) => s + l.lineTotal, 0);
  if (!near(q.subtotal, sumLines)) {
    return { ok: false, why: `subtotal ${q.subtotal} ≠ Σlines ${sumLines.toFixed(2)}` };
  }
  if (!near(q.gstAmount, q.subtotal * 0.15)) {
    return { ok: false, why: `gst ${q.gstAmount} ≠ 15% of subtotal` };
  }
  if (!near(q.total, q.subtotal + q.gstAmount)) {
    return { ok: false, why: `total ${q.total} ≠ subtotal+gst` };
  }
  if (q.gstRate !== 0.15) return { ok: false, why: "gstRate not 0.15" };
  const zero = q.lineItems.find((l) => l.unitPrice <= 0);
  if (zero) return { ok: false, why: `zero price on "${zero.description}"` };
  const badCat = q.lineItems.find((l) => !ALLOWED_CATEGORIES.has(l.category));
  if (badCat) return { ok: false, why: `bad category "${badCat.category}"` };
  return { ok: true, why: "" };
}

describe.skipIf(!ENABLED)("quote-generation agent eval", () => {
  const haveKey = ensureApiKey();

  it("has an API key", () => {
    expect(haveKey, "Set ANTHROPIC_API_KEY in env or .env.local").toBe(true);
  });

  for (const c of CASES) {
    it.skipIf(!haveKey)(
      `${c.id} — reconciles + covers scope`,
      async () => {
        const q = await runQuoteGenerationAgent({ transcript: c.transcript });

        const rec = reconciles(q);
        const blob = q.lineItems
          .map((l) => l.description.toLowerCase())
          .join(" | ");
        const mentionsOk = c.mustMention.every((m) => blob.includes(m));
        const labourOk =
          !c.needsLabour || q.lineItems.some((l) => l.category === "labour");
        const checksOk = mentionsOk && labourOk;

        results.push({
          id: c.id,
          reconciles: rec.ok,
          checks: checksOk,
          note: rec.ok
            ? `${q.lineItems.length} lines · $${q.total}`
            : rec.why,
        });

        expect(rec.ok, `does not reconcile: ${rec.why}`).toBe(true);
        expect(mentionsOk, `missing scope items (${c.mustMention.join(", ")}) in: ${blob}`).toBe(true);
        expect(labourOk, "expected a labour line").toBe(true);
      },
      120_000,
    );
  }

  afterAll(() => {
    if (results.length === 0) return;
    const rec = results.filter((r) => r.reconciles).length;
    const chk = results.filter((r) => r.checks).length;
    console.log(
      [
        "",
        "── QUOTE-AGENT EVAL ──────────────────────────────",
        ...results.map(
          (r) => `  ${r.reconciles && r.checks ? "✅" : "❌"} ${r.id.padEnd(12)} ${r.note}`,
        ),
        "──────────────────────────────────────────────────",
        `  reconciles: ${rec}/${results.length}`,
        `  scope:      ${chk}/${results.length}`,
        "──────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  });
});
