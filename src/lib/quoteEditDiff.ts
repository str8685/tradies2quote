/**
 * Wave 40 — AI edit diffing.
 *
 * Given the AI's original line items and the tradie's saved version,
 * produce a structured before/after diff that's easy to aggregate
 * across many quotes. The point of the diff is NOT to reconstruct the
 * full state — `quotes.ai_snapshot` and `quote_edit_events.edited_data`
 * already hold both sides verbatim. The diff is a *query-friendly*
 * surface: "which fields does the tradie correct most often" answered
 * by a single JSONB query against `diff -> 'modified'`.
 *
 * Matching strategy, in order:
 *   1. by `library_id` if both sides have one
 *   2. by exact description match (case-insensitive, trimmed)
 *   3. by positional index — only when the line counts match
 *
 * No fuzzy matching beyond that: a fuzzy match would muddy the eval
 * signal (we'd flag legitimately-different lines as edits). When the
 * match falls through, the AI line shows up as "removed" and the user
 * line as "added" — that's an honest signal that the user replaced
 * the line wholesale.
 */

import type { QuoteData, QuoteLineItem } from "@/lib/quote-types";

export type EditedFieldName =
  | "description"
  | "quantity"
  | "unit"
  | "unit_price"
  | "type";

export interface EditedLineDiff {
  /** Stable index from the AI side so callers can join back. */
  ai_index: number;
  /** Stable index from the user side. */
  user_index: number;
  /** What identified the match. */
  match: "library_id" | "description" | "position";
  /** Library id if present on either side, for trend queries. */
  library_id: string | null;
  /** Per-field before/after. Only fields that changed appear here. */
  fields: Array<{
    name: EditedFieldName;
    from: string | number | null;
    to: string | number | null;
  }>;
}

export interface RemovedLineDiff {
  ai_index: number;
  library_id: string | null;
  description: string;
  type: string;
  quantity: number;
  unit_price: number;
}

export interface AddedLineDiff {
  user_index: number;
  library_id: string | null;
  description: string;
  type: string;
  quantity: number;
  unit_price: number;
}

export interface QuoteEditDiff {
  /** Counts at a glance. */
  summary: {
    ai_line_count: number;
    user_line_count: number;
    kept: number;
    modified: number;
    added: number;
    removed: number;
  };
  modified: EditedLineDiff[];
  added: AddedLineDiff[];
  removed: RemovedLineDiff[];
  /** Total before tax / total after tax — both sides for trend queries. */
  totals: {
    ai_total: number;
    user_total: number;
    ai_subtotal: number;
    user_subtotal: number;
  };
}

function normDescription(s: string): string {
  return s.trim().toLowerCase();
}

function lineKey(it: QuoteLineItem): string {
  if (it.library_id) return `lib:${it.library_id}`;
  return `desc:${normDescription(it.description)}`;
}

function compareFields(
  ai: QuoteLineItem,
  user: QuoteLineItem,
): EditedLineDiff["fields"] {
  const out: EditedLineDiff["fields"] = [];
  if (normDescription(ai.description) !== normDescription(user.description)) {
    out.push({
      name: "description",
      from: ai.description,
      to: user.description,
    });
  }
  if (Number(ai.quantity) !== Number(user.quantity)) {
    out.push({
      name: "quantity",
      from: Number(ai.quantity) || 0,
      to: Number(user.quantity) || 0,
    });
  }
  if ((ai.unit ?? "").trim() !== (user.unit ?? "").trim()) {
    out.push({
      name: "unit",
      from: ai.unit ?? "",
      to: user.unit ?? "",
    });
  }
  if (Number(ai.unit_price) !== Number(user.unit_price)) {
    out.push({
      name: "unit_price",
      from: Number(ai.unit_price) || 0,
      to: Number(user.unit_price) || 0,
    });
  }
  if (ai.type !== user.type) {
    out.push({ name: "type", from: ai.type, to: user.type });
  }
  return out;
}

