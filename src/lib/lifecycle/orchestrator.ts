/**
 * Wave 13 — Lifecycle orchestrator.
 *
 * Pure function: given a quote's current status + data + (optional)
 * audit events, produces the exact 7-field output shape from the
 * Wave 13 spec:
 *
 *   1. stage              — current lifecycle stage
 *   2. nextAction         — single recommended next owner action
 *   3. missing            — fields that block the next action
 *   4. questions          — short prompts to ask the owner
 *   5. agentToTrigger     — which Wave 12 agent (if any) helps here
 *   6. approvalNeeded     — true when an owner click is required
 *   7. dashboardMessage   — one-line summary for the dashboard list
 *
 * The orchestrator is the ONLY place that decides "what should happen
 * next?" — the LifecycleCard renders this output, the server actions
 * execute it. No business logic lives in the React components.
 *
 * No I/O. Safe to import from server actions, server components, or
 * unit tests.
 */
import type { QuoteData, QuoteEvent, QuoteStatus } from "@/lib/quote-types";
import {
  STAGE_LABELS,
  type RequiredField,
} from "./stages";

export type ServerAction =
  | "sendQuote"
  | "acceptQuote"
  | "declineQuote"
  | "scheduleJob"
  | "markInProgress"
  | "markComplete";

export type AgentName =
  | "Quote Review"
  | "Compliance"
  | "Voice Cleanup"
  | "Follow-up"
  | "Invoice";

export interface NextAction {
  action: ServerAction;
  target: QuoteStatus;
  buttonLabel: string;
  description: string;
}

export interface MissingField {
  field: RequiredField;
  why: string;
  todo: string;
}

export interface OrchestratorInput {
  status: QuoteStatus;
  quoteData: QuoteData | null;
  events?: QuoteEvent[] | null;
  expiresAt?: string | null;
  /**
   * Wave 14 — voice transcript flowed in from the quote row. Drives
   * the Voice Cleanup suggestion when the quote is still in draft.
   */
  voiceTranscript?: string | null;
  /**
   * Wave 14 — whether a non-deleted, non-cancelled invoice already
   * exists for this quote. When `true` AND the stage is `completed`,
   * we DON'T re-suggest the Invoice agent (it would just hit the
   * idempotency path of the RPC).
   */
  invoiceExists?: boolean;
}

export interface OrchestratorOutput {
  stage: QuoteStatus;
  stageLabel: string;
  nextAction: NextAction | null;
  missing: ReadonlyArray<MissingField>;
  questions: ReadonlyArray<string>;
  agentToTrigger: AgentName | null;
  approvalNeeded: boolean;
  dashboardMessage: string;
}

/**
 * Compute the orchestrator output for one quote.
 */
export function orchestrate(input: OrchestratorInput): OrchestratorOutput {
  const { status, quoteData } = input;
  const hasTranscript =
    typeof input.voiceTranscript === "string" &&
    input.voiceTranscript.trim().length > 0;
  const invoiceExists = input.invoiceExists === true;

  const missing = computeMissing(status, quoteData);
  const blockingForSend = status === "draft" && missing.length > 0;

  const proposed = proposeNextAction(status);
  // If the recommendation is `send` but the quote is incomplete, hold
  // the action back — the orchestrator never surfaces a button that
  // would fail.
  const nextAction =
    proposed && proposed.target === "sent" && blockingForSend ? null : proposed;

  const agentToTrigger = chooseAgent(
    status,
    missing.length,
    hasTranscript,
    invoiceExists,
  );
  const approvalNeeded = nextAction !== null;
  const dashboardMessage = dashboardLine(status, missing.length, invoiceExists);
  const questions = missing.length > 0
    ? missing.slice(0, 3).map((m) => `${humanField(m.field)}: ${m.why}`)
    : [];

  return {
    stage: status,
    stageLabel: STAGE_LABELS[status],
    nextAction,
    missing,
    questions,
    agentToTrigger,
    approvalNeeded,
    dashboardMessage,
  };
}

