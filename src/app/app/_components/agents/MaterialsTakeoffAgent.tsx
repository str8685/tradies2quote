"use client";

import { useState } from "react";
import {
  Stack,
  Warning,
  Spinner,
  ListChecks,
  Sparkle,
} from "@phosphor-icons/react";
import { CopyButton } from "./CopyButton";
import type { TakeoffResult } from "@/lib/agents/materials-takeoff";

/**
 * Materials / Takeoff Agent — paste a job description, get a structured
 * materials list with NZ trade vocab + AI-estimate flags.
 *
 * Real backend: POSTs to `/api/agents/materials-takeoff` (Anthropic
 * Claude). NEVER fakes supplier prices — the user pulls those from
 * their materials library. The output is paste-ready as quote-note
 * text or as a CSV the user can hand-import.
 */
const UNIT_LABELS: Record<string, string> = {
  each: "ea",
  lm: "lm",
  m2: "m²",
  m3: "m³",
  kg: "kg",
  bag: "bag",
  sheet: "sheet",
  roll: "roll",
  litre: "L",
  hr: "hr",
  day: "day",
};

function takeoffToText(result: TakeoffResult): string {
  const lines: string[] = [];
  lines.push("Materials takeoff");
  lines.push("");
  for (const l of result.lines) {
    const q =
      l.quantity !== null ? `${l.quantity} ${UNIT_LABELS[l.unit ?? "each"] ?? l.unit ?? ""}` : "?";
    const tag = l.ai_estimated ? " [T2Q estimate]" : "";
    const note = l.note ? ` — ${l.note}` : "";
    lines.push(`• ${l.description} (${q})${tag}${note}`);
  }
  if (result.assumptions.length > 0) {
    lines.push("", "Assumptions:");
    for (const a of result.assumptions) lines.push(`• ${a}`);
  }
  if (result.reviewFlags.length > 0) {
    lines.push("", "Review flags:");
    for (const f of result.reviewFlags) lines.push(`• ${f.message}`);
  }
  return lines.join("\n");
}

export function MaterialsTakeoffAgent() {
  const [jobText, setJobText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TakeoffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = jobText.trim().length > 0 && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agents/materials-takeoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobText, country: "NZ" }),
      });
      const json = (await res.json()) as
        | { ok: true; result: TakeoffResult }
        | { error: string };
      if (!res.ok || !("ok" in json)) {
        setError(("error" in json && json.error) || `Request failed (${res.status})`);
      } else {
        setResult(json.result);
      }
    } catch (err) {
      setError((err as Error).message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      data-testid="materials-takeoff-agent"
      className="t2q-card-pro p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-brand/40 bg-brand/10 text-brand">
          <Stack size={20} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg uppercase tracking-tight text-white sm:text-xl">
            Materials &amp; Takeoff Agent
          </h2>
          <p className="mt-1 text-sm text-ink-300">
            Describe the job in plain English. We&apos;ll extract likely materials,
            quantities, and review flags. NZ trade terms supported (GIB, H3.2,
            Pink Batts, framing, fixings, paint, plaster). We never invent
            supplier prices — pull those from your materials library.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-5">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
            Job description
          </span>
          <textarea
            data-testid="materials-takeoff-input"
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="e.g. Re-line the master bedroom — strip the old GIB on three walls, replace with 13mm GIB Aqualine where it borders the bathroom, otherwise 10mm standard. Pink Batts R3.2 in the cavity. New 90x45 H1.2 framing for the door blocking."
            rows={7}
            maxLength={10000}
            className="mt-2 block w-full rounded-sm border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-white placeholder:text-ink-500 focus:border-brand focus:outline-none"
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
            {jobText.trim().length} / 10000
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            data-testid="materials-takeoff-submit"
            className="inline-flex h-10 items-center gap-2 rounded-sm bg-brand px-4 font-display text-sm uppercase tracking-tight text-ink-900 transition-colors hover:bg-hivis disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400"
          >
            {submitting ? (
              <>
                <Spinner size={14} weight="bold" className="animate-spin" />
                Extracting…
              </>
            ) : (
              <>
                <ListChecks size={14} weight="bold" />
                Extract materials
              </>
            )}
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          data-testid="materials-takeoff-error"
          className="mt-5 rounded-sm border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-200"
        >
          <Warning size={14} weight="bold" className="mr-1 inline-block" />
          {error}
        </div>
      )}

      {result && (
        <div data-testid="materials-takeoff-result" className="mt-5 space-y-4">
          {result.understoodAs && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-400">
              {"// understood as · "}
              {result.understoodAs}
            </p>
          )}
          <div className="rounded-sm border border-ink-600 bg-ink-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-ink-400">
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                    Description
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                    Qty
                  </th>
                  <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-3 py-4 text-center text-ink-400"
                    >
                      No materials extracted. Try a longer description.
                    </td>
                  </tr>
                ) : (
                  result.lines.map((l, i) => (
                    <tr key={i} className="border-b border-ink-800 last:border-0">
                      <td className="px-3 py-2 text-ink-100">
                        {l.description}
                        {l.ai_estimated && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-sm border border-hivis/40 bg-hivis/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-hivis">
                            <Sparkle size={9} weight="fill" />
                            T2Q estimate
                          </span>
                        )}
                        {l.note && (
                          <span className="block text-xs text-ink-400">
                            {l.note}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-ink-200">
                        {l.quantity ?? "?"}
                      </td>
                      <td className="px-3 py-2 text-ink-200">
                        {UNIT_LABELS[l.unit ?? "each"] ?? l.unit ?? ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {result.assumptions.length > 0 && (
            <div className="rounded-sm border border-ink-600 bg-ink-900/60 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-300">
                Assumptions made
              </div>
              <ul className="space-y-1 text-sm text-ink-200">
                {result.assumptions.map((a, i) => (
                  <li key={i} className="list-inside list-disc">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.reviewFlags.length > 0 && (
            <div className="rounded-sm border border-hivis/40 bg-hivis/5 p-4">
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-hivis">
                <Warning size={12} weight="bold" />
                Review on site
              </div>
              <ul className="space-y-1 text-sm text-ink-200">
                {result.reviewFlags.map((f, i) => (
                  <li key={i} className="list-inside list-disc">
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton
              text={takeoffToText(result)}
              testId="materials-takeoff-copy"
              label="Copy as text"
            />
          </div>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-ink-500">
            {"// no supplier prices invented · pull real prices from your materials library"}
          </p>
        </div>
      )}
    </section>
  );
}