export function buildQuoteEditDiff(
  ai: QuoteData | null | undefined,
  user: QuoteData,
): QuoteEditDiff {
  const aiItems = ai?.line_items ?? [];
  const userItems = user.line_items ?? [];

  const usedUserIndices = new Set<number>();
  const modified: EditedLineDiff[] = [];
  const removed: RemovedLineDiff[] = [];
  let kept = 0;

  // Pass 1 — library_id matches.
  aiItems.forEach((aiItem, aiIndex) => {
    if (!aiItem.library_id) return;
    const userIndex = userItems.findIndex(
      (u, i) => !usedUserIndices.has(i) && u.library_id === aiItem.library_id,
    );
    if (userIndex === -1) return;
    usedUserIndices.add(userIndex);
    const fields = compareFields(aiItem, userItems[userIndex]);
    if (fields.length === 0) {
      kept++;
    } else {
      modified.push({
        ai_index: aiIndex,
        user_index: userIndex,
        match: "library_id",
        library_id: aiItem.library_id ?? null,
        fields,
      });
    }
  });

  // Pass 2 — description matches for AI lines that didn't get a library hit.
  aiItems.forEach((aiItem, aiIndex) => {
    if (modified.some((m) => m.ai_index === aiIndex)) return;
    if (aiItem.library_id) {
      // Had a library_id but no matching user line — handled below as removed.
      return;
    }
    const userIndex = userItems.findIndex(
      (u, i) =>
        !usedUserIndices.has(i) &&
        normDescription(u.description) === normDescription(aiItem.description),
    );
    if (userIndex === -1) return;
    usedUserIndices.add(userIndex);
    const fields = compareFields(aiItem, userItems[userIndex]);
    if (fields.length === 0) {
      kept++;
    } else {
      modified.push({
        ai_index: aiIndex,
        user_index: userIndex,
        match: "description",
        library_id: null,
        fields,
      });
    }
  });

  // Pass 3 — positional fallback when AI line is otherwise unmatched.
  aiItems.forEach((aiItem, aiIndex) => {
    if (modified.some((m) => m.ai_index === aiIndex)) return;
    if (usedUserIndices.has(aiIndex)) return;
    if (aiIndex >= userItems.length) return;
    if (
      aiItem.library_id &&
      userItems[aiIndex].library_id &&
      aiItem.library_id !== userItems[aiIndex].library_id
    ) {
      // Both have library_ids but they don't match — count as remove+add.
      return;
    }
    usedUserIndices.add(aiIndex);
    const fields = compareFields(aiItem, userItems[aiIndex]);
    if (fields.length === 0) {
      kept++;
    } else {
      modified.push({
        ai_index: aiIndex,
        user_index: aiIndex,
        match: "position",
        library_id: aiItem.library_id ?? null,
        fields,
      });
    }
  });

  // Whatever AI lines are still unaccounted for got removed.
  aiItems.forEach((aiItem, aiIndex) => {
    const matched =
      modified.some((m) => m.ai_index === aiIndex) ||
      (usedUserIndices.has(aiIndex) &&
        kept > 0 &&
        normDescription(aiItem.description) ===
          normDescription(userItems[aiIndex]?.description ?? ""));
    if (matched) return;
    if (
      modified.some((m) => m.ai_index === aiIndex) ||
      // Kept-without-modification check: same key landed in the same user slot.
      (aiIndex < userItems.length &&
        usedUserIndices.has(aiIndex) &&
        lineKey(aiItem) === lineKey(userItems[aiIndex]))
    ) {
      return;
    }
    if (!usedUserIndices.has(aiIndex)) {
      removed.push({
        ai_index: aiIndex,
        library_id: aiItem.library_id ?? null,
        description: aiItem.description,
        type: aiItem.type,
        quantity: Number(aiItem.quantity) || 0,
        unit_price: Number(aiItem.unit_price) || 0,
      });
    }
  });

  // User lines that didn't match any AI line are additions.
  const added: AddedLineDiff[] = [];
  userItems.forEach((userItem, userIndex) => {
    if (usedUserIndices.has(userIndex)) return;
    added.push({
      user_index: userIndex,
      library_id: userItem.library_id ?? null,
      description: userItem.description,
      type: userItem.type,
      quantity: Number(userItem.quantity) || 0,
      unit_price: Number(userItem.unit_price) || 0,
    });
  });

  return {
    summary: {
      ai_line_count: aiItems.length,
      user_line_count: userItems.length,
      kept,
      modified: modified.length,
      added: added.length,
      removed: removed.length,
    },
    modified,
    added,
    removed,
    totals: {
      ai_total: Number(ai?.total) || 0,
      user_total: Number(user.total) || 0,
      ai_subtotal: Number(ai?.subtotal_before_tax) || 0,
      user_subtotal: Number(user.subtotal_before_tax) || 0,
    },
  };
}

/** True if the diff contains any non-cosmetic change worth logging. */
export function diffIsNonEmpty(diff: QuoteEditDiff): boolean {
  return (
    diff.summary.modified > 0 ||
    diff.summary.added > 0 ||
    diff.summary.removed > 0
  );
}