/** The default next action keyed by current status. */
function proposeNextAction(s: QuoteStatus): NextAction | null {
  switch (s) {
    case "draft":
      return {
        action: "sendQuote",
        target: "sent",
        buttonLabel: "Send to client",
        description:
          "Mark the quote as sent. The customer can view and accept on their share link.",
      };
    case "sent":
    case "viewed":
      return {
        action: "acceptQuote",
        target: "accepted",
        buttonLabel: "Mark accepted",
        description:
          "Record manual acceptance — use when the client accepted verbally or signed offline.",
      };
    case "accepted":
      return {
        action: "scheduleJob",
        target: "scheduled",
        buttonLabel: "Schedule the job",
        description:
          "Pick a job date and move it to scheduled — it'll show under Upcoming on your dashboard.",
      };
    case "scheduled":
      return {
        action: "markInProgress",
        target: "in_progress",
        buttonLabel: "Start work",
        description:
          "Mark the job as on-site / in-progress.",
      };
    case "in_progress":
      return {
        action: "markComplete",
        target: "completed",
        buttonLabel: "Mark complete",
        description:
          "Job done. Wave 14 turns completion into an invoice draft — for now, this just closes the workflow.",
      };
    case "declined":
    case "expired":
    case "completed":
      return null;
  }
}

/**
 * Which agent helps at this stage. Returns `null` when no agent
 * applies. The LifecycleCard scrolls to the matching on-page section
 * when the user taps the suggestion.
 *
 * Priority order on `draft`:
 *   1. Missing required fields → Quote Review (must fix to send)
 *   2. Voice transcript present → Voice Cleanup (refine the scope)
 *   3. Clean draft → Compliance (polish exclusions / terms)
 *
 * On `sent`/`viewed`: Follow-up (templates).
 * On `completed` without an active invoice: Invoice (create draft).
 * Every other stage: no agent.
 */
function chooseAgent(
  s: QuoteStatus,
  missingCount: number,
  hasTranscript: boolean,
  invoiceExists: boolean,
): AgentName | null {
  if (s === "draft") {
    if (missingCount > 0) return "Quote Review";
    if (hasTranscript) return "Voice Cleanup";
    return "Compliance";
  }
  if (s === "sent" || s === "viewed") return "Follow-up";
  if (s === "completed" && !invoiceExists) return "Invoice";
  return null;
}

function computeMissing(
  s: QuoteStatus,
  qd: QuoteData | null,
): MissingField[] {
  // Only the `draft -> sent` move has prerequisites in Wave 13. Every
  // other transition is a manual flip the owner can do anytime.
  if (s !== "draft") return [];
  if (!qd) return [];

  const out: MissingField[] = [];

  const name = qd.client?.name?.trim() ?? "";
  if (name.length === 0) {
    out.push({
      field: "client_name",
      why: "The PDF needs a name in the bill-to block.",
      todo: "Add the client's name in the quote editor before sending.",
    });
  }

  const hasEmail = (qd.client?.email ?? "").trim().length > 0;
  const hasPhone = (qd.client?.phone ?? "").trim().length > 0;
  if (!hasEmail && !hasPhone) {
    out.push({
      field: "client_contact",
      why: "Without an email or phone the customer can't be reached.",
      todo: "Add an email or phone for the client in the editor.",
    });
  }

  if (!Array.isArray(qd.line_items) || qd.line_items.length === 0) {
    out.push({
      field: "line_items",
      why: "An empty quote has nothing to charge for.",
      todo: "Add at least one material or labour line.",
    });
  }

  const total = Number(qd.total ?? 0);
  if (!Number.isFinite(total) || total <= 0) {
    out.push({
      field: "total",
      why: "Total reads as $0 — clients won't take this as a real quote.",
      todo: "Set prices on the line items so a real total appears.",
    });
  }

  return out;
}

function humanField(f: RequiredField): string {
  switch (f) {
    case "client_name": return "Client name";
    case "client_contact": return "Client contact";
    case "line_items": return "Line items";
    case "total": return "Total";
    case "scope": return "Scope";
  }
}

function dashboardLine(
  s: QuoteStatus,
  missingCount: number,
  invoiceExists: boolean,
): string {
  if (s === "draft" && missingCount > 0)
    return `Draft — fix ${missingCount} thing${missingCount > 1 ? "s" : ""} before sending.`;
  if (s === "draft") return "Draft — ready to send.";
  if (s === "sent") return "Sent. Waiting on the client.";
  if (s === "viewed") return "Client opened the link. A follow-up nudge may help.";
  if (s === "accepted") return "Accepted — schedule the job to keep momentum.";
  if (s === "scheduled") return "Scheduled — mark on-site when work starts.";
  if (s === "in_progress") return "On-site. Mark complete when the job's done.";
  if (s === "completed")
    return invoiceExists
      ? "Completed. Invoice draft created."
      : "Completed — create a draft invoice when ready.";
  if (s === "declined") return "Declined. Follow up or archive.";
  if (s === "expired") return "Expired. Re-send with a fresh date if still live.";
  return "—";
}
