/**
 * Corrections regression eval — the SELF-POPULATING eval set.
 *
 * The flywheel captures every price you correct the AI on. This eval reads
 * those corrections LIVE from the DB, turns them into cases, and checks that
 * the memory-injected quote agent now prices each material at YOUR corrected
 * figure — not its old guess. The eval set grows itself: every correction you
 * make is automatically a regression test. Zero curation.
 *
 * Gated behind RUN_CORRECTIONS_EVAL so it never runs in `npm test`/CI.
 *
 *   npm run eval:corrections
 *
 * Needs: ANTHROPIC_API_KEY, Supabase service-role creds (for the admin read),
 * and it sets TRADIE_BRAIN_ENABLED=true so memory is consumed. Skips cleanly if
 * creds are missing or there are no captured corrections yet.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { correctionsToEvalCases } from "@/lib/digest/evalSeeds";
import type { CorrectionItem } from "@/lib/digest/weekly";

const ENABLED = process.env.RUN_CORRECTIONS_EVAL === "1";

function loadEnvKey(key: string): string | null {
  if (process.env[key]) return process.env[key] as string;
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of envFile.split(/\r?\n/)) {
      const m = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+?)\\s*$`));
      if (m) {
        const v = m[1].replace(/^["']|["']$/g, "");
        process.env[key] = v;
        return v;
      }
    }
  } catch {
    // no .env.local
  }
  return null;
}

type Row = { user_id: string; value: Record<string, unknown> };
type Built = { userId: string; corrections: CorrectionItem[] };

async function loadCorrections(): Promise<Built | null> {
  loadEnvKey("ANTHROPIC_API_KEY");
  // The admin client needs service-role creds; bail (skip) if absent.
  const url = loadEnvKey("NEXT_PUBLIC_SUPABASE_URL") ?? loadEnvKey("SUPABASE_URL");
  const key =
    loadEnvKey("SUPABASE_SERVICE_ROLE_KEY") ?? loadEnvKey("SUPABASE_SERVICE_ROLE");
  if (!url || !key || !process.env.ANTHROPIC_API_KEY) return null;

  process.env.TRADIE_BRAIN_ENABLED = "true";
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("tradie_memories")
    .select("user_id, value")
    .eq("status", "active")
    .eq("memory_type", "repeated_correction")
    .limit(25);
  if (error || !data || data.length === 0) return null;

  const rows = data as Row[];
  const userId = rows[0].user_id;
  const corrections: CorrectionItem[] = rows.map((r) => ({
    field: String(r.value?.field ?? "unit_price"),
    description: String(r.value?.description ?? ""),
    from: String(r.value?.from ?? ""),
    to: String(r.value?.to ?? ""),
  }));
  return { userId, corrections };
}

const results: { id: string; respected: boolean; note: string }[] = [];

describe.skipIf(!ENABLED)("corrections regression eval", () => {
  it("checks the memory-injected agent respects captured price corrections", async () => {
    const built = await loadCorrections();
    if (!built) {
      console.log(
        "\n[corrections-eval] skipped — need ANTHROPIC_API_KEY + Supabase service-role creds + at least one captured correction.\n",
      );
      return;
    }

    const cases = correctionsToEvalCases(built.corrections).slice(0, 6);
    if (cases.length === 0) {
      console.log("\n[corrections-eval] no price corrections captured yet.\n");
      return;
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? (process.env.SUPABASE_URL as string),
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
        (process.env.SUPABASE_SERVICE_ROLE as string),
    );
    const { runQuoteGenerationAgent } = await import(
      "@/lib/agents/quote-generation"
    );

    for (const c of cases) {
      const quote = await runQuoteGenerationAgent({
        transcript: c.transcript,
        memory: { supabase: admin, userId: built.userId },
      });
      // Find the line that best matches the corrected material.
      const tokens = c.material.toLowerCase().split(/\s+/).filter(Boolean);
      const line = quote.lineItems.find((l) => {
        const d = l.description.toLowerCase();
        return tokens.some((t) => d.includes(t));
      });
      const price = line?.unitPrice ?? null;
      // "Respected" = priced within 15% of the corrected figure, OR strictly
      // closer to the corrected price than to the AI's old guess.
      const within =
        price != null && Math.abs(price - c.expected) / c.expected <= 0.15;
      const closer =
        price != null &&
        c.was != null &&
        Math.abs(price - c.expected) < Math.abs(price - c.was);
      const respected = !!(within || closer);
      results.push({
        id: c.id,
        respected,
        note:
          price == null
            ? "no matching line"
            : `priced ${price} (you said ${c.expected}${c.was != null ? `, AI used ${c.was}` : ""})`,
      });
      expect(respected, `${c.material}: ${price} vs corrected ${c.expected}`).toBe(true);
    }
  }, 300_000);

  afterAll(() => {
    if (results.length === 0) return;
    const ok = results.filter((r) => r.respected).length;
    console.log(
      [
        "",
        "── CORRECTIONS REGRESSION EVAL ───────────────────",
        ...results.map((r) => `  ${r.respected ? "✅" : "❌"} ${r.id.padEnd(20)} ${r.note}`),
        "──────────────────────────────────────────────────",
        `  respected: ${ok}/${results.length}`,
        "──────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
  });
});
