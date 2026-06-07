// ── Willa — office / customer-communication assistant ──────────────────────
// AGENT BOUNDARY: Willa DRAFTS customer communication only. Willa does NOT fetch
// weather, does NOT set risk, does NOT send anything. Every output is a DRAFT
// stored with status='draft' for the tradie to review — nothing in this system
// sends a customer message automatically (see customer_message_drafts table +
// docs/weather-planning.md). Willa relies on the assessment + Pat's output.

import "server-only";
import { runStructuredAgent, type ParseResult } from "./runtime";
import type {
  CompanyContext,
  JobPayload,
  PatOutput,
  WeatherAssessment,
  WillaOutput,
} from "@/lib/weather-planning/types";

const SYSTEM_PROMPT = `You are Willa, the office/admin assistant inside Tradies2Quote.

Your job is to handle customer communication and admin follow-up when weather may affect a scheduled trade job.

You are not a weather forecaster.
You are not allowed to invent weather facts.
You are not allowed to exaggerate risk.
You must use the provided assessment and Pat recommendation.

Your goals:
1. Decide whether customer communication is needed.
2. Draft a short message in clear, polite language.
3. Keep the business sounding competent and proactive.
4. Offer the next sensible follow-up step.

Output format:
- should_contact_customer
- reason
- suggested_channel
- customer_message
- internal_note
- confidence

Rules:
- Keep messages short and calm.
- Do not over-apologize.
- Do not promise a new time unless one is supplied.
- If no customer comms are needed, say so clearly.
- Prefer SMS for short timing changes, email for more detail.
- Use the business tone from company_context.`;

const WILLA_TOOL = {
  name: "emit_willa_draft",
  description: "Return Willa's customer-communication decision and draft message.",
  schema: {
    type: "object",
    required: ["should_contact_customer", "reason", "suggested_channel", "customer_message", "internal_note", "confidence"],
    additionalProperties: false,
    properties: {
      should_contact_customer: { type: "boolean", description: "Whether the customer should be contacted." },
      reason: { type: "string", description: "Short reason for the decision." },
      suggested_channel: { type: "string", enum: ["sms", "email", "none"], description: "sms for short timing changes, email for detail, none if no contact." },
      customer_message: { type: "string", description: "The draft message to the customer (empty if none needed)." },
      internal_note: { type: "string", description: "A short note for the tradie's own records." },
      confidence: { type: "string", description: "low | medium | high." },
    },
  },
} as const;

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : fallback;
}

function channel(v: unknown): WillaOutput["suggested_channel"] {
  return v === "sms" || v === "email" || v === "none" ? v : "none";
}

export function parseWilla(input: unknown): ParseResult<WillaOutput> {
  const o = (input ?? {}) as Record<string, unknown>;
  if (typeof o.should_contact_customer !== "boolean") {
    return { ok: false, error: "should_contact_customer must be a boolean" };
  }
  const ch = channel(o.suggested_channel);
  return {
    ok: true,
    value: {
      should_contact_customer: o.should_contact_customer,
      reason: str(o.reason, ""),
      // If we are contacting the customer we need a real channel; default to SMS.
      suggested_channel: o.should_contact_customer && ch === "none" ? "sms" : ch,
      customer_message: str(o.customer_message, ""),
      internal_note: str(o.internal_note, ""),
      confidence: str(o.confidence, "medium"),
    },
  };
}

export interface RunWillaArgs {
  job: JobPayload;
  assessment: WeatherAssessment;
  patOutput: PatOutput;
  companyContext: CompanyContext;
  userId?: string;
  quoteId?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export async function runWilla(args: RunWillaArgs): Promise<{ value: WillaOutput; model: string }> {
  const user = `Draft customer communication for a weather-affected job.

Job:
${JSON.stringify(args.job, null, 2)}

Assessment:
${JSON.stringify(args.assessment, null, 2)}

Pat recommendation:
${JSON.stringify(args.patOutput, null, 2)}

Company context:
${JSON.stringify(args.companyContext, null, 2)}

Return the output by calling emit_willa_draft with keys:
should_contact_customer, reason, suggested_channel, customer_message, internal_note, confidence`;

  const result = await runStructuredAgent<WillaOutput>({
    agentName: "Willa (customer comms)",
    system: SYSTEM_PROMPT,
    user,
    tool: WILLA_TOOL,
    parse: parseWilla,
    maxTokens: 1024,
    userId: args.userId,
    quoteId: args.quoteId,
    apiKey: args.apiKey,
    fetchImpl: args.fetchImpl,
  });
  return { value: result.value, model: result.model };
}
