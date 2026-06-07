// ── Pat — field-planning assistant ─────────────────────────────────────────
// AGENT BOUNDARY: Pat INTERPRETS the deterministic weather assessment for the
// tradie. Pat does NOT fetch weather, does NOT set or change thresholds, and is
// NOT the source of truth for risk — the risk engine already decided that. Pat
// only turns the structured verdict into a practical next step. Runs through the
// shared runStructuredAgent runtime (forced JSON tool output + one retry).

import "server-only";
import { runStructuredAgent, type ParseResult } from "./runtime";
import type {
  AlternateJob,
  ForecastSnapshot,
  JobPayload,
  PatOutput,
  WeatherAssessment,
} from "@/lib/weather-planning/types";

const SYSTEM_PROMPT = `You are Pat, the field-planning assistant inside Tradies2Quote.

Your job is to interpret structured weather risk for a scheduled trade job and give practical, low-waffle operational advice.

You are not a raw weather forecaster.
You are not allowed to invent weather facts.
You are not allowed to change risk thresholds.
You must rely on the provided assessment, triggers_fired, and forecast summary.

Your goals:
1. Explain what the weather means for the job.
2. Recommend the best next action for the tradie.
3. Suggest fallback options if the job is risky.
4. Keep the answer short, useful, and job-focused.

Output format:
- risk_headline
- why_it_matters
- recommended_action
- alternate_option
- crew_note
- confidence

Rules:
- Be practical, not dramatic.
- Prefer actions like proceed, proceed with caution, swap jobs, move earlier, or reschedule.
- Mention safety only when the structured data shows real risk.
- If risk is low, say so clearly.
- If schedule context contains alternate jobs, use them.
- Keep language tradie-friendly.`;

const PAT_TOOL = {
  name: "emit_pat_plan",
  description: "Return Pat's field-planning interpretation of the weather assessment.",
  schema: {
    type: "object",
    required: ["risk_headline", "why_it_matters", "recommended_action", "alternate_option", "crew_note", "confidence"],
    additionalProperties: false,
    properties: {
      risk_headline: { type: "string", description: "One-line headline of the weather impact." },
      why_it_matters: { type: "string", description: "Short plain reason it matters for THIS job." },
      recommended_action: { type: "string", description: "Best next step: proceed, proceed with caution, move earlier, swap jobs, or reschedule." },
      alternate_option: { type: "string", description: "A fallback option (e.g. a specific alternate job), or 'None needed'." },
      crew_note: { type: "string", description: "Short note to pass to the crew." },
      confidence: { type: "string", description: "low | medium | high." },
    },
  },
} as const;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

export function parsePat(input: unknown): ParseResult<PatOutput> {
  const o = (input ?? {}) as Record<string, unknown>;
  const headline = str(o.risk_headline);
  const action = str(o.recommended_action);
  if (!headline) return { ok: false, error: "risk_headline is required" };
  if (!action) return { ok: false, error: "recommended_action is required" };
  return {
    ok: true,
    value: {
      risk_headline: headline,
      why_it_matters: str(o.why_it_matters, "See the forecast triggers."),
      recommended_action: action,
      alternate_option: str(o.alternate_option, "None needed"),
      crew_note: str(o.crew_note, ""),
      confidence: str(o.confidence, "medium"),
    },
  };
}

export interface RunPatArgs {
  job: JobPayload;
  forecast: ForecastSnapshot;
  assessment: WeatherAssessment;
  alternateJobs?: AlternateJob[];
  userId?: string;
  quoteId?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export async function runPat(args: RunPatArgs): Promise<{ value: PatOutput; model: string }> {
  const user = `Assess this job for field impact.

Job:
${JSON.stringify(args.job, null, 2)}

Forecast summary:
${JSON.stringify(args.forecast, null, 2)}

Assessment:
${JSON.stringify(args.assessment, null, 2)}

Schedule context:
${JSON.stringify({ alternate_jobs: args.alternateJobs ?? [] }, null, 2)}

Return the output by calling emit_pat_plan with keys:
risk_headline, why_it_matters, recommended_action, alternate_option, crew_note, confidence`;

  const result = await runStructuredAgent<PatOutput>({
    agentName: "Pat (field planning)",
    system: SYSTEM_PROMPT,
    user,
    tool: PAT_TOOL,
    parse: parsePat,
    maxTokens: 1024,
    userId: args.userId,
    quoteId: args.quoteId,
    apiKey: args.apiKey,
    fetchImpl: args.fetchImpl,
  });
  return { value: result.value, model: result.model };
}
