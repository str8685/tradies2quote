// ─────────────────────────────────────────────────────────────────────────
// Weekly "your AI is learning" digest — pure renderer.
//
// The flywheel runs itself: every quote you save already teaches Tradie Brain
// (ingestFromQuoteSave). This turns that invisible learning into a once-a-week
// email so you can SEE it compounding without digging into anything — and
// surfaces the corrections worth promoting into the eval set.
//
// Pure + deterministic (no clock, no I/O) so it's trivially unit-testable.
// Data is gathered by collect.ts and passed in.
// ─────────────────────────────────────────────────────────────────────────

export type CorrectionItem = {
  /** "unit_price" | "description" */
  field: string;
  description: string;
  from: string;
  to: string;
};

export type PriceItem = {
  material: string;
  price: number;
  unit?: string | null;
};

export type AgentStat = {
  name: string;
  total: number;
  failed: number;
};

export interface WeeklyDigestData {
  windowDays: number;
  memoriesTotal: number;
  memoriesNewThisWeek: number;
  topCorrections: CorrectionItem[];
  topPrices: PriceItem[];
  agentStats: AgentStat[];
}

export interface RenderedDigest {
  subject: string;
  text: string;
  html: string;
}

function money(n: number): string {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function agentSuccessPct(stats: AgentStat[]): number | null {
  const total = stats.reduce((s, a) => s + a.total, 0);
  if (total === 0) return null;
  const failed = stats.reduce((s, a) => s + a.failed, 0);
  return Math.round(((total - failed) / total) * 100);
}

/**
 * Turn captured corrections into plain-English eval-case seeds. These are the
 * "AI got it wrong, the tradie fixed it" pairs — exactly what should be added
 * to the golden eval set so the same mistake gets caught next time.
 */
export function correctionsToEvalSuggestions(
  corrections: CorrectionItem[],
): string[] {
  return corrections.map((c) => {
    if (c.field === "unit_price") {
      return `"${c.description}" → price ${c.to} (you corrected ${c.from}).`;
    }
    return `Rename "${c.from}" → "${c.to}".`;
  });
}

export function buildWeeklyDigest(d: WeeklyDigestData): RenderedDigest {
  const pct = agentSuccessPct(d.agentStats);
  const evalSeeds = correctionsToEvalSuggestions(d.topCorrections);

  const subject =
    d.memoriesNewThisWeek > 0
      ? `T2Q weekly — ${d.memoriesNewThisWeek} new thing${d.memoriesNewThisWeek === 1 ? "" : "s"} learned${pct != null ? ` · ${pct}% agent success` : ""}`
      : `T2Q weekly — flywheel idle this week`;

  // ── plain text ──
  const textLines: string[] = [];
  textLines.push("YOUR AI THIS WEEK");
  textLines.push("");
  textLines.push(
    `Learned this week: ${d.memoriesNewThisWeek} (total it now remembers: ${d.memoriesTotal})`,
  );
  if (pct != null) {
    const total = d.agentStats.reduce((s, a) => s + a.total, 0);
    textLines.push(`Agent runs: ${total} · ${pct}% succeeded`);
  }
  textLines.push("");

  if (d.topCorrections.length > 0) {
    textLines.push("IT LEARNED YOUR CORRECTIONS:");
    for (const c of d.topCorrections) {
      textLines.push(
        c.field === "unit_price"
          ? `  • "${c.description}": ${c.from} → ${c.to}`
          : `  • "${c.from}" → "${c.to}"`,
      );
    }
    textLines.push("");
  }

  if (d.topPrices.length > 0) {
    textLines.push("PRICES IT NOW KNOWS ARE YOURS:");
    for (const p of d.topPrices) {
      textLines.push(`  • ${p.material}: ${money(p.price)}${p.unit ? ` / ${p.unit}` : ""}`);
    }
    textLines.push("");
  }

  if (d.agentStats.length > 0) {
    textLines.push("AGENT HEALTH:");
    for (const a of d.agentStats) {
      const ok = a.total - a.failed;
      textLines.push(`  • ${a.name}: ${ok}/${a.total} ok${a.failed > 0 ? ` (${a.failed} failed — worth a look)` : ""}`);
    }
    textLines.push("");
  }

  if (evalSeeds.length > 0) {
    textLines.push("WORTH ADDING TO THE EVAL SET (so the AI never repeats these):");
    for (const s of evalSeeds) textLines.push(`  • ${s}`);
    textLines.push("");
  }

  textLines.push("Nothing for you to do — this runs itself every week.");

  // ── html ──
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const section = (title: string, items: string[]) =>
    items.length === 0
      ? ""
      : `<h3 style="font:600 13px system-ui;letter-spacing:.04em;text-transform:uppercase;color:#FF5F15;margin:18px 0 6px">${esc(title)}</h3><ul style="margin:0;padding-left:18px;color:#222;font:14px system-ui;line-height:1.6">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

  const html = `<div style="max-width:560px;margin:0 auto;font:14px system-ui;color:#222">
    <h2 style="font:800 20px system-ui;margin:0 0 4px">Your AI this week</h2>
    <p style="color:#555;margin:0 0 8px">Learned this week: <strong>${d.memoriesNewThisWeek}</strong> · total remembered: <strong>${d.memoriesTotal}</strong>${pct != null ? ` · agent success <strong>${pct}%</strong>` : ""}</p>
    ${section(
      "It learned your corrections",
      d.topCorrections.map((c) =>
        c.field === "unit_price"
          ? `"${c.description}": ${c.from} → ${c.to}`
          : `"${c.from}" → "${c.to}"`,
      ),
    )}
    ${section(
      "Prices it now knows are yours",
      d.topPrices.map((p) => `${p.material}: ${money(p.price)}${p.unit ? ` / ${p.unit}` : ""}`),
    )}
    ${section(
      "Agent health",
      d.agentStats.map((a) => `${a.name}: ${a.total - a.failed}/${a.total} ok${a.failed > 0 ? ` (${a.failed} failed)` : ""}`),
    )}
    ${section("Worth adding to the eval set", evalSeeds)}
    <p style="color:#888;font-size:12px;margin-top:18px">Nothing for you to do — this runs itself every week.</p>
  </div>`;

  return { subject, text: textLines.join("\n"), html };
}
