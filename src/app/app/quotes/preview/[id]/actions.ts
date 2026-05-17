"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { round2 } from "@/lib/quote-defaults";
import { applyMaterialCorrections } from "@/lib/quoteEditLearning";
import type { QuoteData, QuoteStatus } from "@/lib/quote-types";
import { canTransition } from "@/lib/lifecycle/stages";
import {
  logAgentError,
  logAgentEvent,
} from "@/lib/agent-monitor/logger";

type SaveResult =
  | { ok: true; materialsLearned?: number }
  | { error: string };

export async function saveQuoteChanges(
  id: string,
  data: QuoteData,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: priorRow } = await supabase
    .from("quotes")
    .select("quote_data, status, user_id")
    .eq("id", id)
    .single();
  // RLS already scopes this, but check ownership explicitly so a
  // missing / not-owned quote fails loudly here instead of silently
  // updating zero rows below and reporting a false success.
  if (!priorRow || priorRow.user_id !== user.id) {
    return { error: "Quote not found." };
  }
  if (priorRow.status === "accepted") {
    return { error: "Quote already accepted — edits are locked." };
  }
  const prior = (priorRow.quote_data ?? null) as QuoteData | null;

  let materials_subtotal = 0;
  let labour_subtotal = 0;
  const items = (data.line_items ?? []).map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unit_price) || 0;
    const line_total = round2(qty * price);
    if (it.type === "labour") labour_subtotal += line_total;
    else materials_subtotal += line_total;
    return { ...it, quantity: qty, unit_price: price, line_total };
  });
  const markup_pct = Number(data.markup_pct) || 0;
  const tax_rate = Number(data.tax_rate) || 0;
  const markup_amount = round2(materials_subtotal * (markup_pct / 100));
  const subtotal_before_tax = round2(
    materials_subtotal + markup_amount + labour_subtotal,
  );
  const tax_amount = round2(subtotal_before_tax * (tax_rate / 100));
  const total = round2(subtotal_before_tax + tax_amount);

  const next: QuoteData = {
    ...data,
    line_items: items,
    materials_subtotal: round2(materials_subtotal),
    labour_subtotal: round2(labour_subtotal),
    markup_pct,
    markup_amount,
    subtotal_before_tax,
    tax_amount,
    total,
  };

  const { data: updatedRows, error: uErr } = await supabase
    .from("quotes")
    .update({
      quote_data: next,
      total_amount: total,
      currency: next.currency,
    })
    .eq("id", id)
    .select("id");
  if (uErr) {
    console.error("saveQuoteChanges update failed", uErr);
    return { error: "Could not save changes." };
  }
  if (!updatedRows || updatedRows.length === 0) {
    // RLS blocked the write — zero rows changed but no error raised.
    // Fail rather than report a save that never happened.
    console.error("saveQuoteChanges updated 0 rows", { id });
    return { error: "Could not save changes." };
  }

  const { error: dErr } = await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", id);
  if (dErr) {
    console.error("saveQuoteChanges delete items failed", dErr);
    return { error: "Could not refresh line items." };
  }

  if (items.length > 0) {
    const { error: iErr } = await supabase.from("quote_items").insert(
      items.map((it) => ({
        quote_id: id,
        type: it.type,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
    );
    if (iErr) {
      console.error("saveQuoteChanges insert items failed", iErr);
      return { error: "Could not write line items." };
    }
  }

  // Stage 4.6 — feed user line edits into the user-scoped material library.
  // Replaces the Stage 2.5 syncEditedMaterialsToLibrary helper. Always
  // wrapped in try-friendly orchestrator that returns counts and never
  // throws, so a learning failure cannot break a quote save.
  const learn = await applyMaterialCorrections(
    supabase,
    user.id,
    items,
    prior?.line_items ?? [],
  );

  return { ok: true, materialsLearned: learn.materialsLearned };
}

/* -------------------------------------------------------------------------
 * Wave 13 — Lifecycle transition server actions.
 *
 * Each action delegates the actual UPDATE + quote_events INSERT to the
 * Postgres RPC `public.transition_quote_lifecycle`, which performs both
 * inside a single transaction. That guarantees an audit row is written
 * for every status change without a 2-statement race window.
 *
 * Pre-flight checks before the RPC call:
 *   1. `auth.getUser()` — must be signed in.
 *   2. Load the current quote (RLS-scoped to this owner).
 *   3. Validate the transition is allowed via `canTransition()`.
 *
 * If the TS check passes but the RPC rejects (concurrent transition,
 * drift between TS + DB matrix, etc.), the error is bubbled back with
 * the original Postgres sqlstate so the LifecycleCard can render a
 * meaningful message.
 *
 * No background side-effects. No email send. No PDF generation. No
 * automation. Pure owner-driven state change + audit log. Wave 14 will
 * layer optional email-on-send on top of `sendQuote`.
 * ------------------------------------------------------------------------- */

export type LifecycleResult =
  | { ok: true; status: QuoteStatus }
  | { error: string; code?: string };

interface PostgresErrorShape {
  code?: string;
  message?: string;
}

/** Map Postgres error codes raised by the RPC to plain-English messages. */
function explainRpcError(err: unknown): { error: string; code?: string } {
  const e = (err ?? {}) as PostgresErrorShape;
  const code = e.code;
  if (code === "28000") return { error: "You need to sign in to do that.", code };
  if (code === "P0002") return { error: "Quote not found.", code };
  if (code === "42501") return { error: "You don't own this quote.", code };
  if (code === "22023")
    return {
      error: "That status change isn't allowed from the current state.",
      code,
    };
  return {
    error: e.message ?? "Could not update the quote's lifecycle stage.",
    code,
  };
}

/**
 * Core transition helper. Validates the move TS-side, calls the RPC,
 * and revalidates the affected pages. Every public action below is a
 * thin wrapper around this.
 */
async function transition(
  quoteId: string,
  target: QuoteStatus,
): Promise<LifecycleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Pre-flight: read current status so we can give a useful error
  // BEFORE round-tripping to the RPC. RLS keeps this scoped to the
  // owner's own quotes.
  const { data: row, error: loadErr } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  if (loadErr || !row) {
    return { error: "Quote not found.", code: "P0002" };
  }
  const current = (row.status ?? "draft") as QuoteStatus;
  if (!canTransition(current, target)) {
    return {
      error: `Cannot move a ${current} quote to ${target}.`,
      code: "22023",
    };
  }

  // The RPC does: row-lock → re-check ownership → re-check matrix →
  // UPDATE quotes (status + matching first-time timestamp) → INSERT
  // quote_events. Single transaction.
  const { data: newStatus, error: rpcErr } = await supabase.rpc(
    "transition_quote_lifecycle",
    {
      p_quote_id: quoteId,
      p_target: target,
      p_metadata: { source: "lifecycle_card" },
    },
  );
  if (rpcErr) {
    console.error("transition_quote_lifecycle RPC failed", rpcErr);
    return explainRpcError(rpcErr);
  }

  revalidatePath(`/app/quotes/preview/${quoteId}`);
  revalidatePath("/app/quotes");
  revalidatePath("/app");
  return { ok: true, status: (newStatus as QuoteStatus) ?? target };
}

export async function sendQuote(quoteId: string): Promise<LifecycleResult> {
  return transition(quoteId, "sent");
}

export async function acceptQuote(quoteId: string): Promise<LifecycleResult> {
  return transition(quoteId, "accepted");
}

export async function declineQuote(quoteId: string): Promise<LifecycleResult> {
  return transition(quoteId, "declined");
}

export async function scheduleJob(quoteId: string): Promise<LifecycleResult> {
  return transition(quoteId, "scheduled");
}

export async function markInProgress(
  quoteId: string,
): Promise<LifecycleResult> {
  return transition(quoteId, "in_progress");
}

export async function markComplete(quoteId: string): Promise<LifecycleResult> {
  return transition(quoteId, "completed");
}

/* -------------------------------------------------------------------------
 * Wave 14 — Invoice draft creation.
 *
 * Single call to the `create_invoice_from_quote(uuid)` Postgres RPC.
 * The RPC is the ONLY path that inserts into public.invoices:
 *   - `authenticated` has no INSERT grant on the table
 *   - no `invoices_insert_own` RLS policy exists
 *   - the RPC is SECURITY DEFINER and runs as postgres (superuser),
 *     bypassing both restrictions while enforcing its own checks:
 *       * caller is authenticated
 *       * caller owns the quote
 *       * quote.status = 'completed'
 *       * no non-cancelled invoice already exists for the quote
 *
 * No PDF generation, no email send, no payment flow in this action.
 * The draft row lives in public.invoices and surfaces in the UI via
 * <InvoiceDraftCard>.
 * ------------------------------------------------------------------------- */

export type InvoiceCreateResult =
  | { ok: true; id: string }
  | { error: string; code?: string };

interface PostgresErrorShape {
  code?: string;
  message?: string;
}

function explainInvoiceRpcError(err: unknown): {
  error: string;
  code?: string;
} {
  const e = (err ?? {}) as PostgresErrorShape;
  const code = e.code;
  if (code === "28000")
    return { error: "You need to sign in to do that.", code };
  if (code === "P0002") return { error: "Quote not found.", code };
  if (code === "42501")
    return { error: "You don't own this quote.", code };
  if (code === "22023")
    return {
      error:
        "Mark the quote complete before invoicing — only completed quotes can become invoices.",
      code,
    };
  return {
    error: e.message ?? "Could not create the invoice draft.",
    code,
  };
}

export async function createInvoiceFromQuote(
  quoteId: string,
): Promise<InvoiceCreateResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Correlate the three Invoice Agent events (rpc.start → rpc.success
  // or rpc.failed) with a single run id. Random hex so two parallel
  // calls from the same quote don't collide.
  const runId = `inv_${quoteId}_${Math.random().toString(16).slice(2, 10)}`;
  const startedAt = Date.now();

  logAgentEvent({
    agentName: "Invoice Agent",
    quoteId,
    runId,
    stepName: "rpc.start",
    status: "running",
    message: "create_invoice_from_quote RPC started (Draft only)",
    startedAt,
  });

  const { data, error } = await supabase.rpc("create_invoice_from_quote", {
    p_quote_id: quoteId,
  });

  if (error) {
    console.error("create_invoice_from_quote RPC failed", error);
    logAgentError({
      agentName: "Invoice Agent",
      quoteId,
      runId,
      stepName: "rpc.failed",
      status: "failed",
      message:
        (error as { code?: string; message?: string }).message ??
        "create_invoice_from_quote RPC error",
      durationMs: Date.now() - startedAt,
    });
    return explainInvoiceRpcError(error);
  }

  // Cache invalidation so the InvoiceDraftCard flips from "preview"
  // to "existing" on the next render.
  revalidatePath(`/app/quotes/preview/${quoteId}`);
  revalidatePath("/app/quotes");
  revalidatePath("/app");

  logAgentEvent({
    agentName: "Invoice Agent",
    quoteId,
    runId,
    stepName: "rpc.success",
    status: "complete",
    message: "Draft invoice created (Draft only — not sent, not billed)",
    durationMs: Date.now() - startedAt,
  });

  return { ok: true, id: data as string };
}

/* -------------------------------------------------------------------------
 * Mark invoice paid.
 *
 * Flips invoices.status → 'paid' and stamps paid_at = now. Scoped to
 * the caller's own invoices via the user-scoped Supabase client + an
 * explicit user_id match — the same defence-in-depth pattern the rest
 * of /app uses (RLS is on, but the explicit eq is what proves intent
 * to a reader of this code).
 * ------------------------------------------------------------------------- */

export type MarkPaidResult =
  | { ok: true; invoice_id: string; paid_at: string }
  | { error: string };

export async function markInvoicePaid(
  invoiceId: string,
): Promise<MarkPaidResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const paidAt = new Date().toISOString();

  // Update via the user-scoped client so RLS enforces ownership and we
  // don't need a service-role bypass for what is fundamentally an
  // owner-initiated state flip. The `eq("user_id")` is belt-and-braces.
  const { data, error } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", invoiceId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .select("id, quote_id")
    .single();

  if (error) {
    console.error("markInvoicePaid failed", error);
    return { error: error.message ?? "Could not mark the invoice paid." };
  }
  if (!data) {
    return { error: "Invoice not found." };
  }

  // Refresh every surface the invoice can appear on so the "paid"
  // pill flips immediately without a manual reload.
  revalidatePath(`/app/quotes/preview/${data.quote_id}`);
  revalidatePath("/app/invoices");
  revalidatePath("/app");

  logAgentEvent({
    agentName: "Invoice Agent",
    quoteId: data.quote_id,
    stepName: "mark_paid",
    status: "complete",
    message: "Invoice marked as paid",
  });

  return { ok: true, invoice_id: data.id, paid_at: paidAt };
}
