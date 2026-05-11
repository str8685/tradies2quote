/**
 * Wave 13 — Lifecycle state machine.
 *
 * Pure functions, no I/O. The DB function `public.transition_quote_lifecycle`
 * mirrors this matrix and is the authority — if the two ever drift, the
 * DB rejects with sqlstate 22023.
 *
 * Forward-only. No reverse transitions in Wave 13.
 *
 * `viewed` is intentionally omitted from `OWNER_TRANSITIONS` even though
 * the DB matrix accepts it as a target. `viewed` is set automatically by
 * the public-quote route when the customer opens the share link — the
 * owner never clicks a "Mark viewed" button. The TS surface only
 * exposes targets that owners can actually pick.
 */
import type { QuoteStatus } from "@/lib/quote-types";

/**
 * Every status the lifecycle knows about. Kept in display order so the
 * dashboard tiles can iterate this list without re-sorting.
 */
export const STAGES = [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "scheduled",
  "in_progress",
  "completed",
  "declined",
  "expired",
] as const satisfies readonly QuoteStatus[];

/**
 * Targets the owner may transition INTO, keyed by the current status.
 * Terminal statuses map to an empty array.
 */
export const OWNER_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft:       ["sent", "declined"],
  sent:        ["accepted", "declined"],
  viewed:      ["accepted", "declined"],
  accepted:    ["scheduled"],
  scheduled:   ["in_progress"],
  in_progress: ["completed"],
  declined:    [],
  expired:     [],
  completed:   [],
};

/** True when an owner-driven transition `from -> to` is allowed. */
export function canTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return OWNER_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * The single most likely next stage from `status`. Used by the
 * orchestrator to surface ONE next-action button by default; the
 * LifecycleCard renders the full list of allowed targets where
 * applicable (declined/cancel as a secondary option).
 */
export function nextStage(status: QuoteStatus): QuoteStatus | null {
  return OWNER_TRANSITIONS[status]?.[0] ?? null;
}

export const STAGE_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  declined: "Declined",
  expired: "Expired",
};

export function stageLabel(status: QuoteStatus): string {
  return STAGE_LABELS[status] ?? status;
}

/**
 * Identifiers for the data fields the orchestrator checks before
 * recommending a transition. Pure tokens — humans see the matching
 * `why` and `todo` text from `MissingField` in the orchestrator output.
 */
export type RequiredField =
  | "client_name"
  | "client_contact"
  | "line_items"
  | "total"
  | "scope";

/**
 * Fields that MUST be present before we recommend transitioning INTO a
 * stage. Only `sent` has prerequisites in Wave 13 — once a quote has
 * been sent, every subsequent status is a manual flip that doesn't
 * require additional data.
 */
export const REQUIRED_FOR_STAGE: Record<QuoteStatus, readonly RequiredField[]> = {
  draft:       [],
  sent:        ["client_name", "line_items", "total"],
  viewed:      [],
  accepted:    [],
  scheduled:   [],
  in_progress: [],
  completed:   [],
  declined:    [],
  expired:     [],
};

export function requiredFieldsFor(stage: QuoteStatus): readonly RequiredField[] {
  return REQUIRED_FOR_STAGE[stage] ?? [];
}

/**
 * Terminal statuses — no further owner-driven transitions possible.
 * Useful for "archive me" UI affordances.
 */
export function isTerminal(status: QuoteStatus): boolean {
  return OWNER_TRANSITIONS[status]?.length === 0;
}
